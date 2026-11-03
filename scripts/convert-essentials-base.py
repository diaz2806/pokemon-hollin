"""Convierte los gráficos y el audio de Pokémon Essentials (y packs compatibles) a Pokémon Hollín.

Uso:
  python3 -I scripts/convert-essentials-base.py \
      --graphics "<Essentials>/Graphics" \
      --audio "<Essentials>/Audio" \
      --ows "<Gen 4 OWs v1.5 - Vanilla Sunshine>" \
      --cries "<Generation 9 Pack>/Audio/SE/Cries" \
      --items "<Generation 9 Pack>/Graphics/Items" \
      --out assets

Essentials trabaja a 512x384 (el doble que la DS); el juego, a 256x192. Todo lo gráfico se
reduce a la mitad con NEAREST, que en pixel art ampliado x2 recupera el píxel original.
Los .mid no se copian: el navegador no reproduce MIDI.
"""
import argparse
import os
import re
import shutil

from PIL import Image


def slug(name: str) -> str:
    return re.sub(r'[^a-z0-9_]+', '_', name.lower()).strip('_')


def half(src: str, dst: str) -> None:
    im = Image.open(src).convert('RGBA')
    w, h = im.size
    im = im.resize((max(1, w // 2), max(1, h // 2)), Image.NEAREST)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    im.save(dst, optimize=True)


def pngs(folder: str):
    for f in sorted(os.listdir(folder)):
        if f.lower().endswith('.png'):
            yield f, os.path.join(folder, f)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--graphics', required=True)
    ap.add_argument('--audio', required=True)
    ap.add_argument('--ows', required=True)
    ap.add_argument('--cries')
    ap.add_argument('--items')
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    out = a.out
    counts = {}

    def count(k):
        counts[k] = counts.get(k, 0) + 1

    # Personajes de mapa (Gen 4): hojas 4x4 estilo RPG Maker.
    for f, p in pngs(a.ows):
        if f.startswith('phone') or 'fish' in f:
            continue
        half(p, os.path.join(out, 'characters', slug(f[:-4]) + '.png'))
        count('characters')

    g = a.graphics
    # Ventanas de texto y de opciones.
    for f, p in pngs(os.path.join(g, 'Windowskins')):
        if f.startswith(('speech hgss', 'speech pl', 'choice', 'sign hgss')):
            half(p, os.path.join(out, 'ui', 'windowskins', slug(f[:-4]) + '.png'))
            count('windowskins')
    # Interfaz de combate, mochila y comunes.
    for sub in ['Battle', 'Bag']:
        for f, p in pngs(os.path.join(g, 'UI', sub)):
            half(p, os.path.join(out, 'ui', sub.lower(), slug(f[:-4]) + '.png'))
            count('ui/' + sub.lower())
    for f in ['types.png', 'statuses.png', 'sel_arrow.png', 'pause_arrow.png']:
        p = os.path.join(g, 'UI', f)
        if os.path.exists(p):
            half(p, os.path.join(out, 'ui', slug(f[:-4]) + '.png'))
            count('ui')
    # Fondos de combate.
    for f, p in pngs(os.path.join(g, 'Battlebacks')):
        half(p, os.path.join(out, 'battlebacks', slug(f[:-4]) + '.png'))
        count('battlebacks')
    # Entrenadores en combate.
    for f, p in pngs(os.path.join(g, 'Trainers')):
        half(p, os.path.join(out, 'trainers', slug(f[:-4]) + '.png'))
        count('trainers')
    # Objetos (iconos de la mochila).
    if a.items:
        for f, p in pngs(a.items):
            if '_' in f[:-4] and not f[:-4].isupper():
                continue
            half(p, os.path.join(out, 'items', slug(f[:-4]) + '.png'))
            count('items')

    # Audio (solo .ogg).
    for kind in ['BGM', 'ME', 'SE']:
        src = os.path.join(a.audio, kind)
        for f in sorted(os.listdir(src)):
            if f.lower().endswith('.ogg'):
                dst = os.path.join(out, 'audio', kind.lower(), slug(f[:-4]) + '.ogg')
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                shutil.copyfile(os.path.join(src, f), dst)
                count('audio/' + kind.lower())
    if a.cries:
        for f in sorted(os.listdir(a.cries)):
            stem, ext = os.path.splitext(f)
            if ext.lower() != '.ogg' or '_' in stem:
                continue
            dst = os.path.join(out, 'audio', 'cries', re.sub(r'[^a-z0-9]', '', stem.lower()) + '.ogg')
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.copyfile(os.path.join(a.cries, f), dst)
            count('audio/cries')
    print(counts)


if __name__ == '__main__':
    main()
