# Pokémon Hollín

> Ashbury, Inglaterra, 1923. Las fábricas funcionan gracias a los Pokémon, el humo no deja ver el cielo y las bandas controlan los barrios. Eres un huérfano que escapa de la fábrica con un Pokémon ilegal.

Fangame de Pokémon hecho en TypeScript que se juega en el navegador.

**▶ Jugar:** https://diaz2806.github.io/pokemon-hollin/

## Estado

Fase 1 (núcleo de combate) en marcha. Ya funciona:

- Mapa del Mercado con movimiento en cuadrícula (teclado o táctil).
- Pokémon que te sigue, al estilo de HeartGold/SoulSilver.
- Encuentros con Pokémon salvajes en los callejones con humo.
- Combates con las reglas oficiales gracias al motor de Pokémon Showdown.
- Estado propio **Tiznado**: el humo puede hacer fallar los ataques y oculta la vida del rival.

Todo el arte es provisional (placeholders).

## Stack

| Pieza | Tecnología |
| --- | --- |
| Lenguaje | TypeScript (strict) |
| Motor gráfico | Phaser 4 |
| Combate | [`@pkmn/sim`](https://www.npmjs.com/package/@pkmn/sim) (motor de Pokémon Showdown) con un mod propio |
| Build | Vite |
| Tests | Vitest |
| Despliegue | GitHub Actions → GitHub Pages |

La lógica del juego (`src/core`) no depende de Phaser, así que se testea sin abrir el juego. El único punto de contacto con Showdown es `src/battle/BattleAdapter.ts`.

## Desarrollo

```bash
npm install
npm run dev
npm test
```

## Aviso

Proyecto fan sin ánimo de lucro, no afiliado a Nintendo, Game Freak ni The Pokémon Company. Pokémon y sus nombres son marcas de sus respectivos propietarios. Este repositorio no incluye sprites ni música oficiales.
