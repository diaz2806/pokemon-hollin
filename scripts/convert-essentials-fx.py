"""
Efectos de Essentials para el combate y el mundo, a resolución de DS (mitad):

  assets/animations/<nombre>.png   hojas de animaciones de ataques (celdas de 96 px, 5 columnas)
  assets/fogs/<nombre>.png         niebla/humo que se repite (Weather/fog_tile*, Fogs/*)
  assets/ui/battle/ball_<x>.png    Poké Balls de combate y su versión abierta

Uso: python3 scripts/convert-essentials-fx.py <carpeta Graphics de Essentials> assets
"""
import os
import re
import sys
from PIL import Image

GRAPHICS, OUT = sys.argv[1], sys.argv[2]


def slug(name: str) -> str:
    return re.sub(r'[^a-z0-9]+', '_', os.path.splitext(name)[0].lower()).strip('_') or 'exclaim'


def half(src: str, dst: str) -> None:
    im = Image.open(src).convert('RGBA')
    im.resize((max(1, im.width // 2), max(1, im.height // 2)), Image.NEAREST).save(dst)


def main() -> None:
    n = 0
    anim_dir = os.path.join(OUT, 'animations')
    os.makedirs(anim_dir, exist_ok=True)
    for f in os.listdir(os.path.join(GRAPHICS, 'Animations')):
        if f.lower().endswith('.png'):
            half(os.path.join(GRAPHICS, 'Animations', f), os.path.join(anim_dir, slug(f) + '.png'))
            n += 1
    fog_dir = os.path.join(OUT, 'fogs')
    os.makedirs(fog_dir, exist_ok=True)
    for f in ('fog_tile.png', 'fog_tile_2.png'):
        half(os.path.join(GRAPHICS, 'Weather', f), os.path.join(fog_dir, slug(f) + '.png'))
        n += 1
    for f in os.listdir(os.path.join(GRAPHICS, 'Fogs')):
        if f.lower().endswith('.png'):
            Image.open(os.path.join(GRAPHICS, 'Fogs', f)).convert('RGBA').save(os.path.join(fog_dir, slug(f) + '.png'))
            n += 1
    battle_dir = os.path.join(OUT, 'ui', 'battle')
    os.makedirs(battle_dir, exist_ok=True)
    src = os.path.join(GRAPHICS, 'Battle animations')
    for f in os.listdir(src):
        if f.lower().startswith(('ball_poke', 'ballburst_')) and f.lower().endswith('.png'):
            half(os.path.join(src, f), os.path.join(battle_dir, slug(f) + '.png'))
            n += 1
    # Iconos de categoría (físico / especial / estado), 3 filas
    half(os.path.join(GRAPHICS, 'UI', 'category.png'), os.path.join(OUT, 'ui', 'category.png'))
    n += 1
    print(f'{n} archivos en {OUT}')


if __name__ == '__main__':
    main()
