/**
 * Private notes must open the same way in the app and on the web: one passkey, one note key, and
 * a note sealed on either side opens on the other, for its receiver and its sender, and for no one
 * else or any other transfer.
 *   pnpm --filter @kova/web check:notes
 */
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import {
  noteKeys as appKeys,
  openNote as appOpen,
  sealNote as appSeal,
} from '../../mobile/src/lib/notes-core'
import { noteKeys, openNote, sealNote } from '../src/lib/wallet/notes'

const assert = (ok: unknown, what: string) => {
  if (!ok) throw new Error(`FAILED: ${what}`)
  console.log(`ok  ${what}`)
}

const secret = () => crypto.getRandomValues(new Uint8Array(32))
const [ada, tunde, eve] = [secret(), secret(), secret()]
const transfer = {
  from: privateKeyToAccount(generatePrivateKey()).address,
  to: privateKeyToAccount(generatePrivateKey()).address,
  value: 2_500_000n,
  nonce: `0x${'ab'.repeat(32)}` as const,
}

assert(
  noteKeys(ada).publicKey === appKeys(ada).publicKey,
  'the app and the web derive the same note key from one vault secret',
)

const fromApp = appSeal('Puff-puff 🍩', transfer, {
  mine: appKeys(ada).publicKey,
  theirs: appKeys(tunde).publicKey,
})
assert(
  openNote(fromApp, transfer, noteKeys(tunde).secretKey) === 'Puff-puff 🍩',
  'a note sealed in the app opens on the web for its receiver',
)
assert(
  openNote(fromApp, transfer, noteKeys(ada).secretKey) === 'Puff-puff 🍩',
  'and for its sender',
)
assert(openNote(fromApp, transfer, noteKeys(eve).secretKey) === null, 'and not for anyone else')
assert(
  openNote(fromApp, { ...transfer, value: 2_500_001n }, noteKeys(tunde).secretKey) === null,
  'and not with another transfer',
)

const fromWeb = sealNote('Rent, October', transfer, {
  mine: noteKeys(ada).publicKey,
  theirs: noteKeys(tunde).publicKey,
})
assert(
  appOpen(fromWeb, transfer, appKeys(tunde).secretKey) === 'Rent, October',
  'a note sealed on the web opens in the app',
)

const selfOnly = sealNote('Just for me', transfer, { mine: noteKeys(ada).publicKey, theirs: null })
assert(
  selfOnly.to === '' && openNote(selfOnly, transfer, noteKeys(ada).secretKey) === 'Just for me',
  'with no note key on their side, the sender can still read it',
)
assert(!JSON.stringify(fromApp).includes('Puff'), 'the sealed note carries no plaintext')
