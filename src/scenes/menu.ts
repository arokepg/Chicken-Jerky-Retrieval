// Menu Scenes - Main Menu, Game Over, Victory
import { KaboomCtx } from "kaboom";
import { gameState } from "../state";

export function mainMenuScene(k: KaboomCtx): void {
  // Get actual screen dimensions for fullscreen
  const screenW = k.width();
  const screenH = k.height();
  
  // Background - covers full screen
  k.add([
    k.rect(screenW, screenH),
    k.pos(0, 0),
    k.color(20, 20, 35),
    k.z(0)
  ]);

  // Title - responsive size
  const titleSize = Math.min(48, screenW / 16);
  k.add([
    k.text("CHICKEN JERKY", { size: titleSize }),
    k.pos(screenW / 2, screenH * 0.15),
    k.anchor("center"),
    k.color(255, 200, 100),
    k.z(1)
  ]);

  k.add([
    k.text("RETRIEVAL", { size: titleSize }),
    k.pos(screenW / 2, screenH * 0.22),
    k.anchor("center"),
    k.color(255, 200, 100),
    k.z(1)
  ]);

  // Subtitle
  k.add([
    k.text("The Masked Mission", { size: Math.min(24, screenW / 32) }),
    k.pos(screenW / 2, screenH * 0.30),
    k.anchor("center"),
    k.color(150, 150, 200),
    k.z(1)
  ]);

  // Story intro
  const storyLines = [
    "Vu - A covert agent on a crucial mission.",
    "The target: The Golden Jerky Box",
    "The location: Bagasse Corp Tower",
    "Infiltrate. Survive. Retrieve."
  ];

  storyLines.forEach((line, i) => {
    k.add([
      k.text(line, { size: Math.min(14, screenW / 55) }),
      k.pos(screenW / 2, screenH * 0.42 + i * 25),
      k.anchor("center"),
      k.color(180, 180, 180),
      k.z(1)
    ]);
  });

  // Start prompt
  const startText = k.add([
    k.text("Press ENTER or SPACE to Start", { size: Math.min(20, screenW / 40) }),
    k.pos(screenW / 2, screenH * 0.68),
    k.anchor("center"),
    k.color(100, 255, 150),
    k.z(1)
  ]);

  // Blinking animation
  startText.onUpdate(() => {
    const startTextOpacity = 0.6 + Math.sin(k.time() * 4) * 0.4;
    startText.color = k.rgb(100 * startTextOpacity, 255 * startTextOpacity, 150 * startTextOpacity);
  });

  // Controls info
  k.add([
    k.text("Controls: WASD/Arrows = Move | SPACE = Use Ability", { size: Math.min(12, screenW / 65) }),
    k.pos(screenW / 2, screenH * 0.80),
    k.anchor("center"),
    k.color(120, 120, 120),
    k.z(1)
  ]);

  // Credits
  k.add([
    k.text("Game Jam 2026 - Made with Kaboom.js", { size: Math.min(10, screenW / 80) }),
    k.pos(screenW / 2, screenH - 20),
    k.anchor("center"),
    k.color(80, 80, 80),
    k.z(1)
  ]);

  // Start game - go to intro first
  k.onKeyPress("enter", () => {
    gameState.resetGameState();
    k.go("intro");
  });

  k.onKeyPress("space", () => {
    gameState.resetGameState();
    k.go("intro");
  });
}

export function gameOverScene(k: KaboomCtx): void {
  const screenW = k.width();
  const screenH = k.height();
  
  // Background
  k.add([
    k.rect(screenW, screenH),
    k.pos(0, 0),
    k.color(30, 15, 15),
    k.z(0)
  ]);

  // Game Over text
  k.add([
    k.text("GAME OVER", { size: Math.min(64, screenW / 12) }),
    k.pos(screenW / 2, screenH * 0.25),
    k.anchor("center"),
    k.color(255, 80, 80),
    k.z(1)
  ]);

  // Failed floor
  k.add([
    k.text(`Failed at Floor ${gameState.getCurrentLevel()}`, { size: Math.min(24, screenW / 32) }),
    k.pos(screenW / 2, screenH * 0.38),
    k.anchor("center"),
    k.color(200, 150, 150),
    k.z(1)
  ]);

  // Flavor text
  const flavorTexts: Record<number, string> = {
    1: "The guards caught you sneaking around...",
    2: "The creditors got you! 'Nợ nần gì tầm này!'",
    3: "Frozen by the T-One curse...",
    4: "Pelted by too many bricks and comments!",
    5: "The CEO was too powerful..."
  };

  k.add([
    k.text(flavorTexts[gameState.getCurrentLevel()] || "Mission failed!", { 
      size: Math.min(16, screenW / 50),
      width: screenW - 100,
      align: "center"
    }),
    k.pos(screenW / 2, screenH * 0.48),
    k.anchor("center"),
    k.color(180, 120, 120),
    k.z(1)
  ]);

  // Retry prompt
  const retryText = k.add([
    k.text("Press ENTER to Retry | ESC for Menu", { size: Math.min(20, screenW / 40) }),
    k.pos(screenW / 2, screenH * 0.65),
    k.anchor("center"),
    k.color(150, 200, 150),
    k.z(1)
  ]);

  retryText.onUpdate(() => {
    const retryTextOpacity = 0.6 + Math.sin(k.time() * 3) * 0.4;
    retryText.color = k.rgb(150 * retryTextOpacity, 200 * retryTextOpacity, 150 * retryTextOpacity);
  });

  // Retry current level
  k.onKeyPress("enter", () => {
    gameState.resetPlayerState();
    k.go(`level${gameState.getCurrentLevel()}`);
  });

  // Back to menu
  k.onKeyPress("escape", () => {
    gameState.resetGameState();
    k.go("menu");
  });
}

export function victoryScene(k: KaboomCtx): void {
  const screenW = k.width();
  const screenH = k.height();
  
  // Background - celebratory
  k.add([
    k.rect(screenW, screenH),
    k.pos(0, 0),
    k.color(20, 35, 25),
    k.z(0)
  ]);

  // Confetti effect
  for (let i = 0; i < 50; i++) {
    const confetti = k.add([
      k.rect(k.rand(5, 12), k.rand(5, 12)),
      k.pos(k.rand(0, screenW), k.rand(-100, screenH)),
      k.color(
        k.rand(100, 255),
        k.rand(100, 255),
        k.rand(100, 255)
      ),
      k.rotate(k.rand(0, 360)),
      k.z(1),
      {
        speed: k.rand(50, 150),
        rotSpeed: k.rand(-180, 180)
      }
    ]);

    confetti.onUpdate(() => {
      confetti.pos.y += confetti.speed * k.dt();
      confetti.angle += confetti.rotSpeed * k.dt();
      if (confetti.pos.y > screenH + 20) {
        confetti.pos.y = -20;
        confetti.pos.x = k.rand(0, screenW);
      }
    });
  }

  // Victory text
  k.add([
    k.text("🎉 VICTORY! 🎉", { size: Math.min(56, screenW / 14) }),
    k.pos(screenW / 2, screenH * 0.15),
    k.anchor("center"),
    k.color(255, 215, 0), // Gold
    k.z(10)
  ]);

  // Story conclusion
  const conclusionLines = [
    "Vu successfully retrieved the Golden Jerky Box!",
    "",
    "The Final Boss admitted defeat:",
    "\"Well done, I'm proud of you.\"",
    "",
    "Mother and son went home,",
    "enjoying jerky while watching 24h Motion News.",
    "",
    "THE END"
  ];

  conclusionLines.forEach((line, i) => {
    k.add([
      k.text(line, { size: Math.min(16, screenW / 50), width: screenW - 100 }),
      k.pos(screenW / 2, screenH * 0.28 + i * 28),
      k.anchor("center"),
      k.color(200, 230, 200),
      k.z(10)
    ]);
  });

  // Chicken jerky emoji
  k.add([
    k.text("🍗", { size: Math.min(48, screenW / 16) }),
    k.pos(screenW / 2, screenH * 0.82),
    k.anchor("center"),
    k.z(10)
  ]);

  // Menu prompt
  const menuText = k.add([
    k.text("Press ENTER to Play Again", { size: Math.min(18, screenW / 44) }),
    k.pos(screenW / 2, screenH - 40),
    k.anchor("center"),
    k.color(150, 255, 150),
    k.z(10)
  ]);

  menuText.onUpdate(() => {
    const menuTextOpacity = 0.6 + Math.sin(k.time() * 3) * 0.4;
    menuText.color = k.rgb(150 * menuTextOpacity, 255 * menuTextOpacity, 150 * menuTextOpacity);
  });

  k.onKeyPress("enter", () => {
    gameState.resetGameState();
    k.go("menu");
  });
}
