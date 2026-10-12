// Music and effects for "The Queue": an ElevenLabs Music score timed to src/queue/queue-cues.json,
// and a few effects; written to public/queue/sfx/. Run: env -u ELEVENLABS_API_KEY node --env-file=.env scripts/sound-queue.mjs [name …]
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'

const KEY = process.env.ELEVENLABS_API_KEY
if (!KEY) throw new Error('ELEVENLABS_API_KEY missing (film/.env)')
const OUT = 'public/queue/sfx'
mkdirSync(OUT, { recursive: true })
const only = process.argv.slice(2)
const want = (name) => (only.length ? only.includes(name) : !existsSync(`${OUT}/${name}.mp3`))

const EFFECTS = {
  shuffle: ['A crowd of people shuffling forward one step together on a hard café floor, a few footsteps, short', 1.2],
  steps: ['Small light cartoon footsteps, quick and bouncy, on a wooden floor', 2.0],
  coin: ['A single gold coin flipping through the air and landing with a bright satisfying video game coin collect sound', 1.0],
  ding: ['Warm café order ready chime, a friendly two-note bell, pleasant and clear', 1.4],
  stamp: ['Video game coin collect pickup, bright and short, satisfying', 0.6],
  reward: ['Video game power-up reward jingle, short, joyful, sparkly', 1.6],
  sign: ['A metal sign spinning around quickly on its pole, a soft whoosh and a clack', 1.0],
  murmur: ['Quiet indoor café crowd murmur, waiting, low and soft, no clear words', 8.0],
  blip: ['Retro video game dialogue text blip, soft single tone', 0.5],
}

for (const [name, [text, seconds]] of Object.entries(EFFECTS)) {
  if (!want(name)) continue
  const res = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ text, duration_seconds: seconds, prompt_influence: 0.6 }),
  })
  if (!res.ok) throw new Error(`${name}: ${res.status} ${await res.text()}`)
  writeFileSync(`${OUT}/${name}.mp3`, Buffer.from(await res.arrayBuffer()))
  console.log('wrote', name)
}

if (want('music')) {
  const res = await fetch('https://api.elevenlabs.io/v1/music', {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
    body: JSON.stringify({
      prompt: [
        'Instrumental score for a 46-second animated short about a café queue, like a charming indie video game soundtrack.',
        '0-10s: stiff, mechanical and a bit dull: a ticking clock, a plodding muted bass and a repetitive four-note music-box loop, like waiting music.',
        '10-17s: the loop thins out and pauses curiously, a single plucked question.',
        '17-29s: a warm, playful marimba and pizzicato groove kicks in at 104 BPM with light claps, optimistic.',
        '29-35s: the groove gets bouncier with sparkling bells, building.',
        '35-41s: a joyful build with strings and handclaps, everyone joining in.',
        '41-46s: resolves on a warm, satisfying final chord and a gentle bell. No vocals.',
      ].join(' '),
      music_length_ms: 46000,
    }),
  })
  if (!res.ok) throw new Error(`music: ${res.status} ${await res.text()}`)
  writeFileSync(`${OUT}/music.mp3`, Buffer.from(await res.arrayBuffer()))
  console.log('wrote music')
}
