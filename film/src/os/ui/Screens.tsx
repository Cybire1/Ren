/** Compositions for each live screen, so they can be checked alone and rendered to video. */
import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { CustomerPaidUI, CustomerTapUI } from './CustomerUI'
import { FPS } from './kit'
import { OrdersUI } from './OrdersUI'
import { SellUI } from './SellUI'
import { TerminalPaidUI, TerminalSellUI } from './TerminalUI'
import { TodayUI } from './TodayUI'
import cues from '../os-cues.json'

const live = (Ui: (p: { t: number }) => React.ReactNode) =>
  function Screen() {
    const t = useCurrentFrame() / FPS
    return (
      <AbsoluteFill>
        <Ui t={t} />
      </AbsoluteFill>
    )
  }

export const SellScreen = live(SellUI)
export const OrdersScreen = live(OrdersUI)
export const TodayScreen = live(TodayUI)
export const CustomerTapScreen = live(CustomerTapUI)
export const CustomerPaidScreen = live(CustomerPaidUI)
export const TerminalSellScreen = live(TerminalSellUI)
export const TerminalPaidScreen = live(TerminalPaidUI)

/*
 * Reels for the 3D devices' screens: each is rendered to a JPEG sequence in public/os/live/<name>
 * (scripts/reels-os.sh) and shown on the model frame by frame, in step with the shot it plays in.
 */
const cueAt = (t: number, at: number) => t - at

/** The Register's screen through the title shot: the sale tapped in on the beat. */
export function RegisterReel() {
  const t = useCurrentFrame() / FPS
  return <SellUI t={t} />
}

/** The customer display through the pay shot: the order to pay, the card lands, Paid. */
export function CustomerReel() {
  const t = useCurrentFrame() / FPS
  const paid = cues.paid - cues.shots.pay
  return t < paid ? <CustomerTapUI t={t} /> : <CustomerPaidUI t={cueAt(t, paid)} />
}

/** The Terminal's screen through the hand shot: a sale on the floor, then Paid. */
export function TerminalReel() {
  const t = useCurrentFrame() / FPS
  const paid = cues.handPaid - cues.shots.hand
  return t < paid ? <TerminalSellUI t={t} /> : <TerminalPaidUI t={cueAt(t, paid)} />
}
