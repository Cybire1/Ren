#!/bin/sh
# Renders the live screens for the Shop OS film's 3D devices to JPEG sequences in public/os/live.
# Run from film/: sh scripts/reels-os.sh
set -e
for reel in RegisterReel CustomerReel TerminalReel; do
  rm -rf "public/os/live/$reel"
  npx remotion render src/index.ts "$reel" "public/os/live/$reel" --sequence --image-format=jpeg --jpeg-quality=90 --log=error
done
