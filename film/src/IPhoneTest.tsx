import { AbsoluteFill } from 'remotion'
import { IPhone } from './iphone'
import { C } from './theme'

/** A bench for the iPhone: flat, tilted and turned, side by side. */
export function IPhoneTest() {
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      <IPhone src="shop/tomas-run2/stall.png" h={820} x={380} y={520} />
      <IPhone src="shop/tomas-run2/share.png" h={820} x={960} y={520} ry={-22} rx={8} />
      <IPhone src="shop/tomas-run2/home.png" h={820} x={1540} y={520} rotate={6} ry={14} />
    </AbsoluteFill>
  )
}
