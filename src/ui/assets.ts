/**
 * Sprites oficiales opcionales. NUNCA se suben al repositorio público (assets/ está
 * en .gitignore): si existen en local, el juego los usa; si no, usa placeholders.
 *
 * Estructura (ya convertida a la resolución del juego con scripts/convert-essentials-pack.py):
 *
 *   assets/pokemon/front/growlithe.png      96x96, frente
 *   assets/pokemon/back/growlithe.png       96x96, espalda
 *   assets/pokemon/followers/growlithe.png  hoja 4x4 (abajo, izquierda, derecha, arriba)
 *   assets/pokemon/icons/growlithe.png      2 fotogramas cuadrados en horizontal
 *
 * Se cargan bajo demanda (solo las especies que aparecen), no todas al arrancar.
 */
import * as Phaser from 'phaser';
import { speciesBaseId, toId } from '../battle/dex-service';

// Vite resuelve esto al compilar: solo incluye los ficheros que existan.
const files = import.meta.glob('/assets/pokemon/**/*.png', { query: '?url', import: 'default', eager: true }) as Record<
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

/**
 * id del fichero que se usa para una especie. Las formas sin sprite propio
 * (p. ej. Sandile de Ashbury) usan el de su especie base.
 */
function resolveId(kind: AssetKind, species: string): string | undefined {
  const own = toId(species);
  if (index.has(`${kind}:${own}`)) return own;
  const base = speciesBaseId(species);
  if (index.has(`${kind}:${base}`)) return base;
  return undefined;
}

export function hasAsset(kind: AssetKind, species: string): boolean {
  return resolveId(kind, species) !== undefined;
}

export function assetKey(kind: AssetKind, species: string): string {
  return `official-${kind}-${resolveId(kind, species) ?? toId(species)}`;
}

/** ¿Está el sprite oficial cargado y listo para usar? */
export function hasTexture(scene: Phaser.Scene, kind: AssetKind, species: string): boolean {
  return hasAsset(kind, species) && scene.textures.exists(assetKey(kind, species));
}

export type AssetRequest = [AssetKind, string];

/** Hojas que hay que trocear en fotogramas: [columnas, filas]. */
const SHEETS: Partial<Record<AssetKind, [number, number]>> = { followers: [4, 4], icons: [2, 1] };

/**
 * Encola en el loader los sprites que falten. Úsalo dentro de preload() (Phaser
 * arranca el loader solo) o a través de ensureAssets() en cualquier otro momento.
 */
export function queueAssets(scene: Phaser.Scene, requests: AssetRequest[]): number {
  let queued = 0;
  for (const [kind, species] of requests) {
    const id = resolveId(kind, species);
    if (!id) continue;
    const key = `official-${kind}-${id}`;
    if (scene.textures.exists(key)) continue;
    const url = index.get(`${kind}:${id}`)!;
    const sheet = SHEETS[kind];
    if (sheet) {
      const rawKey = `${key}-raw`;
      if (scene.textures.exists(rawKey)) continue;
      scene.load.image(rawKey, url);
      scene.load.once(`filecomplete-image-${rawKey}`, () => sliceSheet(scene, rawKey, key, sheet));
    } else {
      scene.load.image(key, url);
    }
    queued++;
  }
  return queued;
}

/** Carga los sprites que falten y espera a que estén listos. */
export function ensureAssets(scene: Phaser.Scene, requests: AssetRequest[]): Promise<void> {
  if (queueAssets(scene, requests) === 0) return Promise.resolve();
  return new Promise((resolve) => {
    scene.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
    scene.load.start();
  });
}

function sliceSheet(scene: Phaser.Scene, rawKey: string, key: string, [cols, rows]: [number, number]): void {
  if (scene.textures.exists(key)) return;
  const img = scene.textures.get(rawKey).getSourceImage() as HTMLImageElement;
  scene.textures.addSpriteSheet(key, img, {
    frameWidth: Math.floor(img.width / cols),
    frameHeight: Math.floor(img.height / rows),
  });
}

/**
 * Filas vacías (transparentes) al pie de un sprite: sirve para apoyar los
 * Pokémon sobre su plataforma aunque el dibujo no llegue al borde de la imagen.
 */
export function transparentBottom(scene: Phaser.Scene, key: string): number {
  const src = scene.textures.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const w = src.width;
  const h = src.height;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(src, 0, 0);
  const data = ctx.getImageData(0, 0, w, h).data;
  for (let y = h - 1; y >= 0; y--) {
    for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3] > 0) return h - 1 - y;
  }
  return 0;
}
