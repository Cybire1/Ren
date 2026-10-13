import { formatAmount, parseAmount } from '@kova/tempo'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { Hono } from 'hono'
import { getAddress, isAddress } from 'viem'
import { z } from 'zod'
import { KovaError } from '../errors.js'
import { limit } from '../limits.js'
import {
  agentFetch,
  agentForToken,
  agentPay,
  agentPayCharge,
  chargeIdFrom,
  describeAgent,
  paymentRow,
} from '../services/agents.js'
import { type KeyPaymentRow, type KeyRow, paymentsOf } from '../services/keys.js'

/**
 * Ren's MCP server: an AI agent (Claude, or any MCP client) pays with the key its owner gave it.
 *
 *   claude mcp add --transport http ren https://<api>/mcp --header "Authorization: Bearer ren_agent_…"
 *
 * Stateless: each request is answered by a fresh server for the token's key, so there's nothing
 * to resume and nothing kept between calls. The tools only ever do what the agent's own endpoints
 * do (routes/keys.ts), under the same rules; a payment over the key's ask-first line waits for the
 * owner's yes on their phone.
 */

const MAX_TEXT = 60_000
const text = (value: string) => ({ content: [{ type: 'text' as const, text: value.slice(0, MAX_TEXT) }] })

function said(payment: KeyPaymentRow): string {
  const amount = `$${formatAmount(payment.amount)}`
  switch (payment.status) {
    case 'paid':
      return `Paid ${amount} to ${payment.description ?? getAddress(payment.recipient)}. Transaction ${payment.txHash ?? 'pending'}. Payment id ${payment.id}.`
    case 'pending_approval':
      return `${amount} is over what this key pays without asking, so it's waiting for its owner to approve it on their phone. Payment id ${payment.id}: check it with ren_payment in a minute.`
    case 'denied':
      return `Refused: ${payment.reason ?? 'the key’s rules don’t allow it'} Nothing was paid.`
    default:
      return `It didn't go through (${payment.status}): ${payment.reason ?? 'unknown'}. Nothing was paid.`
  }
}

function serverFor(key: KeyRow): McpServer {
  const server = new McpServer({ name: 'ren', version: '1.0.0' })

  server.registerTool(
    'ren_status',
    {
      title: 'What this Ren key can spend',
      description:
        'Shows the Ren key you pay with: how much it has left this period and when that renews, the most one payment can be, the amount above which its owner must approve, who it may pay, and when it expires. Check this before paying.',
      inputSchema: {},
    },
    async () => text(JSON.stringify(await describeAgent(key), null, 2)),
  )

  server.registerTool(
    'ren_pay',
    {
      title: 'Pay a wallet',
      description:
        'Sends US dollars (on Tempo) from your owner’s Ren wallet to a wallet address, within this key’s limits. Ren pays the network fee. Use ren_pay_charge instead for a Ren shop’s charge or pay link.',
      inputSchema: {
        to: z.string().describe('The wallet address to pay (0x…).'),
        amount: z.string().describe('Dollars, like "2" or "4.50".'),
        note: z.string().max(200).optional().describe('What it’s for, shown to the owner.'),
      },
    },
    async ({ to, amount, note }) => {
      if (!isAddress(to)) return text('That isn’t a wallet address. Nothing was paid.')
      limit(`agent-pay:${key.id}`, 60, 60_000, 'Too many payments this minute.')
      return text(said(await agentPay(key, { to: getAddress(to), amount: parseAmount(amount), note })))
    },
  )

  server.registerTool(
    'ren_pay_charge',
    {
      title: 'Pay a Ren charge',
      description:
        'Pays a Ren shop’s charge (from a till’s QR code, a stall order or a payment link) for exactly what it asks, so the shop sees it paid. Pass the link or its pi_… id.',
      inputSchema: { charge: z.string().describe('The charge’s pay link or its pi_… id.') },
    },
    async ({ charge }) => {
      const id = chargeIdFrom(charge)
      if (!id) return text('That isn’t a Ren charge or pay link. Nothing was paid.')
      limit(`agent-pay:${key.id}`, 60, 60_000, 'Too many payments this minute.')
      try {
        return text(said(await agentPayCharge(key, id)))
      } catch (error) {
        return text(`${error instanceof Error ? error.message : 'It didn’t go through.'} Nothing was paid.`)
      }
    },
  )

  server.registerTool(
    'ren_fetch',
    {
      title: 'Call a paid API (MPP)',
      description:
        'Calls a URL. If the site charges per request over MPP (HTTP 402, the Machine Payments Protocol on Tempo), Ren reads the price first and pays it from this key only if the key’s rules allow, then returns what the site sent back. Set max_amount to refuse anything pricier.',
      inputSchema: {
        url: z.string().url(),
        method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('GET'),
        headers: z.record(z.string(), z.string()).optional(),
        body: z.string().optional().describe('The request body, for POST and the like (often JSON).'),
        max_amount: z.string().optional().describe('The most you agree to pay for this request, in dollars.'),
      },
    },
    async ({ url, method, headers, body, max_amount }) => {
      limit(`agent-fetch:${key.id}`, 60, 60_000, 'Too many paid requests this minute.')
      const result = await agentFetch(key, {
        url,
        method,
        headers,
        body,
        maxAmount: max_amount ? parseAmount(max_amount) : undefined,
      })
      const head =
        result.status === 'free'
          ? 'The site didn’t charge for this.'
          : result.payment
            ? said(result.payment)
            : `It didn't go through: ${result.reason ?? 'unknown'}.`
      const response = result.response
        ? `\n\nThe site answered ${result.response.status} (${result.response.content_type ?? 'no type'})${result.response.truncated ? ', cut short' : ''}:\n${result.response.encoding === 'base64' ? `[${result.response.body.length} base64 characters of binary]` : result.response.body}`
        : ''
      return text(head + response)
    },
  )

  server.registerTool(
    'ren_payment',
    {
      title: 'Check a payment',
      description:
        'Looks up one of this key’s payments by id: whether its owner approved it yet, and for a paid request that waited for approval, what the site sent back.',
      inputSchema: { payment_id: z.string() },
    },
    async ({ payment_id }) => {
      const payment = await paymentRow(payment_id)
      if (!payment || payment.walletKeyId !== key.id) return text('No such payment for this key.')
      const response = payment.response as { status?: number; body?: string; encoding?: string } | null
      return text(
        said(payment) +
          (response?.body
            ? `\n\nThe site answered ${response.status}:\n${response.encoding === 'base64' ? '[binary]' : response.body}`
            : ''),
      )
    },
  )

  server.registerTool(
    'ren_history',
    {
      title: 'Recent payments',
      description: 'The last payments this key made or was refused, newest first.',
      inputSchema: {},
    },
    async () => {
      const rows = await paymentsOf([key.id], 20)
      if (rows.length === 0) return text('This key hasn’t paid anything yet.')
      return text(
        rows
          .map((p) => `${p.createdAt.toISOString()}  ${p.status.padEnd(16)} $${formatAmount(p.amount).padStart(8)}  ${p.description ?? p.origin ?? p.recipient}${p.reason ? `  (${p.reason})` : ''}`)
          .join('\n'),
      )
    },
  )

  return server
}

export const mcpRoutes = new Hono()

mcpRoutes.all('/mcp', async (c) => {
  const header = c.req.header('authorization') ?? ''
  let key: KeyRow
  try {
    key = await agentForToken(header.startsWith('Bearer ') ? header.slice(7).trim() : undefined)
  } catch (error) {
    if (error instanceof KovaError)
      return c.json({ jsonrpc: '2.0', id: null, error: { code: -32001, message: error.message } }, 401, {
        'WWW-Authenticate': 'Bearer realm="ren", error="invalid_token"',
      })
    throw error
  }
  const server = serverFor(key)
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
  await server.connect(transport)
  try {
    return await transport.handleRequest(c.req.raw)
  } finally {
    void server.close()
  }
})
