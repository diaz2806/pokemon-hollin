"""Uso: python3 scripts/convert-essentials-pack.py <carpeta Graphics del pack> assets/pokemon

Convierte el Generation 9 Pack (Essentials, 2x/3x) a la resolución de Pokémon Hollín (DS).

front 192 -> 96 (/2), back 288 -> 96 (/3), icons 128x64 -> 64x32 (/2), followers 4x4 -> /2.
Solo formas base (sin _1, _female, shiny). Escalado NEAREST: los sprites son pixel art
ampliado a múltiplos exactos, así que se recupera el píxel original sin pérdidas.
"""
import os, re, sys
from PIL import Image

SRC, DST = sys.argv[1], sys.argv[2]
JOBS = [
    ('Pokemon/Front', 'front', 2),
    ('Pokemon/Back', 'back', 3),
    ('Pokemon/Icons', 'icons', 2),
    ('Characters/Followers', 'followers', 2),
]
ALIASES = {'NIDORANfE': 'nidoranf', 'NIDORANmA': 'nidoranm'}
count = {}
for src_dir, kind, factor in JOBS:
    out = os.path.join(DST, kind)
    os.makedirs(out, exist_ok=True)
    n = 0
    for f in os.listdir(os.path.join(SRC, src_dir)):
        stem, ext = os.path.splitext(f)
        if ext.lower() != '.png' or '_' in stem or stem == '000':
            continue
        name = ALIASES.get(stem, re.sub(r'[^a-z0-9]', '', stem.lower()))
        im = Image.open(os.path.join(SRC, src_dir, f)).convert('RGBA')
        w, h = im.size
        im = im.resize((max(1, w // factor), max(1, h // factor)), Image.NEAREST)
        im.save(os.path.join(out, name + '.png'), optimize=True)
        n += 1
    count[kind] = n
print(count)
