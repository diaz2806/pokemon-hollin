# Gráficos y audio oficiales (solo en local o en un repositorio privado)

El juego funciona sin sprites oficiales: los Pokémon se ven como placeholders por tipo.
Con sprites, se ven los de verdad en combate, en el menú de equipo y siguiéndote por el mapa.

**Nunca se suben a este repositorio público** (`assets/` está en `.gitignore`).

## De dónde salen

Del **Generation 9 Resource Pack** de Pokémon Essentials (Eevee Expo / PokéCommunity), que trae
las 1025 especies: frente, espalda, iconos y seguidores.

## Cómo se preparan

El pack viene a resolución de Essentials (frente 192 px, espalda 288 px, seguidores 64 px por
fotograma). El juego usa la resolución de DS, así que se convierten con:

```bash
python3 scripts/convert-essentials-pack.py "<pack>/Graphics" assets/pokemon
```

Resultado:

```
assets/pokemon/
  front/      growlithe.png   96x96, frente
  back/       growlithe.png   96x96, espalda
  icons/      growlithe.png   64x32 (2 fotogramas)
  followers/  growlithe.png   128x128 (4x4: abajo, izquierda, derecha, arriba)
```

- Se cargan bajo demanda: solo los de las especies que aparecen.
- Las formas sin sprite propio (Sandile de Ashbury) usan el de su especie base hasta que haya arte propio.

## Gráficos de Essentials y personajes Gen 4

Interfaz de combate, ventanas, fondos, entrenadores, objetos, música y gritos salen de
**Pokémon Essentials v21.1** (`Graphics/` y `Audio/`), y los personajes del mapa del pack
**Gen 4 OWs v1.5 (Vanilla Sunshine)**. Se convierten a resolución de DS con:

```bash
python3 scripts/convert-essentials-base.py <carpeta con Graphics, Audio y Gen 4 OWs> assets
```

```
assets/
  characters/   trchar000.png ...   hojas 4x4 de RPG Maker (abajo, izq., der., arriba)
  ui/windowskins, ui/battle, ui/bag, ui/types.png ...
  battlebacks/  city_night_bg.png ...
  trainers/     burglar.png ...     sprite de combate de cada clase de entrenador
  items/        pokeball.png ...
  audio/        bgm/ me/ se/ cries/  (.ogg; las músicas MIDI de Essentials no sirven en navegador)
```

- `src/ui/resources.ts` indexa todo con `import.meta.glob` y carga bajo demanda.
- Si falta algo, el juego usa lo propio: ventanas dibujadas, menús de texto, personajes generados y silencio.
- Los NPC eligen personaje con `ow` en el JSON del mapa; los entrenadores, su sprite de combate con `battler`.

## Texturas de mapa y efectos de combate

```bash
python3 scripts/build-tile-skins.py <Graphics de Essentials> <tileset interior Gen 4 de Akizakura> assets/tiles
python3 scripts/convert-essentials-fx.py <Graphics de Essentials> assets
```

- `assets/tiles/<clave>_<n>.png`: suelos, tejados y paredes de los tilesets (16 px). Qué casilla va
  en cada clave está en `SKINS` dentro del script; qué clave usa cada casilla del mapa, en `src/core/tile-skin.ts`.
- `assets/animations/`: hojas de animaciones de ataques (celdas de 96 px). La tabla tipo → hoja está en `src/ui/battle-fx.ts`.
- `assets/fogs/`: niebla para la densidad de humo y las calles.
- `assets/ui/battle/ball_pokeball*.png`, `ballburst_particle.png`: la salida con Poké Ball.

## El .exe con sprites

El `.exe` de las Releases públicas **no** lleva sprites oficiales. La versión con sprites se compila
desde el repositorio privado de assets (ver su README), y sus Releases solo las ve el dueño.
