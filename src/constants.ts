// Game Constants and Configuration
import { MaskData, DialogueLine, GameState, PlayerState } from "./types";

// Canvas dimensions
export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 600;

// Player constants
export const PLAYER_SPEED = 200;
export const PLAYER_SIZE = 24;
export const PLAYER_COLOR = "#4FC3F7";

// Colors
export const COLORS = {
  player: "#4FC3F7",
  enemy: "#EF5350",
  guard: "#FF7043",
  camera: "#7E57C2",
  projectile: "#FFCA28",
  elevator: "#FFFFFF",
  wall: "#424242",
  floor: "#2E2E2E",
  boss: "#D32F2F",
  minion: "#F8BBD9",
  ui: {
    health: "#EF5350",
    healthBg: "#424242",
    cooldown: "#4FC3F7",
    cooldownBg: "#1A1A2E",
    text: "#FFFFFF",
    dialogue: "#1A1A2E",
    dialogueBorder: "#4FC3F7"
  }
};

// Mask definitions - NEW REWORKED ABILITIES (v2.0)
// Floor 1: Tutorial (no mask)
// Floor 2: Shield, Floor 3: Ghost, Floor 4: Freeze, Floor 5: Silence
export const MASKS: Record<string, MaskData> = {
  shield: {
    id: "shield",
    name: "Shield Mask",
    nameVi: "Mặt nạ Khiên",
    color: "#FF5722",
    cooldown: 6,
    duration: 2,
    description: "Reflective Guard - Absorb projectiles and release Repel Blast",
    passive: "Reduces frontal damage by 20%",
    unlockFloor: 2
  },
  ghost: {
    id: "ghost",
    name: "Ghost Mask",
    nameVi: "Mặt nạ Hồn Ma",
    color: "#9C27B0",
    cooldown: 5,
    duration: 0.5,
    description: "Phase Shift - Dash forward, intangible through barriers and enemies",
    passive: "Silent footsteps, enemies detect you slower",
    unlockFloor: 3
  },
  frozen: {
    id: "frozen",
    name: "Freeze Mask",
    nameVi: "Mặt nạ Băng Giá",
    color: "#00BCD4",
    cooldown: 10,
    duration: 4,
    description: "Flash Freeze - Turn enemies into ice platforms, freeze machinery",
    passive: "Slows enemy attack speed in small radius",
    unlockFloor: 4
  },
  silence: {
    id: "silence",
    name: "Silence Mask",
    nameVi: "Mặt nạ Câm Lặng",
    color: "#212121",
    cooldown: 12,
    duration: 5,
    description: "Null Zone - Disable enemy magic, tech abilities and invulnerability",
    passive: "Reveals invisible traps and enemy weak points",
    unlockFloor: 5
  }
};

// Level dialogues - UPDATED for new mask progression
export const LEVEL_DIALOGUES: Record<number, { intro: DialogueLine[], outro?: DialogueLine[] }> = {
  1: {
    intro: [
      { speaker: "Tutorial", text: "WASD to Move. Left Click to Attack.", color: "#FFCA28" },
      { speaker: "Tutorial", text: "Dodge their attacks! You have no mask to protect you yet.", color: "#FFCA28" },
      { speaker: "Vu", text: "The lobby... I need to find the stairs to Floor 2.", color: "#4FC3F7" },
      { speaker: "Radio", text: "The atmosphere gets heavier upstairs... You will need protection.", color: "#81C784" }
    ],
    outro: [
      { speaker: "Vu", text: "Made it to the elevator! Time for Floor 2.", color: "#4FC3F7" },
      { speaker: "System", text: "Tutorial Complete! Prepare for your first mask...", color: "#FFCA28" }
    ]
  },
  2: {
    intro: [
      { speaker: "Vu", text: "The Debt Tunnel... Something's watching me!", color: "#4FC3F7" },
      { speaker: "The Collector", text: "You owe me... TRIBUTE! You cannot escape!", color: "#8B4513" },
      { speaker: "???", text: "Take this Shield Mask! It will protect you!", color: "#FF5722" },
      { speaker: "System", text: "Shield Mask acquired! Survive The Collector for 30 seconds!", color: "#FFCA28" }
    ],
    outro: [
      { speaker: "Vu", text: "I escaped The Collector! The Shield saved me!", color: "#4FC3F7" },
      { speaker: "System", text: "Shield Mask mastered! Onwards to Floor 3.", color: "#FFCA28" }
    ]
  },
  3: {
    intro: [
      { speaker: "Vu", text: "Iron bars and laser grids everywhere...", color: "#4FC3F7" },
      { speaker: "???", text: "Solid walls mean nothing to a ghost. Take this.", color: "#9C27B0" },
      { speaker: "System", text: "Ghost Mask acquired! Press SPACE to Phase Shift through barriers.", color: "#FFCA28" }
    ],
    outro: [
      { speaker: "Vu", text: "I can walk through walls now!", color: "#4FC3F7" },
      { speaker: "System", text: "Ghost Mask mastered!", color: "#FFCA28" }
    ]
  },
  4: {
    intro: [
      { speaker: "Vu", text: "So many enemies swarming...", color: "#4FC3F7" },
      { speaker: "???", text: "Freeze them in their tracks. This mask controls ice.", color: "#00BCD4" },
      { speaker: "System", text: "Freeze Mask acquired! Press SPACE for Flash Freeze.", color: "#FFCA28" }
    ],
    outro: [
      { speaker: "Vu", text: "They shatter like glass when frozen!", color: "#4FC3F7" },
      { speaker: "System", text: "Freeze Mask mastered! One floor remains...", color: "#FFCA28" }
    ]
  },
  5: {
    intro: [
      { speaker: "The Face Stealer", text: "So you've collected three masks... But I possess ALL FOUR.", color: "#D32F2F" },
      { speaker: "The Face Stealer", text: "This final mask... the Silence Mask... you must EARN it!", color: "#212121" },
      { speaker: "Vu", text: "Mom is waiting... I'll take ALL the masks from you!", color: "#4FC3F7" }
    ],
    outro: [
      { speaker: "The Face Stealer", text: "Impossible... You mastered every form...", color: "#D32F2F" },
      { speaker: "System", text: "Silence Mask acquired! All masks collected!", color: "#FFCA28" }
    ]
  }
};

// Initial player state
export const INITIAL_PLAYER_STATE: PlayerState = {
  health: 3,
  maxHealth: 3,
  currentMask: null,
  collectedMasks: [],
  isInvincible: false,
  isInvisible: false,
  isEthereal: false,
  isShielding: false
};

// Initial game state
export const INITIAL_GAME_STATE: GameState = {
  currentLevel: 1,
  isPaused: false,
  isDialogueActive: false,
  player: { ...INITIAL_PLAYER_STATE },
  timeFrozen: false
};

// Level configs
export const LEVEL_CONFIGS = {
  1: {
    survivalTime: 0,
    enemyCount: 3,
    cameraCount: 2
  },
  2: {
    survivalTime: 15,
    enemyCount: 5,
    spawnRate: 2
  },
  3: {
    enemyCount: 8,
    enemySpeed: 300
  },
  4: {
    enemyCount: 4,
    projectileSpeed: 250,
    fireRate: 1.5
  },
  5: {
    bossHealth: 100,
    phases: 3
  }
};
