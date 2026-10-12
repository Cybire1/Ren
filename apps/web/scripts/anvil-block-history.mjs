// Local tests only (docs/zones.md): keeps EIP-2935 block-hash history on Anvil in Tempo mode, which
// a Tempo node keeps and Anvil does not. Without it a zone cannot settle batches. Slot = block % 8191.
//   node scripts/anvil-block-history.mjs [http://127.0.0.1:8545]
const RPC = process.argv[2] ?? 'http://127.0.0.1:8545'
const HISTORY = '0x0000F90827F1C53a10cb7A02335B175320002935'
let id = 0
const rpc = async (method, params) => {
  const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }) })
  const j = await r.json(); if (j.error) throw new Error(j.error.message); return j.result
}
let next = 1n
for (;;) {
  try {
    const head = BigInt(await rpc('eth_blockNumber', []))
    if (next < head - 8000n) next = head - 8000n
    for (; next <= head; next++) {
      const block = await rpc('eth_getBlockByNumber', ['0x' + next.toString(16), false])
      const slot = '0x' + (next % 8191n).toString(16).padStart(64, '0')
      await rpc('anvil_setStorageAt', [HISTORY, slot, block.hash])
    }
  } catch (e) { console.error(String(e.message ?? e)) }
  await new Promise((r) => setTimeout(r, 300))
}
