/**
 * Música y efectos. Si los .ogg no existen en assets/audio, todo es silencioso y
 * el juego sigue funcionando igual.
 */
import * as Phaser from 'phaser';
import { ensureRes, hasRes, resKey, resReady } from './resources';
import { toId } from '../battle/dex-service';

let currentBgm: { name: string; sound: Phaser.Sound.BaseSound } | null = null;
let bgmVolume = 0.55;
const SE_VOLUME = 0.7;

/** Cambia la música (con fundido). `null` = silencio. */
export async function playBgm(scene: Phaser.Scene, name: string | null, loop = true): Promise<void> {
  if (currentBgm?.name === name) return;
  const old = currentBgm;
  currentBgm = null;
  if (old) {
    scene.tweens.add({ targets: old.sound, volume: 0, duration: 300, onComplete: () => old.sound.destroy() });
  }
  if (!name || !hasRes('audio/bgm', name)) return;
  await ensureRes(scene, [{ cat: 'audio/bgm', name }]);
  if (currentBgm) return; // otra llamada ganó mientras cargaba
  const sound = scene.sound.add(resKey('audio/bgm', name), { loop, volume: bgmVolume });
  sound.play();
  currentBgm = { name, sound };
}

export function stopBgm(scene: Phaser.Scene): Promise<void> {
  return playBgm(scene, null);
}

/** Melodía corta (curar, ficha, captura...). Baja la música mientras suena. */
export async function playMe(scene: Phaser.Scene, name: string): Promise<void> {
  if (!hasRes('audio/me', name)) return;
  await ensureRes(scene, [{ cat: 'audio/me', name }]);
  const bgm = currentBgm?.sound as Phaser.Sound.WebAudioSound | undefined;
  bgm?.setVolume(0.05);
  const me = scene.sound.add(resKey('audio/me', name), { volume: 0.8 });
  await new Promise<void>((resolve) => {
    me.once(Phaser.Sound.Events.COMPLETE, () => resolve());
    me.play();
  });
  me.destroy();
  bgm?.setVolume(bgmVolume);
}

/** Efecto de sonido. Los más usados se precargan en Boot; el resto se cargan al vuelo. */
export function playSe(scene: Phaser.Scene, name: string, volume = SE_VOLUME): void {
  if (!hasRes('audio/se', name)) return;
  if (resReady(scene, 'audio/se', name)) {
    scene.sound.play(resKey('audio/se', name), { volume });
    return;
  }
  void ensureRes(scene, [{ cat: 'audio/se', name }]).then(() => scene.sound.play(resKey('audio/se', name), { volume }));
}

/** Grito del Pokémon (las formas regionales usan el de su especie base). */
export async function playCry(scene: Phaser.Scene, species: string, baseId?: string, volume = 0.8): Promise<void> {
  const id = hasRes('audio/cries', toId(species)) ? toId(species) : baseId;
  if (!id || !hasRes('audio/cries', id)) return;
  await ensureRes(scene, [{ cat: 'audio/cries', name: id }]);
  scene.sound.play(resKey('audio/cries', id), { volume });
}

export function setMusicVolume(v: number): void {
  bgmVolume = v;
  (currentBgm?.sound as Phaser.Sound.WebAudioSound | undefined)?.setVolume(v);
}

/** Efectos que se precargan al arrancar para que suenen sin retraso. */
export const COMMON_SE = [
  'gui_sel_cursor',
  'gui_sel_decision',
  'gui_sel_cancel',
  'gui_menu_open',
  'gui_menu_close',
  'player_bump',
  'door_enter',
  'door_exit',
  'exclaim',
  'battle_damage_normal',
  'battle_damage_super',
  'battle_damage_weak',
  'battle_throw',
  'battle_ball_shake',
  'battle_ball_hit',
  'battle_jump_to_ball',
  'battle_recall',
  'battle_flee',
  'pkmn_faint',
  'pkmn_exp_gain',
  'pkmn_level_up',
];
