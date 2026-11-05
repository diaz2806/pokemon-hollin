# Pokémon Hollín — guía para Claude

Fangame de Pokémon ambientado en Ashbury, una ciudad industrial inglesa de 1923. Proyecto personal y de portfolio de Alberto (diaz2806).

- **Game Design Document (fuente de verdad del diseño):** https://claude.ai/artifact/X8TMumHJuPwrJMBiJ4sJ4v
- **Juego publicado:** https://diaz2806.github.io/pokemon-hollin/

## Comandos

```bash
npm install
npm run dev        # servidor local con recarga
npm test           # tests con Vitest
npm run typecheck  # tsc --noEmit
npm run build      # typecheck + build de producción en dist/
npm run desktop    # abre el juego en Electron
npm run dist:win   # .exe (instalador + portable) en release/
```

Antes de dar algo por terminado: `npm run typecheck && npm test && npm run build`.

## Arquitectura

| Carpeta | Qué contiene | Regla |
| --- | --- | --- |
| `src/core/` | Lógica pura: cuadrícula, mapas y NPCs, seguidor, encuentros, equipo, experiencia, captura, guardado | **Nunca importa Phaser ni @pkmn/sim.** Todo testeable |
| `src/battle/` | Frontera con Showdown: `BattleAdapter`, mod `hollin`, `dex-service` (datos oficiales), `progression` (EXP, niveles, evolución), `log-es` (protocolo → pasos en español) | Única carpeta que importa `@pkmn/sim` |
| `src/game/` | Sesión (partida en curso + localStorage) y registro de contenido (mapas, iniciales) | |
| `src/scenes/` | Boot, Title, World, Battle, Party: dibujan, animan y recogen input | Sin reglas de juego aquí |
| `src/ui/` | Controles (teclado + táctil), caja de texto y menús, paleta, assets opcionales | |
| `src/ui/art/` | Pixel art original generado por código: tiles, personajes, placeholders, fondos | Arte propio, sí va al repo |
| `data/` | JSON: mapas, encuentros, nombres de movimientos en español, `species-meta.json` (PokeAPI) | Datos, no código |
| `tests/` | Vitest | Cada módulo de `core/` y `battle/` tiene tests |

- Se distribuye como **.exe de Windows** (Electron, `electron/main.cjs`): cada push a main lanza `.github/workflows/release.yml`, que publica la Release `v<versión de package.json>` (subir la versión para sacar una nueva). La web en GitHub Pages es secundaria (enlace rápido para el CV/móvil). `base: './'` en Vite para que funcione con file://.
- Resolución interna 256x192 (pantalla de DS), fuente Press Start 2P a 8 px.
- Formas regionales de Ashbury en `src/battle/regional/` (especie + learnset + entrada de Pokédex), registradas en el mod. Primera: cadena de **Sandile** (Veneno/Siniestro, mismo total de stats), **Pokémon emblema del juego** (favorito de Alberto): movimiento exclusivo **Emboscada** (Siniestro, 70, x2 contra Tiznado) y evento de regalo en los callejones del Mercado (flag `gotSandile`). No dibujar Sandile/Krookodile: el arte del personaje debe venir de Alberto o de un artista. En pantalla se llaman como la especie base (`speciesLabel`).
- Todas las especies y movimientos de las 9 generaciones funcionan (Showdown). Nombres oficiales en español de movimientos y habilidades generados con `scripts/build-names-es.mjs` (PokeAPI).
- Mod de Showdown (`src/battle/hollin-mod.ts`): estado **Tiznado**, movimiento **Hollinazo** y el movimiento interno invisible `hollinaccion` (turnos en los que el jugador no ataca: Poké Ball, huir, objetos).
- Showdown asume 3 Más PP; `BattleAdapter` los quita y aplica los PS/PP guardados.
- Formato de mapas temporal: filas de texto en `data/maps/*.json` (leyenda en `src/core/tilemap.ts`). Cuando el mundo crezca, migrar a Tiled.
- Piel de los mapas: `src/core/tile-skin.ts` decide por casilla qué suelo de tileset va (`cobble`, `dirt`, `water`, `wood`...) y si el arte procedural va encima como objeto (`propKey`, dibujado sin suelo). Casillas recortadas con `scripts/build-tile-skins.py` en `assets/tiles/<clave>_<n>.png`; `WorldScene` las tiñe (`SKIN_TINT`) y aplica gradación de color y viñeta (filtros de cámara de Phaser 4, solo WebGL).
- Combate: animaciones de ataque por tipo y categoría con las hojas de Essentials (`animationFor`/`playSheet`), salida con Poké Ball (`ballSendOut`), respiración de 1 px, sombras, ambiente por fondo (`battleAmbience`: hollín y brasas en la calle, haces de luz y polvo en interiores), etiquetas de tipo y estado en español.
- Menú de ataques propio (`src/ui/move-menu.ts`, `chooseMove`): panel de hierro con ribete de latón y tarjetas por tipo pintadas en canvas (cacheadas como `movecard-<tipo>-<estado>`), etiqueta de eficacia (x2, x.5...), categoría, potencia y precisión. Texto siempre a 8 px (escalar la fuente de píxel la emborrona).
- Detalles de mapa automáticos (`src/core/decor.ts`, arte en `src/ui/art/decor.ts`): charcos, papeles, grietas, carteles, canalones, macetas, palomas, restos en el canal... repartidos por hash de la posición (deterministas). `haze` en el mapa = bruma visual.
- Descartado (no volver a proponer): la "densidad de humo" como mecánica de combate. A Alberto no le gustó; el humo es solo ambiente.
- `?debug` en la URL expone `__game` y `__session` en la consola.
- Entrenadores: `trainer` dentro de cada NPC del mapa (`src/core/trainers.ts`): equipo, `sight` (casillas de visión), diálogos, dinero y `reward` (flags como `ficha_mercado`, objetos). Derrotado = flag `beat_<mapa>_<npc>`. `BattleAdapter` saca solo el siguiente Pokémon del rival (`settleOpponent`).
- Fichas de banda en `src/game/content.ts` (`FICHAS`). Hecha: Mercado (Los Gorriones, Mag la Urraca). Siguiente: Muelles (la Ruta 1 termina en un piquete de huelga).
- Press Start 2P trae ligaduras fi/fl: `main.ts` parchea `Text.setText` para romperlas con un ZWNJ.
- Limitaciones conocidas: si un Pokémon sube de nivel en mitad de un combate contra varios, sus stats se actualizan al acabar.

## Convenciones

- Código e identificadores en **inglés**; textos que ve el jugador y comentarios en **español**.
- TypeScript estricto; nada de `any` salvo en la frontera con `@pkmn/sim`, y comentado.
- El azar se inyecta (`rng`, `seed`) para que los tests sean deterministas.
- Paleta gris con acentos cálidos: usar siempre `PALETTE` de `src/ui/palette.ts`.

## Assets oficiales

Sprites y música oficiales de Pokémon **nunca** se suben al repositorio público (riesgo de DMCA). Van en `assets/` (en `.gitignore`): Pokémon desde el Generation 9 Pack (`scripts/convert-essentials-pack.py`, cargados con `src/ui/assets.ts`) y el resto (interfaz de combate y ventanas de Essentials, personajes Gen 4, fondos, entrenadores, objetos, audio) con `scripts/convert-essentials-base.py`, cargados con `src/ui/resources.ts` (`queueRes`/`ensureRes`, claves `res:<cat>/<nombre>`). Formato en `ASSETS.md`. Interfaz de combate estilo Essentials en `src/ui/battle-ui.ts`; sonido en `src/ui/audio.ts` (`playBgm`, `playMe`, `playSe`, `playCry`). Cada pantalla comprueba si sus recursos están y, si no, usa su versión propia. El .exe con sprites se compila desde el repositorio privado `diaz2806/pokemon-hollin-assets`. Sin assets, placeholders por tipo.

## Alberto

- Desarrollador full-stack junior (Java/Spring Boot, Angular). Quiere entender el código para poder defenderlo en entrevistas: explica las decisiones y los patrones cuando añadas algo nuevo.
- Prefiere respuestas en español con el vocabulario técnico en inglés, y opiniones directas.
