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

- Resolución interna 256x192 (pantalla de DS), fuente Press Start 2P a 8 px.
- Mod de Showdown (`src/battle/hollin-mod.ts`): estado **Tiznado**, movimiento **Hollinazo** y el movimiento interno invisible `hollinaccion` (turnos en los que el jugador no ataca: Poké Ball, huir, objetos).
- Showdown asume 3 Más PP; `BattleAdapter` los quita y aplica los PS/PP guardados.
- Formato de mapas temporal: filas de texto en `data/maps/*.json` (leyenda en `src/core/tilemap.ts`). Cuando el mundo crezca, migrar a Tiled.
- `?debug` en la URL expone `__game` y `__session` en la consola.
- Limitaciones conocidas: sin combates de entrenador todavía; si un Pokémon sube de nivel en mitad de un combate contra varios, sus stats se actualizan al acabar.

## Convenciones

- Código e identificadores en **inglés**; textos que ve el jugador y comentarios en **español**.
- TypeScript estricto; nada de `any` salvo en la frontera con `@pkmn/sim`, y comentado.
- El azar se inyecta (`rng`, `seed`) para que los tests sean deterministas.
- Paleta gris con acentos cálidos: usar siempre `PALETTE` de `src/ui/palette.ts`.

## Assets oficiales

Sprites y música oficiales de Pokémon **nunca** se suben al repositorio (riesgo de DMCA). Van en `assets/`, que está en `.gitignore` (formato en `ASSETS.md`). Mientras no existan, el juego usa placeholders por tipo.

## Alberto

- Desarrollador full-stack junior (Java/Spring Boot, Angular). Quiere entender el código para poder defenderlo en entrevistas: explica las decisiones y los patrones cuando añadas algo nuevo.
- Prefiere respuestas en español con el vocabulario técnico en inglés, y opiniones directas.
