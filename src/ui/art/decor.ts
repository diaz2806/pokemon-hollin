/**
 * Arte de los detalles de mapa (ver core/decor): 16x16 con fondo transparente,
 * pintados por código para que encajen sobre cualquier suelo.
 */
import type { DecorKind } from '../../core/decor';
import type { Painter } from './painter';
import { seeded } from './painter';

type Draw = (p: Painter, variant: number, frame: number) => void;

const POSTER_COLORS: [string, string, string][] = [
  ['#c9bfa8', '#7a2f2f', '#2a211b'], // cartel de combate de boxeo
  ['#d9c88a', '#2f4a3a', '#2a211b'], // anuncio de jabón
  ['#a9b4b8', '#3d5266', '#1d1b19'], // aviso de la fábrica
  ['#c8a07a', '#5a2a20', '#2a211b'], // cartel de la banda (rasgado)
];

const draws: Record<DecorKind, Draw> = {
  puddle: (p, v, frame) => {
    const w = 5 + (v % 3);
    p.ellipse(8, 11, w + 1, 3, 'rgba(10,14,20,0.6)');
    p.ellipse(8, 10, w, 2, 'rgba(96,120,140,0.9)');
    p.hline(8 - w + 2, 9, w, 'rgba(150,175,195,0.7)');
    // Reflejo de la luz de gas que tiembla
    p.hline(5 + frame, 9, 3, 'rgba(242,216,138,0.85)');
    p.px(11 - frame, 11, 'rgba(200,220,235,0.8)');
  },
  litter: (p, v) => {
    const rng = seeded(31 + v);
    const x = 3 + Math.floor(rng() * 8);
    const y = 5 + Math.floor(rng() * 7);
    p.rect(x, y, 4, 3, '#d9d2c3').hline(x, y + 3, 4, '#8a8478');
    p.hline(x + 1, y + 1, 2, '#8a8478');
    if (v % 2 === 0) p.rect(x + 6, y + 2, 2, 2, '#b8ae9a');
  },
  crack: (p, v) => {
    const c = 'rgba(20,18,16,0.7)';
    const sx = 3 + v * 2;
    p.px(sx, 4, c).px(sx + 1, 5, c).px(sx + 1, 6, c).px(sx + 2, 7, c).px(sx + 4, 8, c).px(sx + 3, 8, c).px(sx + 5, 9, c);
    p.px(sx + 2, 8, c).px(sx + 1, 9, c);
  },
  oilstain: (p, v) => {
    p.ellipse(6 + v, 9, 4, 2, 'rgba(12,10,14,0.45)');
    p.px(5 + v, 9, 'rgba(120,80,160,0.5)').px(7 + v, 8, 'rgba(60,140,140,0.5)');
  },
  poster: (p, v) => {
    const [paper, ink, frame] = POSTER_COLORS[v];
    p.rect(3, 2, 10, 12, frame);
    p.rect(4, 3, 8, 10, paper);
    p.rect(5, 4, 6, 3, ink);
    p.hline(5, 9, 6, ink).hline(5, 11, 4, ink);
    if (v === 3) p.rect(9, 10, 3, 3, 'rgba(0,0,0,0)').px(10, 12, frame).px(11, 11, frame);
    p.px(4, 3, '#f2e8d0');
  },
  drainpipe: (p, v) => {
    const x = v % 2 === 0 ? 2 : 12;
    p.rect(x, 0, 3, 16, '#3a3d45').vline(x, 0, 16, '#5d5f66').vline(x + 2, 0, 16, '#26282e');
    p.rect(x - 1, 5, 5, 1, '#26282e').rect(x - 1, 12, 5, 1, '#26282e');
    p.px(x + 1, 8, '#6b4a2a');
  },
  flowerbox: (p, v) => {
    const flowers = ['#c03028', '#e8c040', '#d9d2c3', '#a040a0'];
    p.rect(2, 12, 12, 3, '#5a4030').hline(2, 12, 12, '#6d4f3a').hline(2, 15, 12, '#2a211b');
    for (let i = 0; i < 4; i++) {
      p.vline(4 + i * 3, 10, 2, '#2f4a3a');
      p.px(4 + i * 3, 9, flowers[(v + i) % 4]);
    }
  },
  pigeon: (p, v, frame) => {
    const x = 4 + (v % 3) * 2;
    const peck = frame === 1 && v % 2 === 0;
    p.ellipse(x + 3, 11, 3, 2, '#6a6e78');
    p.rect(x + 1, 12, 5, 1, '#4a4e58');
    p.px(peck ? x + 6 : x + 5, peck ? 11 : 9, '#7a7e88').px(peck ? x + 7 : x + 6, peck ? 12 : 9, '#c8a050');
    p.px(peck ? x + 6 : x + 5, peck ? 10 : 8, '#3d6a5a');
    p.px(x + 2, 14, '#c86050').px(x + 4, 14, '#c86050');
  },
  debris: (p, v, frame) => {
    const dx = frame;
    if (v % 2 === 0) {
      p.rect(4 + dx, 8, 7, 2, '#5a4030').hline(4 + dx, 8, 7, '#6d4f3a');
    } else {
      p.ellipse(8 + dx, 9, 2, 1, '#8a8478');
      p.px(7 + dx, 9, '#c9bfa8');
    }
    p.hline(2 + dx, 11, 3, 'rgba(160,184,200,0.5)').hline(10 + dx, 11, 3, 'rgba(160,184,200,0.5)');
  },
  pebbles: (p, v) => {
    const rng = seeded(71 + v);
    for (let i = 0; i < 4; i++) {
      const x = 2 + Math.floor(rng() * 12);
      const y = 3 + Math.floor(rng() * 11);
      p.rect(x, y, 2, 1, '#6e695f').px(x, y + 1, '#2f2b25');
    }
  },
  tuft: (p, v) => {
    const x = 4 + v * 2;
    p.vline(x, 9, 4, '#7d7a4a').vline(x + 2, 8, 5, '#8f8a52').vline(x + 4, 10, 3, '#7d7a4a');
    p.px(x + 2, 8, '#a9a265').px(x - 1, 11, '#7d7a4a');
  },
  scrap: (p, v) => {
    if (v % 2 === 0) {
      p.rect(4, 9, 8, 3, '#6b3a22').hline(4, 9, 8, '#a35a30').px(6, 10, '#3a2214');
    } else {
      p.ellipse(8, 10, 3, 2, '#5d5f66');
      p.ellipse(8, 10, 1, 1, '#2a2725');
    }
  },
  bottle: (p, v) => {
    const glass = ['#2f4a3a', '#5a3a20', '#3d5266', '#2f4a3a'][v];
    if (v % 2 === 0) {
      p.rect(7, 6, 3, 7, glass).rect(8, 4, 1, 2, glass).px(7, 7, '#a9c8b0');
    } else {
      p.rect(5, 10, 7, 3, glass).rect(12, 11, 2, 1, glass).px(6, 10, '#a9c8b0');
    }
  },
  sawdust: (p, v) => {
    const rng = seeded(91 + v);
    for (let i = 0; i < 7; i++) p.px(3 + Math.floor(rng() * 10), 6 + Math.floor(rng() * 7), '#c8a878');
  },
};

export function drawDecor(p: Painter, kind: DecorKind, variant: number, frame: number): void {
  draws[kind](p, variant, frame);
}

export const ALL_DECOR = Object.keys(draws) as DecorKind[];
