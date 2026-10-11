"""Imports the Kova card designs from the design canvas (project/*.dc.html) into src/cards/markup.json,
with each uploaded image swapped for its file in public/art. Run: python3 scripts/import-cards.py <canvas folder>"""
import json, re, sys
from pathlib import Path

ART = {
    'd2111ac7cc3174e7da75375af3917279': 'kovi-ride.png',
    'e35904c2907ebfc3501ff3751677ae05': 'kovi-wave.png',
    '3bc4d054f7f2fcf451908ff556815a56': 'kovi-cheer.png',
    '8034fa8bb6f686d97007f54607197bfe': 'kovi-peek.png',
    '86fb4e53edfa0dd04682659b7a89c0c5': 'coin-usd.png',
    '49b874f0e8074bb9e231d32ef52ffbe8': 'coin-eur.png',
    '02d730a785a7aaa0900897f3f2f4fa64': 'badge-shop.png',
    '1f6f6d5093f58344fd68d3914d3b576b': 'sparkle-4.png',
    '43cc7dadb2ffb485cf8f61c770f270b7': 'sparkle-1.png',
    '82719be45712cacd12abdb27efe4ca7d': 'qr-ink.png',
    'c09d5f0038f9dc7283f6f0619cf27d45': 'qr-paper.png',
    '8d68529c6bf3eb298010c886fed643a7': 'scene-welcome.png',
}
CARDS = {'main': 'Main', 'coral': 'Coral', 'metal': 'Metal', 'drop': 'Drop', 'night': 'Night', 'open': 'Open', 'back': 'Back'}

root = Path(sys.argv[1]) / 'project'
out = {}
for key, name in CARDS.items():
    html = (root / f'{name}.dc.html').read_text()
    body = html.split('</helmet>', 1)[1].split('</x-dc>', 1)[0].strip()
    body = re.sub(r'/_blob/([0-9a-f]{32})', lambda m: '{{art}}' + ART[m.group(1)], body)
    size = re.search(r'width: (\d+)px; height: (\d+)px', body)
    out[key] = {'w': int(size.group(1)), 'h': int(size.group(2)), 'html': body}
    missing = re.findall(r'/_blob/', body)
    assert not missing, f'{key}: unmapped image'
Path('src/cards/markup.json').write_text(json.dumps(out, indent=1, ensure_ascii=False) + '\n')
print({k: (v['w'], v['h']) for k, v in out.items()})
