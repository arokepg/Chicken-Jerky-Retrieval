// Walk-In Cinematic: Player walks from left to corp gate door
import { KaboomCtx } from "kaboom";

export function walkInScene(k: KaboomCtx): void {
  // Background - Corp Gate
  k.add([
    k.rect(k.width(), k.height()),
    k.pos(0, 0),
    k.color(20, 20, 40),
    k.z(0)
  ]);

  // Gate/Building backdrop
  const gateWidth = 200;
  const gateHeight = 180;
  const gateX = k.width() / 2;
  const gateY = k.height() / 2 - 20;

  // Building
  k.add([
    k.rect(gateWidth, gateHeight),
    k.pos(gateX, gateY),
    k.anchor("center"),
    k.color(40, 40, 60),
    k.outline(4, k.rgb(80, 80, 100)),
    k.z(1)
  ]);

  // Corp sign
  k.add([
    k.text("BAGASSE CORP", { size: 16 }),
    k.pos(gateX, gateY - 70),
    k.anchor("center"),
    k.color(200, 180, 100),
    k.z(2)
  ]);

  // Door (center of gate)
  const doorWidth = 40;
  const doorHeight = 60;
  const groundY = gateY + gateHeight / 2 - doorHeight / 2;
  
  // Door (keeping reference for potential future use)
  k.add([
    k.rect(doorWidth, doorHeight),
    k.pos(gateX, groundY + doorHeight / 2),
    k.anchor("center"),
    k.color(60, 50, 80),
    k.outline(2, k.rgb(100, 90, 120)),
    k.area(),
    k.z(2),
    "door"
  ]);

  // Door glow effect
  k.add([
    k.rect(doorWidth + 10, doorHeight + 10),
    k.pos(gateX, groundY + doorHeight / 2),
    k.anchor("center"),
    k.color(255, 200, 100),
    k.opacity(0.2),
    k.z(1)
  ]);

  // Ground line
  const playerGroundY = groundY + doorHeight;
  k.add([
    k.rect(k.width(), 4),
    k.pos(0, playerGroundY),
    k.color(50, 50, 70),
    k.z(1)
  ]);

  // Windows
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      if (col === 1 && row === 2) continue; // Skip where door is
      const winX = gateX - 60 + col * 60;
      const winY = gateY - 50 + row * 45;
      k.add([
        k.rect(20, 25),
        k.pos(winX, winY),
        k.anchor("center"),
        k.color(100, 150, 200),
        k.opacity(0.6),
        k.z(2)
      ]);
    }
  }

  // Player starts off-screen left
  const player = k.add([
    k.sprite("player"),
    k.pos(-50, playerGroundY - 8),
    k.anchor("center"),
    k.scale(2),
    k.color(79, 195, 247),
    k.z(10),
    "player"
  ]);

  // Walking speed
  const walkSpeed = 80;
  let reachedDoor = false;

  // Fade overlay for transition
  const fadeOverlay = k.add([
    k.rect(k.width(), k.height()),
    k.pos(0, 0),
    k.color(0, 0, 0),
    k.opacity(0),
    k.z(100),
    k.fixed()
  ]);

  // Instruction text
  const instructionText = k.add([
    k.text("Entering Bagasse Corp...", { size: 12 }),
    k.pos(k.width() / 2, k.height() - 40),
    k.anchor("center"),
    k.color(150, 150, 180),
    k.opacity(0.8),
    k.z(50)
  ]);

  // Auto-walk player to door
  player.onUpdate(() => {
    if (reachedDoor) return;

    // Walk right
    player.pos.x += walkSpeed * k.dt();

    // Check if reached door center
    if (player.pos.x >= gateX) {
      reachedDoor = true;
      player.pos.x = gateX;

      // Fade to black then go to level1
      instructionText.text = "...";
      
      k.tween(0, 1, 1.0, (val) => {
        fadeOverlay.opacity = val;
      }, k.easings.easeInQuad).onEnd(() => {
        k.go("level1");
      });
    }
  });

  // Skip with ENTER or SPACE
  k.onKeyPress("enter", () => {
    if (!reachedDoor) {
      reachedDoor = true;
      k.go("level1");
    }
  });

  k.onKeyPress("space", () => {
    if (!reachedDoor) {
      reachedDoor = true;
      k.go("level1");
    }
  });
}
