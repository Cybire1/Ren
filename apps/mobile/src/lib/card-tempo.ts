import { readCardKey, signWithCard } from '@kova/monad'
import { PublicKey, Signature } from 'ox'
import { type Address, getAddress, type Hex, hexToNumber, parseUnits, slice } from 'viem'
import { Account } from 'viem/tempo'
import { CardError, withCard } from './card'
import { walletClient } from './chain-tempo'
import { apiUrl, onTempo, settlementToken } from './config'

/**
 * The Ren Card on Tempo: the chip's own key is an access key on its holder's wallet, with a daily
 * limit Tempo enforces (lib/keys-state.ts puts it on-chain, kind "card"). Linking reads the chip's
 * key; a tap at the till reads the card, asks Ren whose wallet it spends, builds the payment from
 * that wallet, and has the chip sign it, all in one NFC session. Ren's relay pays the fee.
 */

export const tempoCards = onTempo

/** Reads a card to link it: the chip's key, as an address and an uncompressed public key. */
export function readCardToLink() {
  return withCard('Hold your Ren Card to the top of the iPhone', (transceive) => readCardKey(transceive), 'Card read')
}

interface TillCard {
  key_id: Address
  holder: Address
  label: string
  status: 'active' | 'frozen' | 'revoked' | 'expired'
  left_today: string
}

async function cardAt(keyId: Address): Promise<TillCard> {
  const response = await fetch(`${apiUrl}/v1/key-cards/${keyId}`)
  const body = (await response.json().catch(() => ({}))) as TillCard & { error?: { message?: string } }
  if (!response.ok) throw new CardError(body.error?.message ?? 'This card isn’t linked to a Ren wallet.', response.status)
  return body
}

/**
 * A tap at the till pays a Ren charge from the card's wallet: exactly the charge, with its memo, so
 * it settles like any other payment. The chip signs the transaction's own digest.
 */
export async function tapToPay(charge: { amount: string; pay_to: string; memo: string }): Promise<Hex> {
  return withCard(
    'Hold the Ren Card to the top of the iPhone',
    async (transceive) => {
      const { address: keyId, publicKey } = await readCardKey(transceive)
      const card = await cardAt(keyId)
      if (card.status === 'frozen') throw new CardError('This card is frozen. Its owner can unfreeze it in Ren.', 403)
      if (card.status !== 'active') throw new CardError('This card can’t pay any more. Its owner can link it again.', 403)
      const amount = parseUnits(charge.amount, 6)
      if (Number(card.left_today) < Number(charge.amount))
        throw new CardError(`That’s over this card’s daily limit. It can spend $${card.left_today} more today.`, 403)
      const account = Account.from({
        access: card.holder,
        keyType: 'secp256k1',
        publicKey: PublicKey.fromHex(publicKey),
        async sign({ hash }: { hash: Hex }) {
          const { signature } = await signWithCard(transceive, hash)
          // r ‖ s ‖ v from the chip (s already low), as viem's own secp256k1 keys sign.
          return Signature.toHex({
            r: BigInt(slice(signature, 0, 32)),
            s: BigInt(slice(signature, 32, 64)),
            yParity: hexToNumber(slice(signature, 64, 65)) - 27,
          })
        },
      })
      const { receipt } = await walletClient(account as never).token.transferSync({
        token: settlementToken.address,
        to: getAddress(charge.pay_to),
        amount,
        memo: charge.memo as Hex,
        feePayer: true,
      } as never)
      if (receipt.status !== 'success') throw new CardError('Tempo didn’t take the payment. Nothing moved.', 0)
      return receipt.transactionHash as Hex
    },
    'Paid',
  )
}
