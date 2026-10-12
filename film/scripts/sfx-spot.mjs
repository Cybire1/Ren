// Sound for "Every table is a counter" (TableSpot): one-off effects and a light music bed from
// ElevenLabs (Sound Effects and Music, paid plan: commercial use), written to public/spot/sfx/.
// Run: env -u ELEVENLABS_API_KEY node --env-file=.env scripts/sfx-spot.mjs [name ...]
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'

const KEY = process.env.ELEVENLABS_API_KEY
if (!KEY) throw new Error('ELEVENLABS_API_KEY missing (film/.env)')
const OUT = 'public/spot/sfx'
mkdirSync(OUT, { recursive: true })

const EFFECTS = {
  type: ['Soft, quiet laptop keyboard typing, light clean keystrokes, close mic, no room', 2.2],
  tick: ['A single tiny soft UI tick, clean minimal interface click', 0.5],
  pop: ['Soft rounded UI pop, gentle bubble, clean and modern', 0.5],
  scan: ['Short digital glitch sweep, scanlines, soft data transition, modern tech ad', 0.8],
  whoosh: ['Smooth airy whoosh transition, soft and premium, short', 1.0],
  rise: ['Short soft riser into a gentle impact, modern minimal tech ad transition', 1.6],
  faceid: ['Apple Pay style success confirmation, two soft rising notes, clean', 1.0],
  ready: ['Warm friendly notification chime, three soft bell notes, café order ready, pleasant', 1.6],
  buzz: ['Phone vibrating twice on a wooden table, short buzz buzz', 1.0],
  stamp: ['Soft rubber stamp thud on paper, satisfying, close', 0.6],
  cards: ['Paper cards fanning out quickly, crisp paper slide', 0.8],
  sparkle: ['Gentle magical sparkle shimmer, short and soft, not harsh', 1.2],
  thud: ['Deep soft cinematic low impact, warm, minimal tech logo hit', 1.6],
}

async function effect(name, [text, seconds]) {
  const file = `${OUT}/${name}.mp3`
  if (existsSync(file) && !process.argv.includes(name)) return
  const res = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ text, duration_seconds: seconds, prompt_influence: 0.6 }),
  })
  if (!res.ok) throw new Error(`${name}: ${res.status} ${await res.text()}`)
  writeFileSync(file, Buffer.from(await res.arrayBuffer()))
  console.log('wrote', file)
}

async function music() {
  const file = `${OUT}/music.mp3`
  if (existsSync(file) && !process.argv.includes('music')) return
  const res = await fetch('https://api.elevenlabs.io/v1/music', {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
    body: JSON.stringify({
      prompt:
        'Minimal, airy, premium tech product ad bed. 100 BPM. Soft muted plucks, warm sub, light clicky percussion, lots of space, optimistic and calm, builds gently and resolves on a warm final chord. Instrumental, no vocals.',
      music_length_ms: 35000,
    }),
  })
  if (!res.ok) throw new Error(`music: ${res.status} ${await res.text()}`)
  writeFileSync(file, Buffer.from(await res.arrayBuffer()))
  console.log('wrote', file)
}

const only = process.argv.slice(2)
for (const [name, spec] of Object.entries(EFFECTS)) if (!only.length || only.includes(name)) await effect(name, spec)
if (!only.length || only.includes('music')) await music()
