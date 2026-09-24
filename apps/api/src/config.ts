import { z } from 'zod'

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().default('postgres://localhost:5432/kova_dev'),
  /** Which Tempo network this instance serves. One process serves one network. */
  KOVA_NETWORK: z.enum(['mainnet', 'testnet']).default('testnet'),
  /** Overrides the default public RPC (use a provider endpoint in production). */
  TEMPO_RPC_URL: z.string().url().optional(),
  /**
   * Fee payer key. Kova pays every user's gas, so this key spends real money: in production
   * it belongs in a KMS, and this env var is for local development only.
   */
  KOVA_FEE_PAYER_PRIVATE_KEY: z
    .string()
    .regex(/^0x[0-9a-fA-F]{64}$/)
    .optional(),
  /**
   * Hard cap on the fee Kova will sponsor for one transaction, in base units.
   *
   * A normal mainnet payment costs about $0.00005, and a first payment to a merchant who has
   * never held the token about $0.0002, so $0.05 leaves a wide margin while still bounding
   * what a single request can cost Kova. Moderato's fee estimates run far higher than
   * mainnet's, so testnet deployments raise this.
   */
  KOVA_MAX_SPONSORED_FEE: z.coerce.bigint().default(50_000n),
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
