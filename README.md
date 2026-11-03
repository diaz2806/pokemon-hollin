# Pokémon Hollín

> Ashbury, Inglaterra, 1923. Las fábricas funcionan gracias a los Pokémon, el humo no deja ver el cielo y las bandas controlan los barrios. Eres un huérfano que escapa de la fábrica con un Pokémon ilegal.

Fangame de Pokémon hecho en TypeScript que se juega en el navegador.

**⬇ Descargar para Windows:** [Releases](https://github.com/diaz2806/pokemon-hollin/releases) (instalador o versión portable `.exe`)

**▶ Jugar en el navegador / móvil:** https://diaz2806.github.io/pokemon-hollin/

## Estado

Ya se puede jugar el arranque de la historia:

- **Intro:** título, introducción y elección de nombre.
- **Fábrica en llamas:** eliges qué Pokémon liberas de las jaulas (Growlithe, Sprigatito u Oshawott).
- **El Mercado:** ciudad con farolas, humo, canal, NPCs con diálogos y una vendedora que te da Poké Balls.
- **El Gallo Negro:** el pub donde el tabernero cura a tus Pokémon.
- **Pokémon que te sigue**, al estilo de HeartGold/SoulSilver.
- **Combates estilo DS** con las reglas oficiales (motor de Pokémon Showdown): luchar, mochila, cambiar, huir.
- **Captura** con Poké Balls, equipo de 6, experiencia, subidas de nivel, movimientos nuevos y evolución.
- **Estado propio Tiznado** (movimiento Hollinazo): el humo hace fallar ataques y oculta la vida del rival.
- **Pokémon emblema: Sandile de Ashbury** (Veneno/Siniestro) y su cadena evolutiva, con su movimiento exclusivo **Emboscada** (doble de potencia contra rivales tiznados). Hay uno hambriento escondido en los callejones del Mercado.
- **Todas las generaciones**: las 1025 especies y todos los movimientos funcionan, con sus nombres oficiales en español.
- **Entrenadores** que te ven, te salen al paso y te retan; ganas dinero al vencerlos.
- **Primera banda: Los Gorriones**, en su almacén del Mercado. Su jefa, Mag la Urraca, te da la **Ficha del Mercado**, y con ella los guardias te dejan salir de la ciudad.
- **Ruta 1, Camino de la Escoria**: hierba seca entre montones de escoria, con 31 especies de las 9 generaciones y tres entrenadores.
- **Tienda** en el Mercado (Poké Balls y Pociones) y menú de **fichas**.
- **Guardado** en el PC y **controles táctiles** en el móvil.

El arte de la ciudad y los personajes es pixel art original generado por código. Los Pokémon
usan placeholders por tipo; si tienes sprites oficiales en local, el juego los usa
automáticamente (ver [ASSETS.md](ASSETS.md)).

## Controles

| Acción | Teclado | Móvil |
| --- | --- | --- |
| Moverse | Flechas / WASD | Cruceta |
| Aceptar / hablar | Z, Espacio, Enter | A |
| Cancelar | X, Retroceso | B |
| Menú | Escape, M | MENÚ |

## Stack

| Pieza | Tecnología |
| --- | --- |
| Lenguaje | TypeScript (strict) |
| Motor gráfico | Phaser 4 |
| Combate | [`@pkmn/sim`](https://www.npmjs.com/package/@pkmn/sim) (motor de Pokémon Showdown) con un mod propio |
| Build | Vite |
| Tests | Vitest |
| Escritorio | Electron + electron-builder (instalador NSIS y `.exe` portable) |
| Despliegue | GitHub Actions → Releases (Windows) y GitHub Pages (web) |

La lógica del juego (`src/core`) no depende de Phaser, así que se testea sin abrir el juego. El único punto de contacto con Showdown es `src/battle/BattleAdapter.ts`.

## Desarrollo

```bash
npm install
npm run dev        # versión web con recarga
npm run desktop    # versión de escritorio (Electron)
npm test
npm run dist:win   # genera los .exe en release/ (en Windows)
```

En cada push a `main`, GitHub Actions compila los `.exe` en una máquina Windows y los publica en Releases con la versión de `package.json`.

## Aviso

Proyecto fan sin ánimo de lucro, no afiliado a Nintendo, Game Freak ni The Pokémon Company. Pokémon y sus nombres son marcas de sus respectivos propietarios. Este repositorio no incluye sprites ni música oficiales.
