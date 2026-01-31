// Main Entry Point - Chicken Jerky Retrieval
import kaboom from "kaboom";
import { setKaboomContext } from "./types.ts";
import { loadAssets } from "./loader.ts";
import {
  mainMenuScene,
  gameOverScene,
  victoryScene,
  introScene,
  walkInScene,
  outroScene,
  gateOpeningScene,
  level1Scene,
  level2Scene,
  level3Scene,
  level4Scene,
  level5Scene
} from "./scenes/index.ts";

function createBootOverlay(): { set: (text: string) => void; remove: () => void } {
  const el = document.createElement("div");
  el.id = "boot-overlay";
  el.style.position = "fixed";
  el.style.left = "12px";
  el.style.top = "12px";
  el.style.zIndex = "999999";
  el.style.padding = "10px 12px";
  el.style.maxWidth = "min(900px, calc(100vw - 24px))";
  el.style.whiteSpace = "pre-wrap";
  el.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";
  el.style.fontSize = "12px";
  el.style.lineHeight = "1.35";
  el.style.color = "#e6e6e6";
  el.style.background = "rgba(0,0,0,0.65)";
  el.style.border = "1px solid rgba(255,255,255,0.15)";
  el.style.borderRadius = "8px";
  el.textContent = "Loading…";
  document.body.appendChild(el);

  return {
    set: (text: string) => {
      el.textContent = text;
    },
    remove: () => {
      el.remove();
    },
  };
}

const bootOverlay = createBootOverlay();

window.addEventListener("error", (ev) => {
  const anyEv = ev as unknown as { message?: string; filename?: string; lineno?: number; colno?: number; error?: unknown };
  const details = [
    anyEv.message ?? "(no message)",
    anyEv.filename ? `at ${anyEv.filename}:${anyEv.lineno ?? "?"}:${anyEv.colno ?? "?"}` : "",
    anyEv.error ? String(anyEv.error) : "",
  ]
    .filter(Boolean)
    .join("\n");
  bootOverlay.set(`Fatal error\n\n${details}`);
});

window.addEventListener("unhandledrejection", (ev) => {
  const reason = (ev as PromiseRejectionEvent).reason;
  bootOverlay.set(`Unhandled promise rejection\n\n${String(reason)}`);
});

let k: ReturnType<typeof kaboom>;

try {
  // Initialize Kaboom with fullscreen pixel-perfect settings
  k = kaboom({
    root: document.body,
    // Fullscreen mode - fills the window
    width: window.innerWidth,
    height: window.innerHeight,
    // Pixel art settings
    background: [20, 20, 30],
    font: "monospace",
    crisp: true, // Disable anti-aliasing for crisp pixels
    letterbox: false, // No letterboxing - true fullscreen
    stretch: true, // Stretch to fill window
    global: false,
    debug: false, // Set to true for debug info
    scale: 1, // Base scale (camera will handle zoom)
  });
} catch (err) {
  bootOverlay.set(`Kaboom init failed\n\n${String(err)}`);
  throw err;
}

// Handle window resize
window.addEventListener("resize", () => {
  // Kaboom handles this automatically with stretch: true
  // but we can add custom logic here if needed
});

// Load all game assets
loadAssets(k);

// Set global context
setKaboomContext(k);

// Register all scenes
k.scene("menu", () => mainMenuScene(k));
k.scene("intro", () => introScene(k));
k.scene("walk_in", () => walkInScene(k));
k.scene("level1", () => level1Scene(k));
k.scene("level2", () => level2Scene(k));
k.scene("level3", () => level3Scene(k));
k.scene("level4", () => level4Scene(k));
k.scene("gate_opening", () => gateOpeningScene(k));
k.scene("level5", () => level5Scene(k));
k.scene("gameover", () => gameOverScene(k));
k.scene("victory", () => victoryScene(k));
k.scene("outro", () => outroScene(k));

// Debug: Skip to specific level with F-keys
k.onKeyPress("f1", () => k.go("level1"));
k.onKeyPress("f2", () => k.go("level2"));
k.onKeyPress("f3", () => k.go("level3"));
k.onKeyPress("f4", () => k.go("level4"));
k.onKeyPress("f5", () => k.go("level5"));

// Start at main menu
k.go("menu");

// If we got here, the game booted.
bootOverlay.remove();

// Log game info
console.log("🍗 Chicken Jerky Retrieval - The Masked Mission 🎭");
console.log("Controls:");
console.log("  WASD/Arrow Keys - Move");
console.log("  SPACE - Use Mask Ability");
console.log("  1-4/TAB - Switch Masks (Boss Level Only)");
console.log("  ENTER - Advance Dialogue");
