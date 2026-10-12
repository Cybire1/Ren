# Ren's private zone on Tempo testnet: Tempo's own zone node, pinned to the release Ren's genesis
# was generated with, plus that genesis. Deployed as its own Railway service with a volume at /data
# (the zone's only copy of its ledger); the sequencer key arrives as a variable, never in the image.
#
#   railway up infra/zone --path-as-root --service zone --environment production
#
# genesis.json comes from `tempo-xtask create-zone --creation-tx <hash>` once Tempo has created the
# zone (docs/zones.md). The node and the genesis must come from the same zones commit.
FROM ghcr.io/tempoxyz/tempo-zone:sha-700069e

COPY genesis.json /zone/genesis.json
COPY start.sh /zone/start.sh

ENTRYPOINT ["/bin/sh", "/zone/start.sh"]
