/** Partida en curso, compartida por todas las escenas, y guardado en localStorage. */
import { hasSave, loadGame, newGame, saveGame, type GameState, type KeyValueStorage } from '../core/game-state';

const storage: KeyValueStorage = (() => {
  try {
    const probe = '__hollin_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    const mem = new Map<string, string>();
    return { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v), removeItem: (k) => void mem.delete(k) };
  }
})();

let current: GameState = newGame();

export const session = {
  get state(): GameState {
    return current;
  },
  startNew(name?: string): GameState {
    current = newGame(name);
    return current;
  },
  load(): boolean {
    const loaded = loadGame(storage);
    if (!loaded) return false;
    current = loaded;
    return true;
  },
  save(): void {
    saveGame(current, storage);
  },
  hasSave(): boolean {
    return hasSave(storage);
  },
};
