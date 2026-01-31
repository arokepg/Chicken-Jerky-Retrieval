// PlayerFactory - Centralized player creation with state machine and mask overlay
import { KaboomCtx, GameObj, Vec2 } from "kaboom";
import { gameState } from "../state";
import { MaskManager } from "../mechanics/MaskManager";
import { TILE_SIZE } from "../loader";

// Player movement states
export type PlayerState = "idle" | "run";
export type PlayerDirection = "down" | "up" | "right" | "left";

// Mask sprite mapping
const MASK_SPRITES: Record<string, string> = {
  "shield": "mask-shield",
  "ghost": "mask-ghost",
  "frozen": "mask-frozen",
  "silence": "mask-silence"
};

// Mask overlay offset (position on Vu's face)
const MASK_OFFSET = { x: 0, y: -4 };
const MASK_OVERLAY_SCALE = 0.35; // Scale mask to fit on face

export interface PlayerConfig {
  speed?: number;
  mapWidth?: number;
  mapHeight?: number;
  enableMaskKeys?: boolean; // Enable 1-4 mask switching (for boss level)
}

export interface PlayerBundle {
  player: GameObj<any>;
  maskOverlay: GameObj<any>;
  updateState: () => void;
}

/**
 * Creates a player with proper sprite animations, state machine, and mask overlay
 */
export function createPlayerWithMask(
  k: KaboomCtx,
  x: number,
  y: number,
  maskManager: MaskManager,
  config: PlayerConfig = {}
): PlayerBundle {
  const {
    speed = 100,
    mapWidth = 1000,
    mapHeight = 1000,
    enableMaskKeys = false
  } = config;

  // Player state
  let currentState: PlayerState = "idle";
  let currentDirection: PlayerDirection = "down";
  let lastDirection: PlayerDirection = "down";

  // Create main player sprite
  const player = k.add([
    k.sprite("vu-idle"),
    k.pos(x, y),
    k.anchor("center"),
    k.area({ scale: k.vec2(0.8, 0.8) }),
    k.body(),
    k.opacity(1),
    k.z(10),
    "player",
    {
      speed: speed,
      dir: k.vec2(0, 0),
      state: "idle" as PlayerState,
      direction: "down" as PlayerDirection
    }
  ]);

  // Start idle animation
  try {
    player.play("idle-down");
  } catch {
    // Fallback if animation doesn't exist
  }

  // Create mask overlay as child sprite (Paper Doll system)
  const maskOverlay = k.add([
    k.sprite("mask-shield"), // Default, will be hidden if no mask
    k.pos(x + MASK_OFFSET.x, y + MASK_OFFSET.y),
    k.anchor("center"),
    k.scale(MASK_OVERLAY_SCALE),
    k.opacity(0), // Hidden by default
    k.z(11), // Render on top of player
    "mask-overlay"
  ]);

  /**
   * Get direction from input vector
   */
  function getDirectionFromInput(dir: Vec2): PlayerDirection {
    // Prioritize horizontal over vertical for better side-scroller feel
    if (Math.abs(dir.x) > Math.abs(dir.y)) {
      return dir.x > 0 ? "right" : "left";
    } else if (dir.y !== 0) {
      return dir.y > 0 ? "down" : "up";
    }
    return lastDirection;
  }

  /**
   * Update animation based on state and direction
   */
  let lastSpriteName = "vu-idle";
  let lastAnimName = "idle-down";
  
  function updateAnimation(state: PlayerState, direction: PlayerDirection): void {
    const animName = `${state === "run" ? "run" : "idle"}-${direction}`;
    const spriteName = state === "run" ? "vu-run" : "vu-idle";
    
    try {
      // Only switch sprite if needed
      if (lastSpriteName !== spriteName) {
        lastSpriteName = spriteName;
        player.use(k.sprite(spriteName));
      }
      
      // Play animation if it exists and not already playing
      if (lastAnimName !== animName) {
        lastAnimName = animName;
        player.play(animName);
      }
    } catch {
      // Fallback - no animation change
    }
  }

  /**
   * Update mask overlay position and visibility
   */
  let lastMaskSprite = "";
  
  function updateMaskOverlay(): void {
    // Follow player position
    maskOverlay.pos.x = player.pos.x + MASK_OFFSET.x;
    maskOverlay.pos.y = player.pos.y + MASK_OFFSET.y;
    
    // Check current equipped mask
    const currentMask = gameState.getPlayerState().currentMask;
    
    if (currentMask && MASK_SPRITES[currentMask.id]) {
      // Show mask overlay
      maskOverlay.opacity = 0.9;
      
      // Update sprite if mask changed
      const maskSprite = MASK_SPRITES[currentMask.id];
      try {
        if (lastMaskSprite !== maskSprite) {
          lastMaskSprite = maskSprite;
          maskOverlay.use(k.sprite(maskSprite));
          maskOverlay.scale = k.vec2(MASK_OVERLAY_SCALE, MASK_OVERLAY_SCALE);
        }
      } catch {
        // Sprite not found
      }
      
      // Slight bob when running
      if (currentState === "run") {
        maskOverlay.pos.y += Math.sin(k.time() * 15) * 0.5;
      }
    } else {
      // No mask equipped - hide overlay
      maskOverlay.opacity = 0;
    }
  }

  /**
   * Apply visual effects based on ability state
   */
  function applyStateVisuals(): void {
    if (gameState.isPlayerShielding()) {
      player.opacity = 1;
      // Orange tint for shield
      player.use(k.color(255, 150, 100));
    } else if (gameState.isPlayerEthereal()) {
      // Ghost phase - transparent purple
      player.opacity = 0.4;
      player.use(k.color(180, 100, 220));
    } else if (gameState.isTimeFrozen()) {
      // Freeze active - cyan tint
      player.opacity = 1;
      player.use(k.color(100, 220, 255));
    } else if (gameState.isPlayerInvisible()) {
      // Silence/invisible - dark purple, semi-transparent
      player.opacity = 0.6;
      player.use(k.color(150, 80, 180));
    } else {
      // Normal state - white (no tint)
      player.opacity = 1;
      player.use(k.color(255, 255, 255));
    }
  }

  // Main update loop
  player.onUpdate(() => {
    if (gameState.isPaused() || gameState.isDialogueActive()) return;

    // Get input
    const inputDir = k.vec2(0, 0);
    if (k.isKeyDown("left") || k.isKeyDown("a")) inputDir.x -= 1;
    if (k.isKeyDown("right") || k.isKeyDown("d")) inputDir.x += 1;
    if (k.isKeyDown("up") || k.isKeyDown("w")) inputDir.y -= 1;
    if (k.isKeyDown("down") || k.isKeyDown("s")) inputDir.y += 1;

    // State machine transitions
    const isMoving = inputDir.len() > 0;
    const newState: PlayerState = isMoving ? "run" : "idle";
    
    if (isMoving) {
      // Update direction based on input
      currentDirection = getDirectionFromInput(inputDir);
      lastDirection = currentDirection;
      
      // Move player
      player.dir = inputDir.unit();
      player.move(player.dir.scale(speed));
    }

    // State transition
    if (newState !== currentState) {
      currentState = newState;
      player.state = currentState;
    }
    player.direction = currentDirection;

    // Update animation
    updateAnimation(currentState, currentDirection);

    // Keep player in bounds
    const margin = TILE_SIZE;
    player.pos.x = k.clamp(player.pos.x, margin, mapWidth - margin);
    player.pos.y = k.clamp(player.pos.y, margin, mapHeight - margin);

    // Update mask overlay
    updateMaskOverlay();

    // Apply visual effects
    applyStateVisuals();
  });

  // Ability activation
  k.onKeyPress("space", () => {
    if (gameState.isPaused() || gameState.isDialogueActive()) return;
    maskManager.activateAbility(player);
  });

  // Mask quick-swap keys (for boss level)
  if (enableMaskKeys) {
    k.onKeyPress("1", () => maskManager.setMask(0));
    k.onKeyPress("2", () => maskManager.setMask(1));
    k.onKeyPress("3", () => maskManager.setMask(2));
    k.onKeyPress("4", () => maskManager.setMask(3));
    k.onKeyPress("tab", () => maskManager.cycleMask());
  }

  return {
    player,
    maskOverlay,
    updateState: () => {
      updateMaskOverlay();
      applyStateVisuals();
    }
  };
}

/**
 * Simplified player creation for levels that don't need full mask overlay
 * Still uses proper animations but simpler setup
 */
export function createSimplePlayer(
  k: KaboomCtx,
  x: number,
  y: number,
  maskManager: MaskManager,
  speed: number = 100,
  mapWidth: number = 1000,
  mapHeight: number = 1000
): GameObj<any> {
  const bundle = createPlayerWithMask(k, x, y, maskManager, {
    speed,
    mapWidth,
    mapHeight,
    enableMaskKeys: false
  });
  
  return bundle.player;
}
