// "Kova OS for stores": mixes the voice over the score (public/audio/score.wav), masters to -14 LUFS / -1 dBTP in two
// passes, and muxes the audio into the rendered picture for X: H.264 High, yuv420p, AAC, faststart.
// Run from film/: python3 scripts/score-os.py && node scripts/mix-os.mjs
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const cues = JSON.parse(readFileSync('src/store/store-cues.json', 'utf8'))
const vo = JSON.parse(readFileSync('public/store/audio/vo.json', 'utf8'))
// The score sits about 7 dB under the voice between lines, and further under it while it speaks.
const SCORE_GAIN = Number(process.env.SCORE_GAIN ?? 0.45)
// ElevenLabs' clips sit near -27 dBFS in speech; lift them clear of the music.
const VOICE_GAIN = Number(process.env.VOICE_GAIN ?? 1.8)
const run = (cmd) => execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 << 20 }).toString()

const inputs = ['-i public/store/audio/score.wav', ...vo.lines.map((l) => `-i public/${l.file}`)].join(' ')
const voices = vo.lines
  .map((l, i) => {
    const ms = Math.round(cues.vo[l.id] * 1000)
    return `[${i + 1}]aresample=48000,aformat=channel_layouts=stereo,adelay=${ms}|${ms},volume=${VOICE_GAIN}[v${i}]`
  })
  .join(';')
const graph = `${voices};[0]volume=${SCORE_GAIN}[s];[s]${vo.lines.map((_, i) => `[v${i}]`).join('')}amix=inputs=${vo.lines.length + 1}:normalize=0:duration=first[m]`

// Master: measure the raw mix, apply one fixed gain to reach -14 LUFS, and let a limiter catch only
// the short peaks (bells, whooshes). loudnorm alone switches to dynamic compression when the gain
// it needs would push peaks past its ceiling, which flattens the voice into the music.
const raw = run(`ffmpeg -hide_banner ${inputs} -filter_complex "${graph};[m]ebur128=peak=true" -f null - 2>&1`)
const rawI = Number([...raw.matchAll(/I:\s+(-?[0-9.]+) LUFS/g)].at(-1)[1])
const gain = -14 - rawI + 0.4 // the limiter shaves a little loudness off the peaks
run(`ffmpeg -loglevel error -y ${inputs} -filter_complex "${graph};[m]volume=${gain.toFixed(2)}dB,alimiter=limit=0.79:attack=3:release=60:level=false[out]" -map "[out]" -ar 48000 out/store-audio.wav`)
const m = { input_i: rawI }

run(
  'ffmpeg -loglevel error -y -i out/kova-store-silent.mp4 -i out/store-audio.wav -map 0:v -map 1:a ' +
    '-vf scale=in_range=pc:out_range=tv,format=yuv420p -color_range tv -c:v libx264 -profile:v high -crf 16 -preset slow -r 30 ' +
    '-c:a aac -b:a 192k -movflags +faststart -shortest out/kova-store.mp4',
)

const check = run('ffmpeg -hide_banner -i out/kova-store.mp4 -af loudnorm=print_format=json -f null - 2>&1')
const c = JSON.parse(check.slice(check.lastIndexOf('{'), check.lastIndexOf('}') + 1))
console.log(`out/kova-store.mp4: ${c.input_i} LUFS integrated, ${c.input_tp} dBTP peak (input was ${m.input_i} LUFS)`)
