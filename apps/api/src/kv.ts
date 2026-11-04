import { schema, uuidv7 } from '@kova/db'
import { and, count, eq, gt, lt, sql } from 'drizzle-orm'
import { Store } from 'mppx/server'
import { db } from './db.js'

/**
 * Short-lived memory the API shares across restarts and instances, in Postgres (kv_store and
 * sponsorships): replay claims, MPP's store, and the daily caps on the fees Ren pays.
 */

const DAY_MS = 86_400_000

/** Serializes work on one key across every instance, for the length of the transaction. */
const lockKey = (tx: Pick<typeof db, 'execute'>, key: string) =>
  tx.execute(sql`select pg_advisory_xact_lock(hashtext(${key}))`)

const live = (key: string) =>
  and(
    eq(schema.kvStore.key, key),
    sql`(${schema.kvStore.expiresAt} is null or ${schema.kvStore.expiresAt} > now())`,
  )

/**
 * Records the first use of `key` until `expiresAt` (Unix ms): true the first time, false while an
 * earlier claim is still live. One signed message, one use, whatever instance it reaches.
 */
export async function claimOnce(key: string, expiresAt: number): Promise<boolean> {
  if (expiresAt <= Date.now()) return false
  const rows = await db
    .insert(schema.kvStore)
    .values({ key, value: true, expiresAt: new Date(expiresAt) })
    .onConflictDoUpdate({
      target: schema.kvStore.key,
      set: { value: true, expiresAt: new Date(expiresAt) },
      setWhere: lt(schema.kvStore.expiresAt, new Date()),
    })
    .returning({ key: schema.kvStore.key })
  return rows.length === 1
}

/** MPP's store (replay protection for payment credentials), kept in Postgres. */
export function mppStore(prefix: string) {
  return Store.from(
    {
      async get(key: string) {
        const [row] = await db.select().from(schema.kvStore).where(live(key))
        return (row?.value as never) ?? null
      },
      async put(key: string, value: unknown) {
        await db
          .insert(schema.kvStore)
          .values({ key, value: value as object, expiresAt: null })
          .onConflictDoUpdate({
            target: schema.kvStore.key,
            set: { value: value as object, expiresAt: null },
          })
      },
      async delete(key: string) {
        await db.delete(schema.kvStore).where(eq(schema.kvStore.key, key))
      },
      async update<result>(
        key: string,
        fn: (current: unknown) => Store.Change<unknown, result>,
      ): Promise<result> {
        return db.transaction(async (tx) => {
          await lockKey(tx, key)
          const [row] = await tx.select().from(schema.kvStore).where(live(key))
          const change = fn(row?.value ?? null)
          if (change.op === 'set')
            await tx
              .insert(schema.kvStore)
              .values({ key, value: change.value as object, expiresAt: null })
              .onConflictDoUpdate({
                target: schema.kvStore.key,
                set: { value: change.value as object, expiresAt: null },
              })
          if (change.op === 'delete')
            await tx.delete(schema.kvStore).where(eq(schema.kvStore.key, key))
          return change.result
        })
      },
      tryClaim: (key: string, expires: number) => claimOnce(key, expires),
    },
    { keyPrefix: prefix },
  )
}

/**
 * Takes one of a wallet's daily sponsored fees of this kind: true and recorded while it's under
 * `max` in the last day, false once it's used up.
 */
export async function takeSponsorship(
  wallet: string,
  kind: 'send' | 'key' | 'swap',
  max: number,
): Promise<boolean> {
  const who = wallet.toLowerCase()
  return db.transaction(async (tx) => {
    await lockKey(tx, `sponsor:${kind}:${who}`)
    const [row] = await tx
      .select({ n: count() })
      .from(schema.sponsorships)
      .where(
        and(
          eq(schema.sponsorships.wallet, who),
          eq(schema.sponsorships.kind, kind),
          gt(schema.sponsorships.createdAt, new Date(Date.now() - DAY_MS)),
        ),
      )
    if ((row?.n ?? 0) >= max) return false
    await tx.insert(schema.sponsorships).values({ id: uuidv7(), wallet: who, kind })
    return true
  })
}

/** Forgets what's past use: expired claims, and sponsorships older than the caps look back. */
export async function sweep() {
  await db.delete(schema.kvStore).where(lt(schema.kvStore.expiresAt, new Date()))
  await db
    .delete(schema.sponsorships)
    .where(lt(schema.sponsorships.createdAt, new Date(Date.now() - 2 * DAY_MS)))
}
