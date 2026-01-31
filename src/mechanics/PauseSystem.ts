// Pause System - Global pause functionality for gameplay scenes
// Works with existing gameState.isPaused() checks in update loops
import { KaboomCtx, GameObj } from "kaboom";
import { gameState } from "../state.ts";

export interface PauseUI {
  background: GameObj<any>;
  pauseText: GameObj<any>;
  subtextContainer: GameObj<any>;
  quitButton: GameObj<any>;
  quitButtonText: GameObj<any>;
}

let pauseUI: PauseUI | null = null;
let blinkCancel: (() => void) | null = null;

/**
 * Sets up the pause system for a gameplay scene.
 * Call this at the start of every Level scene (1-5).
 * The pause works with existing gameState.isPaused() checks in update loops.
 * @param k - The Kaboom context
 */
export function setupPauseSystem(k: KaboomCtx): void {
  // Reset pause state when entering a new level
  gameState.setPaused(false);
  
  // Handle ESC key press
  k.onKeyPress("escape", () => {
    // Don't pause during dialogues
    if (gameState.isDialogueActive()) return;
    
    togglePause(k);
  });
}

/**
 * Toggles the pause state
 */
function togglePause(k: KaboomCtx): void {
  if (gameState.isPaused()) {
    resumeGame(k);
  } else {
    pauseGame(k);
  }
}

/**
 * Pauses the game and shows the pause UI
 * Game logic pauses via existing gameState.isPaused() checks
 */
function pauseGame(k: KaboomCtx): void {
  // Set game state to paused - this stops all update loops that check isPaused()
  gameState.setPaused(true);
  
  // Create pause UI overlay
  createPauseUI(k);
}

/**
 * Resumes the game and destroys the pause UI
 */
function resumeGame(_k: KaboomCtx): void {
  // Set game state to not paused
  gameState.setPaused(false);
  
  // Destroy pause UI
  destroyPauseUI();
}

/**
 * Creates the pause UI overlay
 */
function createPauseUI(k: KaboomCtx): void {
  const screenW = k.width();
  const screenH = k.height();
  
  // Semi-transparent black background
  const background = k.add([
    k.rect(screenW, screenH),
    k.pos(0, 0),
    k.color(0, 0, 0),
    k.opacity(0.5),
    k.fixed(),
    k.z(999),
    "pause-ui"
  ]);
  
  // Large "PAUSED" text in center
  const pauseText = k.add([
    k.text("PAUSED", { size: 64 }),
    k.pos(screenW / 2, screenH / 2 - 50),
    k.anchor("center"),
    k.color(255, 255, 255),
    k.fixed(),
    k.z(999),
    "pause-ui"
  ]);
  
  // "Press ESC to Resume" subtext (will blink)
  const subtextContainer = k.add([
    k.text("Press ESC to Resume", { size: 24 }),
    k.pos(screenW / 2, screenH / 2 + 20),
    k.anchor("center"),
    k.color(200, 200, 200),
    k.fixed(),
    k.z(999),
    "pause-ui"
  ]);
  
  // Quit to Menu button background
  const quitButton = k.add([
    k.rect(200, 50),
    k.pos(screenW / 2, screenH / 2 + 100),
    k.anchor("center"),
    k.color(80, 40, 40),
    k.outline(2, k.rgb(150, 80, 80)),
    k.area(),
    k.fixed(),
    k.z(999),
    "pause-ui",
    "quit-button"
  ]);
  
  // Quit button text
  const quitButtonText = k.add([
    k.text("Quit to Menu", { size: 20 }),
    k.pos(screenW / 2, screenH / 2 + 100),
    k.anchor("center"),
    k.color(255, 255, 255),
    k.fixed(),
    k.z(999),
    "pause-ui"
  ]);
  
  // Store UI references
  pauseUI = {
    background,
    pauseText,
    subtextContainer,
    quitButton,
    quitButtonText
  };
  
  // Handle quit button hover
  quitButton.onHover(() => {
    quitButton.color = k.rgb(120, 60, 60);
    quitButton.outline.color = k.rgb(200, 100, 100);
  });
  
  quitButton.onHoverEnd(() => {
    quitButton.color = k.rgb(80, 40, 40);
    quitButton.outline.color = k.rgb(150, 80, 80);
  });
  
  // Handle quit button click
  quitButton.onClick(() => {
    gameState.setPaused(false);
    destroyPauseUI();
    k.go("menu");
  });
  
  // Start blink animation for subtext
  startBlinkAnimation(k, subtextContainer);
}

/**
 * Creates a blinking animation for the subtext
 * Uses k.loop which continues during pause since it's UI animation
 */
function startBlinkAnimation(k: KaboomCtx, subtext: GameObj<any>): void {
  // Use loop for blink animation
  const blinkLoop = k.loop(0.5, () => {
    if (!pauseUI || !gameState.isPaused()) {
      return;
    }
    
    // Toggle opacity between 1 and 0.3
    if (subtext.opacity > 0.5) {
      subtext.opacity = 0.3;
    } else {
      subtext.opacity = 1;
    }
  });
  
  // Store cancel function for cleanup
  blinkCancel = () => blinkLoop.cancel();
}

/**
 * Destroys all pause UI elements
 */
function destroyPauseUI(): void {
  if (!pauseUI) return;
  
  // Cancel blink animation
  if (blinkCancel) {
    blinkCancel();
    blinkCancel = null;
  }
  
  // Destroy all pause UI elements
  pauseUI.background.destroy();
  pauseUI.pauseText.destroy();
  pauseUI.subtextContainer.destroy();
  pauseUI.quitButton.destroy();
  pauseUI.quitButtonText.destroy();
  
  pauseUI = null;
}

/**
 * Check if game is currently showing pause UI
 */
export function isPauseUIVisible(): boolean {
  return pauseUI !== null;
}

/**
 * Force close pause if open (useful when switching scenes)
 */
export function forceClosePause(_k: KaboomCtx): void {
  if (gameState.isPaused()) {
    gameState.setPaused(false);
    destroyPauseUI();
  }
}
