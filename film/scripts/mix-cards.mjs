// Masters "Pick a card": the score to -14 LUFS with one fixed gain and a peak limiter, muxed for X.
import { execSync } from 'node:child_process'

const run = (cmd) => execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 << 20 }).toString()
// Glue and tone: gentle bus compression, warmth at 110 Hz, less box at 350 Hz, air at 11 kHz.
const tone = 'acompressor=threshold=-20dB:ratio=2:attack=25:release=220:makeup=1,equalizer=f=110:t=q:w=0.8:g=1.5,equalizer=f=350:t=q:w=1.2:g=-1.5,equalizer=f=11000:t=q:w=0.9:g=1.5'
// Measured after the tone chain, so the final gain lands on -14 LUFS.
const raw = run(`ffmpeg -hide_banner -i public/audio/cards-score.wav -af "${tone},ebur128=peak=true" -f null - 2>&1`)
const rawI = Number([...raw.matchAll(/I:\s+(-?[0-9.]+) LUFS/g)].at(-1)[1])
const gain = -14 - rawI + 0.4
run(
  `ffmpeg -loglevel error -y -i out/kova-cards-silent.mp4 -i public/audio/cards-score.wav -map 0:v -map 1:a ` +
      `-af "${tone},volume=${gain.toFixed(2)}dB,alimiter=limit=0.79:attack=3:release=60:level=false" ` +
    '-vf scale=in_range=pc:out_range=tv,format=yuv420p -color_range tv -c:v libx264 -profile:v high -crf 16 -preset slow -r 30 ' +
    '-c:a aac -b:a 320k -ar 48000 -movflags +faststart -shortest out/kova-cards.mp4',
)
const check = run('ffmpeg -hide_banner -i out/kova-cards.mp4 -af loudnorm=print_format=json -f null - 2>&1')
const c = JSON.parse(check.slice(check.lastIndexOf('{'), check.lastIndexOf('}') + 1))
console.log(`out/kova-cards.mp4: ${c.input_i} LUFS, ${c.input_tp} dBTP`)
