import { Composition, Still } from 'remotion'
import { DURATION, KovisDay } from './KovisDay'
import { FPS } from './motion'
import { OgCard } from './OgCard'
import './theme'

export const RemotionRoot = () => (
  <>
    <Composition id="KovisDay" component={KovisDay} durationInFrames={DURATION * FPS} fps={FPS} width={1920} height={1080} />
    {/* The link preview for mykova.app. */}
    <Still id="KovaCard" component={OgCard} width={1200} height={630} />
  </>
)
