/**
 * Private takings end to end (services/private-pay.ts), on Tempo testnet's Zone A against a running
 * Ren API with KOVA_ZONE_PORTAL set: a shop charges $1.00; a customer pays it privately, sealing
 * a deposit into the zone for the shop (Ren's relay pays the fee); then hands Ren the deposit's
 * one-time key, which proves who it was for, and the charge turns to paid. Tempo's explorer shows
 * a deposit into the zone, not the shop. A wrong key, or a deposit for someone else, is refused.
 *
 *   pnpm --filter @kova/api private:e2e        (API_URL, default http://localhost:4400)
 */
import { createCipheriv, createECDH, hkdfSync, randomBytes } from 'node:crypto'
import { type Address, encodeFunctionData, getAddress, type Hex, hexToBytes, numberToBytes, parseAbi } from 'viem'
import { Abis, Actions } from 'viem/tempo'
import { fund, newCustomer, walletFor } from './customer-tempo.js'

const api = process.env.API_URL ?? 'http://localhost:4400'
const portal = (process.env.KOVA_ZONE_PORTAL ?? '0x7069DeC4E64Fd07334A0933eDe836C17259c9B23') as Address
const zoneId = Number(process.env.KOVA_ZONE_ID ?? 6)
const step = (text: string) => console.log(`\n▸ ${text}`)
const ok = (text: string) => console.log(`  ✓ ${text}`)

async function call<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<{ status: number; body: T }> {
  const response = await fetch(`${api}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.token ? { authorization: `Bearer ${init.token}` } : {}), ...init.headers },
  })
  return { status: response.status, body: (await response.json().catch(() => ({}))) as T }
}
function expect(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`✗ ${message}`)
}

const sandboxPortal = parseAbi([
  'function depositEncrypted(address token, uint128 amount, uint256 keyIndex, (bytes32 ephemeralPubkeyX, uint8 ephemeralPubkeyYParity, bytes ciphertext, bytes12 nonce, bytes16 tag) encrypted) returns (bytes32)',
])

/** Seals a deposit for `to` exactly as the wallet does (apps/web lib/wallet/zone.ts), keeping the one-time key. */
function seal(sequencer: { prefix: number; x: Hex }, to: Address, keyIndex: bigint) {
  const ecdh = createECDH('secp256k1')
  ecdh.generateKeys()
  const ephemeral = ecdh.getPublicKey(null, 'compressed')
  const shared = ecdh.computeSecret(Buffer.concat([Buffer.of(sequencer.prefix), Buffer.from(hexToBytes(sequencer.x))]))
  const info = Buffer.concat([Buffer.from(hexToBytes(portal)), Buffer.from(numberToBytes(keyIndex, { size: 32 })), ephemeral.subarray(1)])
  const key = Buffer.from(hkdfSync('sha256', shared, Buffer.from('ecies-aes-key'), info, 32))
  const nonce = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, nonce)
  const body = Buffer.concat([cipher.update(Buffer.concat([Buffer.from(hexToBytes(to)), Buffer.alloc(32), Buffer.alloc(12)])), cipher.final()])
  return {
    encrypted: {
      ephemeralPubkeyX: `0x${ephemeral.subarray(1).toString('hex')}` as Hex,
      ephemeralPubkeyYParity: ephemeral[0] as number,
      ciphertext: `0x${body.toString('hex')}` as Hex,
      nonce: `0x${nonce.toString('hex')}` as Hex,
      tag: `0x${cipher.getAuthTag().toString('hex')}` as Hex,
    },
    opening: `0x${ecdh.getPrivateKey().toString('hex')}` as Hex,
  }
}

const health = (await call<{ chain_id: number; settlement_token: { address: Address } }>('/health')).body
const token = getAddress(health.settlement_token.address)

step('A shop charges $1.00')
const shop = newCustomer().address
const opened = await call<{ secret_key?: string; key?: string }>('/v1/merchants', {
  method: 'POST',
  body: JSON.stringify({ name: 'Private Test Kitchen', settlement_address: shop, country: 'NG' }),
})
const shopKey = opened.body.secret_key ?? opened.body.key
expect(shopKey, `open shop: ${JSON.stringify(opened.body)}`)
const charge = await call<{ id: string; pay_to: Address }>('/v1/payment_intents', {
  method: 'POST',
  token: shopKey,
  body: JSON.stringify({ amount: '1.00', currency: 'USDC', reference: 'Puff-puff' }),
})
expect(charge.status === 201, `charge: ${JSON.stringify(charge.body)}`)
ok(`charge ${charge.body.id}, paying ${charge.body.pay_to}`)

step('A customer pays it privately: a sealed deposit into the zone, for the shop')
const customer = newCustomer()
await fund(api, customer.address)
const client = walletFor(api, health.chain_id, customer, token)
const { keyIndex, publicKey } = await Actions.zone.getEncryptionKey(client as never, { portalAddress: portal, zoneId } as never)
const sealed = seal(publicKey as { prefix: number; x: Hex }, charge.body.pay_to, keyIndex)
const deposit = (sealedFor: typeof sealed) =>
  client.sendTransactionSync({
    calls: [
      { to: token, data: encodeFunctionData({ abi: Abis.tip20, functionName: 'approve', args: [portal, 1_000_000n] }) },
      { to: portal, data: encodeFunctionData({ abi: sandboxPortal, functionName: 'depositEncrypted', args: [token, 1_000_000n, keyIndex, sealedFor.encrypted] }) },
    ],
    feePayer: true,
  } as never)
const receipt = await deposit(sealed)
expect(receipt.status === 'success', 'deposit reverted')
ok(`deposited, fee paid by Ren: ${receipt.transactionHash}`)
const shown = receipt.logs.some((log) => log.topics.some((t) => t?.toLowerCase().includes(charge.body.pay_to.slice(2).toLowerCase())))
ok(`Tempo’s logs ${shown ? 'NAME' : 'don’t name'} the shop`)

step('A wrong key is refused')
const wrong = await call<{ error?: { message: string } }>(`/v1/checkout/${charge.body.id}/private`, {
  method: 'POST',
  body: JSON.stringify({ tx_hash: receipt.transactionHash, opening: `0x${randomBytes(32).toString('hex')}` }),
})
expect(wrong.status === 400, `wrong key: ${JSON.stringify(wrong.body)}`)
ok(`refused: ${wrong.body.error?.message}`)

step('The customer hands Ren the deposit’s one-time key: the charge turns to paid')
const proved = await call<{ status: string; error?: unknown }>(`/v1/checkout/${charge.body.id}/private`, {
  method: 'POST',
  body: JSON.stringify({ tx_hash: receipt.transactionHash, opening: sealed.opening }),
})
expect(proved.body.status === 'paid', `prove: ${JSON.stringify(proved.body)}`)
const checkout = (await call<{ status: string; payment: { tx_hash: string } | null }>(`/v1/checkout/${charge.body.id}`)).body
ok(`the charge is ${checkout.status}, by ${checkout.payment?.tx_hash}`)

step('A deposit for someone else can’t pay this shop’s next charge')
const charge2 = await call<{ id: string }>('/v1/payment_intents', {
  method: 'POST',
  token: shopKey,
  body: JSON.stringify({ amount: '1.00', currency: 'USDC', reference: 'Chin chin' }),
})
const elsewhere = seal(publicKey as { prefix: number; x: Hex }, customer.address, keyIndex)
const receipt2 = await deposit(elsewhere)
const stolen = await call<{ error?: { message: string } }>(`/v1/checkout/${charge2.body.id}/private`, {
  method: 'POST',
  body: JSON.stringify({ tx_hash: receipt2.transactionHash, opening: elsewhere.opening }),
})
expect(stolen.status === 400, `someone else's deposit: ${JSON.stringify(stolen.body)}`)
ok(`refused: ${stolen.body.error?.message}`)
console.log('\nAll private checks passed.')
process.exit(0)
