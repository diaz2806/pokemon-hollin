# Sprites oficiales de Pokémon (solo en local o en un repositorio privado)

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

## El .exe con sprites

El `.exe` de las Releases públicas **no** lleva sprites oficiales. La versión con sprites se compila
desde el repositorio privado de assets (ver su README), y sus Releases solo las ve el dueño.
