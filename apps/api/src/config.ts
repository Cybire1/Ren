import { z } from 'zod'

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
  JEV_MODEL: z.string().optional(),
})

export type Config = z.infer<typeof schema>

export const config: Config = schema.parse(process.env)

export const isProduction = config.NODE_ENV === 'production'
