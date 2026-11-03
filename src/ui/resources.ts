/**
 * Recursos externos opcionales (gráficos y audio de Pokémon Essentials y packs
 * compatibles), convertidos con scripts/convert-essentials-base.py. Igual que los
 * sprites de Pokémon, viven en assets/ y nunca se suben al repositorio público:
 * si faltan, el juego usa su arte propio generado por código.
 *
 *   assets/characters/<nombre>.png      personajes de mapa (hoja 4x4)
 *   assets/ui/windowskins/<nombre>.png  marcos de texto y menús
 *   assets/ui/battle/<nombre>.png       cajas de datos, botones, barras
 *   assets/battlebacks/<nombre>.png     fondos y plataformas de combate
 *   assets/trainers/<nombre>.png        entrenadores en combate
 *   assets/items/<nombre>.png           iconos de objetos
 *   assets/audio/{bgm,me,se,cries}/<nombre>.ogg
 */
import * as Phaser from 'phaser';

const files = import.meta.glob(['/assets/**/*.png', '/assets/**/*.ogg', '!/assets/pokemon/**'], {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const index = new Map<string, string>();
for (const [path, url] of Object.entries(files)) {
  const m = /^\/assets\/(.+)\/([^/]+)\.(png|ogg)$/i.exec(path);
  if (m) index.set(`${m[1].toLowerCase()}/${m[2].toLowerCase()}`, url);
}

export type ResCategory =
  | 'characters'
  | 'ui/windowskins'
  | 'ui/battle'
  | 'ui/bag'
  | 'ui'
  | 'battlebacks'
  | 'trainers'
  | 'items'
  | 'audio/bgm'
  | 'audio/me'
  | 'audio/se'
  | 'audio/cries';

export function hasRes(cat: ResCategory, name: string): boolean {
  return index.has(`${cat}/${name.toLowerCase()}`);
}

export function resKey(cat: ResCategory, name: string): string {
  return `res:${cat}/${name.toLowerCase()}`;
}

export interface ResRequest {
  cat: ResCategory;
  name: string;
  /** Si es una hoja de fotogramas: [columnas, filas]. */
  sheet?: [number, number];
}

/** ¿Está el recurso disponible y ya cargado? */
export function resReady(scene: Phaser.Scene, cat: ResCategory, name: string): boolean {
  const key = resKey(cat, name);
  if (cat.startsWith('audio/')) return scene.cache.audio.exists(key);
  return scene.textures.exists(key);
}

/** Encola los recursos que existan y falten. Devuelve cuántos se han encolado. */
export function queueRes(scene: Phaser.Scene, requests: ResRequest[]): number {
  let queued = 0;
  for (const r of requests) {
    const id = `${r.cat}/${r.name.toLowerCase()}`;
    const url = index.get(id);
    if (!url || resReady(scene, r.cat, r.name)) continue;
    const key = resKey(r.cat, r.name);
    if (r.cat.startsWith('audio/')) {
      scene.load.audio(key, url);
    } else if (r.sheet) {
      const raw = `${key}#raw`;
      if (scene.textures.exists(raw)) continue;
      const [cols, rows] = r.sheet;
      scene.load.image(raw, url);
      scene.load.once(`filecomplete-image-${raw}`, () => {
        if (scene.textures.exists(key)) return;
        const img = scene.textures.get(raw).getSourceImage() as HTMLImageElement;
        scene.textures.addSpriteSheet(key, img, { frameWidth: Math.floor(img.width / cols), frameHeight: Math.floor(img.height / rows) });
      });
    } else {
      scene.load.image(key, url);
    }
    queued++;
  }
  return queued;
}

/** Carga (si hace falta) y espera. */
export function ensureRes(scene: Phaser.Scene, requests: ResRequest[]): Promise<void> {
  if (queueRes(scene, requests) === 0) return Promise.resolve();
  return new Promise((resolve) => {
    scene.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
    scene.load.start();
  });
}

export function resCount(): number {
  return index.size;
}
