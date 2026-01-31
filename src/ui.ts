// Game UI System - Fixed UI with objective pointer and ability cooldown
import { KaboomCtx, GameObj, Vec2 } from "kaboom";
import { gameState } from "./state";
import { MaskManager } from "./mechanics/MaskManager";
import { CameraController } from "./camera";

export interface GameUI {
  container: GameObj<any>;
  hearts: GameObj<any>[];
  maskIcon: GameObj<any>;
  maskNameText: GameObj<any>;
  cooldownBg: GameObj<any>;
  cooldownBar: GameObj<any>;
  cooldownGlow: GameObj<any>;
  cooldownText: GameObj<any>;
  levelText: GameObj<any>;
  objectivePointer: GameObj<any>;
  timerText: GameObj<any> | null;
}

// Create the game UI (fixed to screen, not affected by camera)
export function createGameUI(k: KaboomCtx): GameUI {
  // Main UI container (fixed position)
  const container = k.add([
    k.pos(0, 0),
    k.fixed(),
    k.z(1000)
  ]);

  // Health hearts - SCALED UP for visibility
  const hearts: GameObj<any>[] = [];
  for (let i = 0; i < 3; i++) {
    const heart = container.add([
      k.sprite("heart"),
      k.pos(20 + i * 50, 20),
      k.scale(4),
      k.z(1001),
      { index: i }
    ]);
    hearts.push(heart);
  }

  // Mask display layout - with HARD separation
  // Layout: [ ICON ]  (gap)  [ TEXT ]
  //                          [ BAR  ]
  const ICON_X = 20;
  const ICON_Y = 85;
  const ICON_WIDTH = 80; // Fixed icon box width (larger than sprite to ensure clearance)
  const GAP = 25; // Hard gap between icon and info
  const INFO_X = ICON_X + ICON_WIDTH + GAP; // Start X for text and bar = 125
  const BAR_WIDTH = 160;
  const BAR_HEIGHT = 22;
  const BAR_Y = ICON_Y + 40; // Bar positioned near bottom of icon area
  const TEXT_Y = BAR_Y - 28; // Text positioned above bar
  
  const maskIcon = container.add([
    k.sprite("mask-silence"),
    k.pos(ICON_X, ICON_Y),
    k.scale(5),
    k.z(1001)
  ]);

  // Mask name - positioned above the cooldown bar, left-aligned with bar
  const maskNameText = container.add([
    k.text("No Mask", { size: 18 }),
    k.pos(INFO_X, TEXT_Y),
    k.color(200, 200, 200),
    k.z(1001)
  ]);

  // Enhanced Cooldown bar background with outline
  const cooldownBg = container.add([
    k.rect(BAR_WIDTH, BAR_HEIGHT),
    k.pos(INFO_X, BAR_Y),
    k.color(20, 20, 30),
    k.outline(2, k.rgb(60, 60, 80)),
    k.z(1001)
  ]);

  // Cooldown bar fill
  const cooldownBar = container.add([
    k.rect(BAR_WIDTH - 4, BAR_HEIGHT - 4),
    k.pos(INFO_X + 2, BAR_Y + 2),
    k.color(100, 255, 100),
    k.z(1002)
  ]);

  // Cooldown glow effect (shows when ability ready)
  const cooldownGlow = container.add([
    k.rect(BAR_WIDTH, BAR_HEIGHT),
    k.pos(INFO_X, BAR_Y),
    k.color(100, 255, 100),
    k.opacity(0),
    k.z(1000)
  ]);

  // Cooldown percentage text - centered in bar
  const cooldownText = container.add([
    k.text("READY", { size: 12 }),
    k.pos(INFO_X + BAR_WIDTH / 2, BAR_Y + BAR_HEIGHT / 2),
    k.anchor("center"),
    k.color(255, 255, 255),
    k.z(1003)
  ]);

  // Level text (top center) - larger
  const levelText = container.add([
    k.text("Floor 1", { size: 20 }),
    k.pos(k.width() / 2, 15),
    k.anchor("top"),
    k.color(255, 255, 255),
    k.z(1001)
  ]);

  // Objective pointer (shows direction to exit when off-screen)
  const objectivePointer = container.add([
    k.sprite("arrow"),
    k.pos(k.width() / 2, k.height() / 2),
    k.anchor("center"),
    k.rotate(0),
    k.scale(1.5),
    k.opacity(0.8),
    k.z(1003),
    { visible: false }
  ]);

  return {
    container,
    hearts,
    maskIcon,
    maskNameText,
    cooldownBg,
    cooldownBar,
    cooldownGlow,
    cooldownText,
    levelText,
    objectivePointer,
    timerText: null
  };
}

// Add timer text (for survival levels)
export function addTimerToUI(k: KaboomCtx, ui: GameUI): void {
  ui.timerText = ui.container.add([
    k.text("15.0s", { size: 16 }),
    k.pos(k.width() / 2, 30),
    k.anchor("top"),
    k.color(255, 255, 100),
    k.z(1001)
  ]);
}

// Update UI elements
export function updateGameUI(
  k: KaboomCtx, 
  ui: GameUI, 
  maskManager: MaskManager,
  objectivePos?: Vec2,
  camera?: CameraController
): void {
  const playerState = gameState.getPlayerState();
  const currentLevel = gameState.getCurrentLevel();

  // Update hearts
  ui.hearts.forEach((heart, index) => {
    if (index < playerState.health) {
      heart.use(k.sprite("heart"));
      heart.opacity = 1;
    } else {
      heart.use(k.sprite("heart-empty"));
      heart.opacity = 0.5;
    }
  });

  // Hearts visible on all levels
  ui.hearts.forEach(h => h.hidden = false);

  // Update mask display
  const currentMask = playerState.currentMask;
  if (currentMask) {
    const maskSprites: Record<string, string> = {
      silence: "mask-silence",
      ghost: "mask-ghost",
      frozen: "mask-frozen",
      shield: "mask-shield"
    };
    ui.maskIcon.use(k.sprite(maskSprites[currentMask.id] || "mask-silence"));
    ui.maskNameText.text = currentMask.nameVi;

    // Update cooldown bar with enhanced visuals (width: 156 max = BAR_WIDTH - 4)
    const cooldownPercent = 1 - maskManager.getCooldownPercent(currentMask.id);
    ui.cooldownBar.width = 156 * cooldownPercent;

    if (maskManager.canUseAbility(currentMask.id)) {
      // Ready state - green with glow pulse
      ui.cooldownBar.color = k.rgb(100, 255, 100);
      ui.cooldownText.text = "READY";
      ui.cooldownText.color = k.rgb(100, 255, 100);
      
      // Pulse glow effect
      ui.cooldownGlow.opacity = 0.2 + Math.sin(k.time() * 6) * 0.15;
    } else {
      // Charging state - blue
      ui.cooldownBar.color = k.rgb(79, 195, 247);
      ui.cooldownText.text = `${Math.floor(cooldownPercent * 100)}%`;
      ui.cooldownText.color = k.rgb(150, 150, 150);
      ui.cooldownGlow.opacity = 0;
    }
  } else {
    ui.maskNameText.text = "No Mask";
    ui.cooldownBar.width = 0;
    ui.cooldownText.text = "---";
    ui.cooldownGlow.opacity = 0;
  }

  // Update level text
  ui.levelText.text = `Floor ${currentLevel}`;

  // Update objective pointer
  if (objectivePos && camera) {
    updateObjectivePointer(k, ui, objectivePos, camera);
  } else {
    ui.objectivePointer.hidden = true;
  }
}

// Update the objective pointer arrow
function updateObjectivePointer(
  k: KaboomCtx,
  ui: GameUI,
  objectivePos: Vec2,
  camera: CameraController
): void {
  // Check if objective is on screen
  const isVisible = camera.isOnScreen(objectivePos, 0);
  
  if (isVisible) {
    ui.objectivePointer.hidden = true;
    return;
  }

  ui.objectivePointer.hidden = false;

  // Calculate direction to objective
  const screenCenter = k.vec2(k.width() / 2, k.height() / 2);
  const objectiveScreen = camera.worldToScreen(objectivePos);
  
  // Get direction vector
  const dir = objectiveScreen.sub(screenCenter);
  const angle = Math.atan2(dir.y, dir.x) * (180 / Math.PI) + 90;

  // Position arrow at edge of screen
  const margin = 30;
  const maxX = k.width() - margin;
  const maxY = k.height() - margin;
  
  let arrowX = screenCenter.x + dir.unit().x * (k.width() / 2 - margin);
  let arrowY = screenCenter.y + dir.unit().y * (k.height() / 2 - margin);

  // Clamp to screen bounds
  arrowX = Math.max(margin, Math.min(maxX, arrowX));
  arrowY = Math.max(margin, Math.min(maxY, arrowY));

  ui.objectivePointer.pos = k.vec2(arrowX, arrowY);
  ui.objectivePointer.angle = angle;

  // Pulse effect
  ui.objectivePointer.opacity = 0.6 + Math.sin(k.time() * 4) * 0.3;
}

// Update timer display
export function updateTimer(ui: GameUI, remainingTime: number): void {
  if (ui.timerText) {
    ui.timerText.text = `${remainingTime.toFixed(1)}s`;
    
    // Change color when time is low
    if (remainingTime < 5) {
      ui.timerText.color.r = 255;
      ui.timerText.color.g = 100;
      ui.timerText.color.b = 100;
    }
  }
}

// Show floating damage text
export function showDamageText(k: KaboomCtx, pos: Vec2, text: string, color: [number, number, number] = [255, 100, 100]): void {
  const damageText = k.add([
    k.text(text, { size: 12 }),
    k.pos(pos),
    k.anchor("center"),
    k.color(color[0], color[1], color[2]),
    k.opacity(1),
    k.z(500),
    { startY: pos.y }
  ]);

  damageText.onUpdate(() => {
    damageText.pos.y -= 30 * k.dt();
    damageText.opacity -= 1.5 * k.dt();
    if (damageText.opacity <= 0) {
      damageText.destroy();
    }
  });
}

// Show ability activation text (fixed to screen)
export function showAbilityText(k: KaboomCtx, text: string): void {
  const abilityText = k.add([
    k.text(text, { size: 16 }),
    k.pos(k.width() / 2, k.height() / 2 - 50),
    k.anchor("center"),
    k.fixed(),
    k.color(255, 255, 100),
    k.opacity(1),
    k.z(1100)
  ]);

  k.tween(
    1,
    0,
    0.6,
    (val) => { abilityText.opacity = val; },
    k.easings.easeOutQuad
  ).onEnd(() => {
    abilityText.destroy();
  });

  k.tween(
    abilityText.pos.y,
    abilityText.pos.y - 30,
    0.6,
    (val) => { abilityText.pos.y = val; },
    k.easings.easeOutQuad
  );
}
