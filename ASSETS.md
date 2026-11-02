# Sprites oficiales (opcional, solo en local)

El juego funciona sin ningún asset externo: todo el arte propio (tiles de Ashbury,
personajes, interfaz) se genera por código, y los Pokémon usan placeholders de colores
según su tipo.

Si quieres ver los sprites oficiales de los Pokémon, ponlos en la carpeta `assets/`
(está en `.gitignore`, **nunca se sube al repositorio**):

```
assets/
  pokemon/
    front/      GROWLITHE.png   sprite de frente para el combate
    back/       GROWLITHE.png   sprite de espalda para el combate
    followers/  GROWLITHE.png   hoja 4x4 estilo RPG Maker (filas: abajo, izquierda, derecha, arriba)
    icons/      GROWLITHE.png   icono del menú de equipo (opcional)
```

- Los nombres valen en mayúsculas o minúsculas (`GROWLITHE.png` o `growlithe.png`): es el
  mismo formato que usan los packs de recursos de Pokémon Essentials.
- Los seguidores pueden tener cualquier tamaño de fotograma (32x32, 64x64...): se trocea la
  hoja en 4x4.
- Si falta un sprite, ese Pokémon usa su placeholder. No hace falta tenerlos todos.

Después: `npm run dev` y listo. Ojo: si haces `npm run build` con assets en local, se
incluirán en `dist/`.
