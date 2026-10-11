#!/bin/zsh
# Renders Kova Point's flat artwork to public/atm/, for the 3D model (src/atm/KovaPoint3D.tsx).
set -e
out=public/atm
mkdir -p $out
still() { npx remotion still "$1" "$out/$2.png" --props="${3:-{\}}" --log=error }
for s in tap menu send done cash; do still AtmScreen screen-$s "{\"screen\":\"$s\"}"; done
still AtmSign sign
still AtmDecal decal
still AtmTapPad tappad
for k in 1 2 3 4 5 6 7 8 9 0; do still AtmKey key-$k "{\"label\":\"$k\",\"tone\":\"paper\"}"; done
still AtmKey key-cancel '{"label":"×","tone":"coral"}'
still AtmKey key-ok '{"label":"✓","tone":"teal"}'
npx remotion still CardFront $out/card-main.png --props='{"id":"main"}' --image-format=png --log=error
echo done
