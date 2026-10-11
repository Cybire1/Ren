#!/bin/zsh
# One buyer in the Kova iOS app, for "Your shop is a link": a fresh dev wallet on the Kova simulator,
# dollars from the film funder, then the shop link with a filled bag, which places the order and pays
# it by itself (dev hooks in s/[slug].tsx and pay/[id].tsx). Screens are taken every ~0.6 s, so the
# film can pick the storefront, the bag, paying and Paid.
#   scripts/capture/app-buyer.sh <name> <USD|EUR|…> <dollars> "<item>*<qty>;…" "<note>" <out dir>
# Needs Metro on :8081 logging to /tmp/kova-metro.log, and film/.env with FILM_FUNDER_KEY.
set -e
name=$1 cur=$2 usd=$3 bag=$4 note=$5 out=$6
SIM=CDE8188D-03D6-4189-BB00-44DED78F0E9F
APP=xyz.kova.pay.monad
AUSD=0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC
RPC=https://testnet-rpc.monad.xyz
enc() { python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1],safe=""))' "$1"; }
mkdir -p "$out"
source "${0:A:h}/../../.env"

launch() {
  xcrun simctl terminate $SIM $APP 2>/dev/null || true
  xcrun simctl launch $SIM $APP -KovaDevLink "$1" >/dev/null
  sleep 8
  xcrun simctl openurl $SIM "$APP://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"
}

# A new wallet for this buyer (or WALLET=0x… to reuse the one already on the simulator).
if [[ -n $WALLET ]]; then
  address=$WALLET
else
mark=$(wc -l </tmp/kova-metro.log)
launch "reset=1&name=$name&fake=1&cur=$cur&to=/"
# The dev link runs once per bundle load, so a reset can make two wallets: wait for the log to settle
# and take the wallet made by the last "creating wallet".
sleep 14
address=$(tail -n +$((mark + 1)) /tmp/kova-metro.log | awk '/\[dev\] creating wallet/{w=""} /\[dev\] wallet 0x/{if(w=="")w=$NF} END{print w}')
[[ -n $address ]] || { echo "no wallet"; exit 1; }
fi
echo "WALLET $address"

# Dollars from the film funder.
~/.foundry/bin/cast send $AUSD 'transfer(address,uint256)' $address $((usd * 1000000)) \
  --private-key $FILM_FUNDER_KEY --rpc-url $RPC >/dev/null
echo "FUNDED $usd AUSD"
sleep 4

# The shop link, a filled bag, and paying.
to="/s/tomas-weaves?bag=$(enc "$bag")&note=$(enc "$note")&checkout=1"
launch "cur=$cur&to=$(enc "$to")"
for i in {1..45}; do
  xcrun simctl io $SIM screenshot --type=png "$out/$(printf %02d $i).png" >/dev/null 2>&1
  sleep 0.4
done
echo "SHOTS $out"
