import { encodeFunctionData, type Hex, keccak256, type LocalAccount } from 'viem'
import { Abis, Transaction as TempoTransaction } from 'viem/tempo'
import { Signature } from 'ox'
import { SignatureEnvelope } from 'ox/tempo'

/**
 * Paying on Tempo from a wallet Kova didn't make (the email/Google wallet, or any browser wallet).
 *
 * - An email/Google wallet (Privy) can sign a raw hash (`secp256k1_sign`), which is how Tempo's own
 *   Accounts SDK drives it. That makes it a full Tempo signer: it signs the same relayed
 *   transaction Kova Pay does, and Kova pays the fee.
 * - A browser wallet (MetaMask, Rabby…) speaks plain Ethereum. It sends the charge as an ordinary
 *   transaction calling `transferWithMemo` on the dollar; Tempo takes the fee (under a cent) in that
 *   same dollar, since there is no gas token. Kova's watcher settles it like any other payment.
 */

interface Eip1193 {
  request(args: { method: string; params?: unknown }): Promise<unknown>
}

/** A viem account for a Privy embedded wallet that signs Tempo transactions through `secp256k1_sign`. */
export function rawSigningAccount(address: `0x${string}`, provider: Eip1193): LocalAccount {
  const sign = async ({ hash }: { hash: Hex }) => {
    const signature = await provider.request({ method: 'secp256k1_sign', params: [hash] })
    if (typeof signature !== 'string' || !signature.startsWith('0x'))
      throw new Error('Your wallet didn’t sign. Nothing was paid.')
    return signature as Hex
  }
  return {
    address,
    publicKey: '0x',
    source: 'privy',
    type: 'local',
    sign,
    async signTransaction(transaction) {
      // The fee payer signs after us, so our hash never covers its signature.
      const presign =
        transaction &&
        typeof transaction === 'object' &&
        'feePayerSignature' in transaction &&
        transaction.feePayerSignature
          ? { ...transaction, feePayerSignature: null }
          : transaction
      const unsigned = await TempoTransaction.serialize(presign as never)
      const signature = await sign({ hash: keccak256(unsigned as Hex) })
      return (await TempoTransaction.serialize(
        transaction as never,
        SignatureEnvelope.from(Signature.fromHex(signature)) as never,
      )) as Hex
    },
    async signMessage({ message }) {
      return (await provider.request({
        method: 'personal_sign',
        params: [typeof message === 'string' ? message : message.raw, address],
      })) as Hex
    },
    async signTypedData(typedData) {
      return (await provider.request({
        method: 'eth_signTypedData_v4',
        params: [address, JSON.stringify(typedData)],
      })) as Hex
    },
  } as LocalAccount
}

/** The call a browser wallet sends to pay a charge: `transferWithMemo` of exactly the charge. */
export function chargeCall(checkout: {
  token: string
  pay_to: string
  amount_base: string
  memo: string
}) {
  return {
    to: checkout.token as `0x${string}`,
    data: encodeFunctionData({
      abi: Abis.tip20,
      functionName: 'transferWithMemo',
      args: [checkout.pay_to as `0x${string}`, BigInt(checkout.amount_base), checkout.memo as Hex],
    }),
  }
}
