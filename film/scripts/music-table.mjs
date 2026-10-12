// Score for "Every table is a counter" (TableFilm), from ElevenLabs Music, timed to its cuts.
// Run: env -u ELEVENLABS_API_KEY node --env-file=.env scripts/music-table.mjs
import { writeFileSync } from 'node:fs'

const res = await fetch('https://api.elevenlabs.io/v1/music', {
  method: 'POST',
  headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'content-type': 'application/json' },
  body: JSON.stringify({
    prompt: [
      'Instrumental score for a 34-second premium tech commercial set in a café,.',
      '0-10s: sparse and a little weary: a soft muted piano note repeating, quiet room tone, a slow clock-like pulse.',
      '10-12.5s: a held breath, the piano stops, one rising note.',
      '12.5-24s: a warm, optimistic indie groove starts exactly at 12.5s: plucked guitar, soft kick, claps, 100 BPM, feel-good.',
      '24-30s: lifts with bright piano and handclaps, joyful.',
      '30-34s: lands on a warm final chord that rings out. No vocals.',
    ].join(' '),
    music_length_ms: 34000,
  }),
})
if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
writeFileSync('public/queue/hf/music.mp3', Buffer.from(await res.arrayBuffer()))
console.log('wrote public/queue/hf/music.mp3')
