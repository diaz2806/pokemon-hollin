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
| `src/core/` | Lógica pura del juego: cuadrícula, mapas, seguidor, encuentros, estado | **Nunca importa Phaser ni @pkmn/sim.** Todo testeable |
| `src/battle/` | Adaptador con el motor de Showdown (`@pkmn/sim`) y el mod `hollin` | Única carpeta que importa `@pkmn/sim` |
| `src/scenes/` | Escenas de Phaser: solo dibujan y recogen input | Sin reglas de juego aquí |
| `src/ui/` | Paleta y utilidades visuales | |
| `data/` | JSON: mapas, tablas de encuentros, (más adelante) diálogos y especies | Datos, no código |
| `tests/` | Tests de Vitest | Cada módulo de `core/` y `battle/` tiene tests |

- El mod de Showdown vive en `src/battle/hollin-mod.ts`: estado **Tiznado**, movimiento **Humareda**. Ahí irán el clima Smog, las formas de Ashbury y las especies nuevas.
- Showdown asume 3 Más PP; `BattleAdapter.resetPPUps` los quita.
- Los combates son 1 contra 1 de momento (sin cambios de Pokémon ni captura).

## Convenciones

- Código e identificadores en **inglés**; textos que ve el jugador y comentarios en **español**.
- TypeScript estricto; nada de `any` salvo en la frontera con `@pkmn/sim`, y comentado.
- El azar se inyecta (`rng`, `seed`) para que los tests sean deterministas.
- Paleta gris con acentos cálidos: usar siempre `PALETTE` de `src/ui/palette.ts`.

## Assets oficiales

Sprites y música oficiales de Pokémon **nunca** se suben al repositorio (riesgo de DMCA). Van en `assets/`, que está en `.gitignore`. Mientras no existan, el juego usa placeholders generados en `BootScene`.

## Alberto

- Desarrollador full-stack junior (Java/Spring Boot, Angular). Quiere entender el código para poder defenderlo en entrevistas: explica las decisiones y los patrones cuando añadas algo nuevo.
- Prefiere respuestas en español con el vocabulario técnico en inglés, y opiniones directas.
