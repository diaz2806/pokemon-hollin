"""
Recorta casillas de los tilesets de Essentials y las deja a resolución de DS (16 px)
en assets/tiles/<clave>.png. El juego las usa como "piel" de los mapas de texto:
si una clave existe, se dibuja en vez del arte procedural.

Uso: python3 scripts/build-tile-skins.py <carpeta Graphics de Essentials> <akizakura.png> assets/tiles

Cada entrada de SKINS es (hoja, columna, fila) en casillas de 32 px del tileset original,
o ('auto', archivo, fotograma) para el centro de un autotile de RPG Maker XP.
"""
import os
import sys
from PIL import Image

GRAPHICS, AKI, OUT = sys.argv[1], sys.argv[2], sys.argv[3]

SHEETS = {
    'out': os.path.join(GRAPHICS, 'Tilesets', 'Outside.png'),
    'fac': os.path.join(GRAPHICS, 'Tilesets', 'Factory interior.png'),
    'int': os.path.join(GRAPHICS, 'Tilesets', 'Interior general.png'),
    'aki': AKI,
}

# clave -> lista de variantes (se elige por posición en el mapa)
SKINS: dict[str, list[tuple]] = {
    # Calle: ladrillo en espiga (autotile "Brick path")
    'cobble': [('auto', 'Brick path.png', 0)],
    # Callejones con humo (zona de encuentros): grava oscura
    'smoke': [('auto', 'Gravel.png', 0)],
    'dirt': [('auto', 'Dirt.png', 0)],
    # Muelle del canal: piedra clara
    'quay': [('auto', 'White path.png', 0)],
    # Agua animada: 4 fotogramas del autotile de mar
    'water': [('auto', 'Sea.png', 0), ('auto', 'Sea.png', 2), ('auto', 'Sea.png', 4), ('auto', 'Sea.png', 6)],
    # Tejados de chapa azul pizarra
    'roof_top': [('out', 1, 234), ('out', 2, 234)],
    'roof': [('out', 1, 234), ('out', 3, 234)],
    # Interiores (Gen 4 de Akizakura): parqué, suelo de piedra de fábrica, pared con zócalo
    'wood': [('aki', 0, 88)],
    'metal': [('aki', 0, 92)],
    'wall_top': [('aki', 1, 222), ('aki', 2, 222)],
    'wall_low': [('aki', 1, 223), ('aki', 2, 223)],
}


def tile(spec) -> Image.Image:
    if spec[0] == 'auto':
        im = Image.open(os.path.join(GRAPHICS, 'Autotiles', spec[1])).convert('RGBA')
        fx = spec[2] * 96
        t = im.crop((fx + 32, 64, fx + 64, 96))
    else:
        im = Image.open(SHEETS[spec[0]]).convert('RGBA')
        c, r = spec[1], spec[2]
        t = im.crop((c * 32, r * 32, c * 32 + 32, r * 32 + 32))
    return t.resize((16, 16), Image.NEAREST)


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    count = 0
    for key, variants in SKINS.items():
        for i, spec in enumerate(variants):
            tile(spec).save(os.path.join(OUT, f'{key}_{i}.png'))
            count += 1
    print(f'{count} casillas en {OUT}')


if __name__ == '__main__':
    main()
