/**
 * Sprites oficiales opcionales. NUNCA se suben al repositorio (assets/ está en
 * .gitignore): si existen en local, el juego los usa; si no, usa placeholders.
 *
 * Estructura esperada (nombres en minúscula o MAYÚSCULA, como en los packs de
 * Pokémon Essentials):
 *
 *   assets/pokemon/front/growlithe.png     sprite de frente (cuadrado o tira animada)
 *   assets/pokemon/back/growlithe.png      sprite de espalda
 *   assets/pokemon/followers/growlithe.png hoja 4x4 estilo RPG Maker: filas abajo, izquierda, derecha, arriba
 *   assets/pokemon/icons/growlithe.png     icono del menú de equipo (opcional)
 */
import * as Phaser from 'phaser';
import { toId } from '../battle/dex-service';

// Vite resuelve esto al compilar: solo incluye los ficheros que existan.
const files = import.meta.glob('/assets/pokemon/**/*.png', { eager: true, query: '?url', import: 'default' }) as Record<
  string,
  string
>;

export type AssetKind = 'front' | 'back' | 'followers' | 'icons';

const index = new Map<string, string>();
for (const [path, url] of Object.entries(files)) {
  const m = /\/assets\/pokemon\/(front|back|followers|icons)\/([^/]+)\.png$/i.exec(path);
  if (m) index.set(`${m[1].toLowerCase()}:${toId(m[2])}`, url);
}

export function officialAssetCount(): number {
  return index.size;
}

export function assetUrl(kind: AssetKind, species: string): string | undefined {
  return index.get(`${kind}:${toId(species)}`);
}

export function assetKey(kind: AssetKind, species: string): string {
  return `official-${kind}-${toId(species)}`;
}

/** Encola en el loader de Phaser todos los sprites oficiales disponibles. */
export function queueOfficialAssets(scene: Phaser.Scene): void {
  for (const [key, url] of index) {
    const [kind, id] = key.split(':') as [AssetKind, string];
    const texKey = `official-${kind}-${id}`;
    if (kind === 'followers') {
      // Se carga como imagen y se trocea al terminar (el tamaño de fotograma depende del pack).
      scene.load.image(`${texKey}-raw`, url);
    } else {
      scene.load.image(texKey, url);
    }
  }
}

/** Trocea las hojas de seguidores (4x4) en spritesheets una vez cargadas. */
export function sliceFollowerSheets(scene: Phaser.Scene): void {
  for (const key of index.keys()) {
    const [kind, id] = key.split(':');
    if (kind !== 'followers') continue;
    const raw = scene.textures.get(`official-followers-${id}-raw`);
    const img = raw.getSourceImage() as HTMLImageElement;
    const fw = Math.floor(img.width / 4);
    const fh = Math.floor(img.height / 4);
    scene.textures.addSpriteSheet(`official-followers-${id}`, img, { frameWidth: fw, frameHeight: fh });
  }
}

export function hasTexture(scene: Phaser.Scene, kind: AssetKind, species: string): boolean {
  return scene.textures.exists(assetKey(kind, species));
}
