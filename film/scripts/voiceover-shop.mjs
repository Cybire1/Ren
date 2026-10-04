// Voiceover for "Your shop is a link" (Tomás' Weaves): one ElevenLabs request per line, with character timings turned into
// word timings for the captions. Run: node --env-file=.env scripts/voiceover.mjs [voiceId] [outDir]
// Writes <outDir>/vo-<n>.mp3 and <outDir>/vo.json (durations and words, in seconds).
import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'

export const LINES = [
  { id: 'village', say: 'High in the mountains, Tomás weaves blankets. Each one takes three weeks.' },
  { id: 'world', say: 'People everywhere would buy them. But the nearest bank is two days away, and no card company will have him.' },
  { id: 'shop', say: 'So Tomás opened a shop on Kova. Photo by photo, and it was ready in a minute.' },
  { id: 'link', say: 'Now his whole shop is one link. He sends it out into the world.' },
  { id: 'buyers', say: 'Yuki, in Tokyo, buys a blanket. Lena, in Berlin, a scarf. Sam, in New York, a runner and a pouch.' },
  { id: 'paid', say: 'Each one pays in dollars, in about a second. No bank. No card fees.' },
  { id: 'today', say: 'Today, Tomás took ninety-five dollars.' },
  {
    id: 'end',
    say: 'Kova. Your shop is a link. Open yours at my kova dot app.',
    show: { spoken: ['my', 'kova', 'dot', 'app'], text: 'mykova.app' },
  },
]

// George: a warm British storyteller. Pass another voice id to audition.
const voiceId = process.argv[2] ?? 'JBFqnCBsd6RMkjVDRZzb'
const outDir = process.argv[3] ?? 'public/shop/audio'
const key = process.env.ELEVENLABS_API_KEY
if (!key) throw new Error('ELEVENLABS_API_KEY is missing (film/.env)')
mkdirSync(outDir, { recursive: true })

const duration = (file) =>
  Number(execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${file}"`).toString().trim())

/** Character timings to words: each word runs from its first letter to its last. */
function words(alignment, show) {
  const out = []
  let current = null
  alignment.characters.forEach((ch, i) => {
    const start = alignment.character_start_times_seconds[i]
    const end = alignment.character_end_times_seconds[i]
    if (/\s/.test(ch)) {
      if (current) out.push(current)
      current = null
      return
    }
    if (!current) current = { text: '', start, end }
    current.text += ch
    current.end = end
  })
  if (current) out.push(current)
  if (!show) return out
  // Swap a spoken run ("my kova dot app") for what the captions show ("mykova.app").
  const bare = (w) => w.text.replace(/[^a-z]/gi, '').toLowerCase()
  const at = out.findIndex((_, i) => show.spoken.every((s, j) => out[i + j] && bare(out[i + j]) === s))
  if (at < 0) return out
  const last = out[at + show.spoken.length - 1]
  return [...out.slice(0, at), { text: show.text, start: out[at].start, end: last.end }, ...out.slice(at + show.spoken.length)]
}

const lines = []
for (const [i, line] of LINES.entries()) {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: { 'xi-api-key': key, 'content-type': 'application/json' },
      body: JSON.stringify({
        text: line.say,
        model_id: 'eleven_multilingual_v2',
        previous_text: LINES[i - 1]?.say,
        next_text: LINES[i + 1]?.say,
        voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true },
      }),
    },
  )
  if (!response.ok) throw new Error(`${line.id}: ${response.status} ${await response.text()}`)
  const body = await response.json()
  const file = `${outDir}/vo-${i + 1}.mp3`
  writeFileSync(file, Buffer.from(body.audio_base64, 'base64'))
  lines.push({ id: line.id, file: file.replace(/^public\//, ''), duration: duration(file), words: words(body.alignment, line.show) })
  console.log(`${line.id}: ${lines.at(-1).duration.toFixed(2)} s`)
}
writeFileSync(`${outDir}/vo.json`, `${JSON.stringify({ voiceId, lines }, null, 2)}\n`)
