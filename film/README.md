# Kova films

Launch films for Kova, rendered with [Remotion](https://www.remotion.dev) from the app's real
screens, its painted art (Kovi) and one real day of payments on Monad testnet.

- `KovisDay`: "Kovi's day", the 40-second intro teaser (1920 x 1080).
- `KovaCard`: the 1200 x 630 link preview used by mykova.app (`apps/web/src/app/opengraph-image.png`).

Every timing lives in `src/cues.json`, which both the picture and the score read.

## Render

```bash
npm install
node --env-file=.env scripts/voiceover.mjs          # needs ELEVENLABS_API_KEY in film/.env
python3 scripts/score.py                             # music and effects, synthesised (numpy, scipy)
npx remotion render KovisDay out/kovis-day-silent.mp4
node scripts/mix.mjs                                 # voice over score, -14 LUFS, muxed for X
npx remotion still KovaCard out/og-kova.png          # the link preview
```

`scripts/voiceover.mjs` also takes a voice id and an output folder, to audition other voices.
The screens in `public/screens` are captures from the iOS app and mykova.app; the art in
`public/art` is the app's own (`apps/mobile/assets/art`).
