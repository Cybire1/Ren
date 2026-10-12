#!/bin/sh
# Starts Ren's zone node (see Dockerfile). Everything it needs comes from Railway variables:
#   ZONE_SEQUENCER_KEY  the sequencer's private key (secret). It signs every batch Ren settles on
#                       Tempo, so its address needs a little pathUSD there for fees.
#   ZONE_PORTAL         the zone's portal on Tempo (0x5ad0… followed by the zone id)
#   L1_RPC_URL          Tempo's WebSocket RPC (wss://rpc.moderato.tempo.xyz on testnet)
#   PORT                the port Railway routes to: the zone's private (redacted) RPC
#
# Only the redacted RPC is public: it answers a wallet only about itself, with a token the wallet
# signs. The node's own RPC sees every balance, so it listens on localhost and nothing else.
set -eu

: "${ZONE_SEQUENCER_KEY:?set ZONE_SEQUENCER_KEY}"
: "${ZONE_PORTAL:?set ZONE_PORTAL}"

umask 077
printf '%s' "$ZONE_SEQUENCER_KEY" > /tmp/sequencer.key

exec /usr/local/bin/tempo-zone node \
  --chain /zone/genesis.json \
  --l1.rpc-url "${L1_RPC_URL:-wss://rpc.moderato.tempo.xyz}" \
  --l1.portal-address "$ZONE_PORTAL" \
  --http \
  --http.addr 127.0.0.1 \
  --http.port 8546 \
  --http.api eth,net,web3 \
  --redacted-rpc.port "${PORT:-8544}" \
  --datadir /data/node \
  --log.file.directory /data/logs \
  --sequencer \
  --sequencer-key-file /tmp/sequencer.key
