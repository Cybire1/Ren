import { z } from 'zod'

/** Nuvion's sandbox, where nothing moves, and its live API, which moves people's money. */
export const NUVION_SANDBOX_URL = 'https://api.nuvion.dev'
export const NUVION_LIVE_URL = 'https://api.nuvion.co'

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().default('postgres://localhost:5432/kova_dev'),
  /** Which chain this instance runs on. Kova is one codebase on Tempo and on Monad. */
  KOVA_CHAIN: z.enum(['tempo', 'monad']).default('tempo'),
  /** Which network of that chain. One process serves one chain and one network. */
  KOVA_NETWORK: z.enum(['mainnet', 'testnet']).default('testnet'),
  /** Override the default public RPC (use a provider endpoint in production). */
  TEMPO_RPC_URL: z.string().url().optional(),
  MONAD_RPC_URL: z.string().url().optional(),
  /** Ren's site: shown as the sponsor of the fees Ren pays, and used in links the API writes. */
  KOVA_PUBLIC_WEB_URL: z.string().url().default('https://renpay.app'),
  /**
   * Kova's fee payer. On Tempo it co-signs the fee half of payments people sign (it never signs a
   * payment); on Monad it submits the authorizations people sign and pays the MON gas. Either way
   * it never holds anyone's money but spends on every payment: in production it belongs in a
   * KMS, and this env var is for local development only.
   */
  KOVA_FEE_PAYER_PRIVATE_KEY: z
    .string()
    .regex(/^0x[0-9a-fA-F]{64}$/)
    .optional(),
  /**
   * Hard cap on the gas the relayer will spend on one payment. Monad charges for the gas limit a
   * transaction asks for, not the gas it uses, so the relayer asks for its estimate plus a small
   * margin, and refuses anything that estimates above this.
   */
  KOVA_MAX_RELAY_GAS: z.coerce.bigint().default(200_000n),
  /**
   * Tempo: the most Kova will pay in fees for one sponsored transaction, in micro-dollars
   * (1,000,000 = $1). A sponsor pays for reverted transactions too, so the cap bounds any abuse.
   * Testnet fee estimates run far above mainnet's, so testnet needs a higher cap.
   */
  KOVA_MAX_SPONSORED_FEE: z.coerce.bigint().default(50_000n),
  /** Tempo: sends between people Kova pays the fee for, per wallet per day. Charges are unlimited. */
  KOVA_SPONSORED_SENDS_A_DAY: z.coerce.number().int().nonnegative().default(50),
  /**
   * Tempo: the portal of the private zone (Tempo Zones) whose deposits Ren's fee payer pays for:
   * moving dollars into your private balance, or sending them privately. Set it to the zone the
   * web wallet uses (KOVA_ZONE_PORTAL there too). Unset, Ren pays for no zone deposits.
   */
  /** The zone's id at its portal (Tempo's testnet Zone A is 6). */
  KOVA_ZONE_ID: z.coerce.number().int().positive().default(6),
  KOVA_ZONE_PORTAL: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/)
    .optional(),
  /**
   * Monad: KovaRates, the reference exchange rates a Chainlink CRE workflow publishes. CRE does not
   * reach Tempo, so a Tempo deployment reads the same public rate sources directly.
   */
  KOVA_RATES_ADDRESS: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/)
    .optional(),
  /**
   * The sites a shop can sign in from with its wallet, comma-separated, as a signed message names
   * them (host, and port if any). Defaults to mykova.app and the Railway web service, plus
   * localhost outside production. A signature made for any other site is refused.
   */
  KOVA_SIGN_IN_DOMAINS: z.string().optional(),
  /**
   * Shared with Kova's website, which calls on its visitors' behalf from one address: with it, the
   * site can say which visitor is asking, so per-address limits count people, not the site.
   */
  KOVA_PROXY_SECRET: z.string().min(32).optional(),
  /** How long a payment intent stays payable. */
  KOVA_INTENT_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  /**
   * Reads menu photos into catalogue items ("Snap your menu"): Claude with an Anthropic key, or
   * DeepSeek with a DeepSeek key. With neither, that feature says so.
   */
  ANTHROPIC_API_KEY: z.string().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
  /** Which one reads menus when both keys are set. Unset: Anthropic if its key is there, else DeepSeek. */
  KOVA_MENU_PROVIDER: z.enum(['anthropic', 'deepseek']).optional(),
  /** Defaults to claude-sonnet-5 on Anthropic and deepseek-flash (its vision model) on DeepSeek. */
  KOVA_MENU_MODEL: z.string().optional(),
  /** Kova Travel: flights and hotels through Duffel. A duffel_test_ token runs in Duffel's test mode. */
  DUFFEL_API_KEY: z.string().optional(),
  /**
   * Where Kova Travel's payments settle. On testnet it defaults to the fee payer's address;
   * on mainnet it must be set, to a wallet Kova's treasury controls.
   */
  KOVA_TRAVEL_SETTLEMENT_ADDRESS: z.string().optional(),
  /** Jev, TypeSafe's decision model: spending categories, order-note flags, duplicate items, offer matching. */
  TYPESAFE_API_KEY: z.string().optional(),
  /** Aurora Intents (NEAR Intents): deposits from other chains, landing on Monad. Key from studio.aurora.dev. */
  AURORA_INTENTS_KEY: z.string().optional(),
  /** What deposits arrive as on Monad: a symbol Aurora resolves, or an asset id when the symbol is ambiguous. */
  AURORA_DESTINATION_ASSET: z.string().default('AUSD'),
  /** Ramp Network: card and bank top-ups (and cash-out), buying AUSD on Monad. Key from partner@ramp.network. */
  RAMP_HOST_API_KEY: z.string().optional(),
  JEV_MODEL: z.string().optional(),
  /**
   * USSD pockets: pay from any phone by dialling a code. The master key seals each pocket's own
   * key at rest (32 bytes, hex); in production it belongs in a KMS. Without it, USSD is off.
   */
  KOVA_POCKET_MASTER_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/)
    .optional(),
  /** The secret path segment Africa's Talking calls back on: /v1/ussd/<secret>. */
  KOVA_USSD_CALLBACK_SECRET: z.string().min(16).optional(),
  /** The code people dial, as the app shows it. */
  KOVA_USSD_CODE: z.string().default('*384*25891#'),
  /** Africa's Talking: USSD sessions and SMS receipts. Username "sandbox" uses their simulator. */
  AT_USERNAME: z.string().optional(),
  AT_API_KEY: z.string().optional(),
  /** An approved sender name for SMS; unset uses Africa's Talking's default. */
  AT_SENDER_ID: z.string().optional(),
  /**
   * The App Review demo account (testnet only): a username and password that open one shared
   * test wallet whose 32-byte secret stands in for a passkey. Unset, there is no demo account.
   */
  KOVA_DEMO_USERNAME: z.string().min(3).optional(),
  KOVA_DEMO_PASSWORD: z.string().min(8).optional(),
  KOVA_DEMO_SECRET: z
    .string()
    .regex(/^0x[0-9a-fA-F]{64}$/)
    .optional(),
  /**
   * Kova Card: the key that cosigns every tap after Kova's checks (PIN, freeze). It can only
   * refuse payments, never make one: each also needs the card's own signature. Without it, cards
   * are off. Rotate with KovaCard.setCosigner.
   */
  KOVA_CARD_COSIGNER_KEY: z
    .string()
    .regex(/^0x[0-9a-fA-F]{64}$/)
    .optional(),
  /**
   * Keys (Tempo): seals each AI agent's key at rest and signs the tokens wallets and agents sign in
   * with, and MPP's challenges (32 bytes, hex; a KMS in production). Without it, keys are off.
   */
  KOVA_KEYS_MASTER_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/)
    .optional(),
  /** Paystack (test or live secret key): naira in for paying a shop, naira out for cashing out. */
  PAYSTACK_SECRET_KEY: z.string().startsWith('sk_').optional(),
  /** Naira per dollar Ren quotes against the market rate: a cash-out gets this much less. */
  KOVA_NAIRA_SPREAD: z.coerce.number().min(0).max(0.1).default(0.01),
  /**
   * Nuvion: the dollar card and cash-outs abroad. Each card holder passes Nuvion's ID check once and
   * gets a virtual USD card with its own account. A top-up is dollars sent to Ren's treasury on
   * Tempo (the fee payer's wallet), then the same amount moved by book transfer from Ren's own USD
   * account at Nuvion (NUVION_POT_ACCOUNT). Both are off until the key and the pot are set, and stay
   * off when the key or URL is Nuvion's live one on a test network (nuvionProblem, below).
   */
  NUVION_API_KEY: z.string().optional(),
  NUVION_API_URL: z.string().url().default(NUVION_SANDBOX_URL),
  NUVION_POT_ACCOUNT: z.string().optional(),
  /** The most a wallet can put on its card in a day, in base units: $100. */
  KOVA_CARD_DAILY_TOPUP: z.string().regex(/^\d+$/).default('100000000'),
  /** Ren's fee on each top-up, in basis points: 50 is 0.5%, paid on top of what lands on the card. */
  KOVA_CARD_TOPUP_FEE_BPS: z.coerce.number().int().min(0).max(1000).default(50),
  /**
   * Ren's owners, who are on Nuvion already as Ren's own business and so can't pass its ID check
   * again as customers: wallet addresses, comma-separated. Their cards are issued under Ren's own
   * approved business, in the name KOVA_CARD_OWNER_NAME.
   */
  KOVA_CARD_OWNER_WALLETS: z.string().optional(),
  KOVA_CARD_OWNER_NAME: z.string().default('Ren Team'),
  /** Ren's fee on a cash-out through Nuvion, in basis points of what the wallet sends (0: none). */
  KOVA_PAYOUT_FEE_BPS: z.coerce.number().int().min(0).max(1000).default(0),
  /**
   * Cash-outs abroad in the person's own name (services/payouts.ts). `1`: a first cash-out needs the
   * ID check (the dollar card's), accounts are saved under the person's own Nuvion entity, and each
   * payout leaves from their own account, which Ren's pot funds for it. `0`: Ren's pot pays, as Ren.
   */
  KOVA_PAYOUTS_OWN_NAME: z.enum(['0', '1']).default('0'),
})

export type Config = z.infer<typeof schema>

export const config: Config = schema.parse(process.env)

export const isProduction = config.NODE_ENV === 'production'

/**
 * Why Nuvion must stay off with these settings, or null when it may run.
 *
 * Ren on a test network moves test dollars, and Nuvion's live API moves people's money: a live key
 * there would pay out bank transfers and fund cards against dollars worth nothing. So off mainnet
 * only Nuvion's sandbox is allowed, named exactly: its URL and an `nv_test_` key. Anything else (the
 * live URL, an `nv_live_` key, a URL or key Ren doesn't recognise) is refused. On mainnet either
 * works, since a sandbox there costs nobody anything.
 */
export function nuvionProblem(
  settings: Pick<Config, 'KOVA_NETWORK' | 'NUVION_API_KEY' | 'NUVION_API_URL'> = config,
): string | null {
  if (settings.KOVA_NETWORK === 'mainnet') return null
  let origin: string
  try {
    origin = new URL(settings.NUVION_API_URL).origin
  } catch {
    return 'NUVION_API_URL isn’t a URL.'
  }
  if (origin !== NUVION_SANDBOX_URL)
    return `On a test network Ren talks only to Nuvion’s sandbox (${NUVION_SANDBOX_URL}), never ${origin}.`
  const key = settings.NUVION_API_KEY
  if (key && !key.startsWith('nv_test_'))
    return 'On a test network Ren takes only a Nuvion sandbox key (nv_test_…), never a live one.'
  return null
}

/** Whether Nuvion's key and pot are set and allowed on this network: the card and cash-outs' switch. */
export function nuvionReady(
  settings: Pick<
    Config,
    'KOVA_NETWORK' | 'NUVION_API_KEY' | 'NUVION_API_URL' | 'NUVION_POT_ACCOUNT'
  > = config,
): boolean {
  return Boolean(
    settings.NUVION_API_KEY && settings.NUVION_POT_ACCOUNT && nuvionProblem(settings) === null,
  )
}
