// Game Types and Interfaces
import { GameObj, KaboomCtx } from "kaboom";

export interface MaskData {
  id: string;
  name: string;
  nameVi: string;
  color: string;
  cooldown: number;
  duration: number;
  description: string;
  passive?: string;      // NEW: Passive ability description
  unlockFloor?: number;  // NEW: Which floor unlocks this mask
}

export interface LevelConfig {
  id: number;
  name: string;
  theme: string;
  introDialogue: DialogueLine[];
  outroDialogue?: DialogueLine[];
  maskRewarded?: MaskData;
}

export interface DialogueLine {
  speaker: string;
  text: string;
  color?: string;
}

export interface PlayerState {
  health: number;
  maxHealth: number;
  currentMask: MaskData | null;
  collectedMasks: MaskData[];
  isInvincible: boolean;
  isInvisible: boolean;
  isEthereal: boolean;
  isShielding: boolean;
}

export interface GameState {
  currentLevel: number;
  isPaused: boolean;
  isDialogueActive: boolean;
  player: PlayerState;
  timeFrozen: boolean;
}

export type EntityType = "player" | "guard" | "camera" | "babythree" | "tuse" | 
                         "telieter" | "antifan" | "boss" | "minion" | "projectile" | "elevator";

export interface Position {
  x: number;
  y: number;
}

export interface VisionCone {
  angle: number;
  range: number;
  fov: number;
}

// Kaboom extended types
export type PlayerObj = GameObj<any>;
export type EnemyObj = GameObj<any>;

// Global game reference
export let k: KaboomCtx;
export function setKaboomContext(ctx: KaboomCtx) {
  k = ctx;
}
