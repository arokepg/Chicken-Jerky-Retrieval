// Level 4: The Red Stadium - Football Dribbling Challenge
// Kick the ball into the goal while avoiding Comedy Defense AI
import { KaboomCtx, GameObj } from "kaboom";
import { MaskManager } from "../mechanics/MaskManager.ts";
import { setupPauseSystem } from "../mechanics/PauseSystem.ts";
import { gameState } from "../state.ts";
import { LEVEL_DIALOGUES, MASKS } from "../constants.ts";
import { showDialogue } from "./dialogue.ts";
import { CameraController } from "../camera.ts";
import { createGameUI, updateGameUI, showMaskDescription } from "../ui.ts";
import { LEVEL_4_MAP, getPlayerSpawn, getElevatorPosition } from "../maps.ts";
import { TILE_SIZE } from "../loader.ts";

// ============= LEVEL 4 CONSTANTS =============
const DEFENDER_NAMES = ["A Bủ", "Mắc Hài", "Vuốt Phó", "A Lực", "Anh Long", "A Hoàng", "A Núi"];
const BALL_KICK_FORCE = 350;
const BALL_DRAG = 3;
const DEFENDER_COUNT = 7;

export function level4Scene(k: KaboomCtx): void {
  const map = LEVEL_4_MAP;
  
  setupPauseSystem(k);
  
  const camera = new CameraController(k, {
    zoom: 2.5,
    lerpSpeed: 0.12,
    lookAheadDistance: 25
  });
  camera.setBounds(0, 0, map.width, map.height);

  const maskManager = new MaskManager(k);
  gameState.prepareForLevel(4);
  buildLevel(k, map);

  const playerSpawn = getPlayerSpawn(map);
  const elevatorPos = getElevatorPosition(map);

  // ============= START POSITIONS (for reset) =============
  const playerStartPos = { x: playerSpawn.x, y: playerSpawn.y };
  const ballStartPos = { x: map.width / 2, y: map.height - TILE_SIZE * 4 };

  // ============= BUILD STADIUM VISUALS =============
  // Green grass background
  k.add([
    k.rect(map.width, map.height),
    k.pos(0, 0),
    k.color(34, 139, 34), // Forest green
    k.z(-1)
  ]);

  // White yard lines (horizontal)
  const yardLineCount = 8;
  for (let i = 1; i < yardLineCount; i++) {
    const lineY = (map.height / yardLineCount) * i;
    k.add([
      k.rect(map.width - TILE_SIZE * 3, 2),
      k.pos(TILE_SIZE * 1.5, lineY),
      k.color(255, 255, 255),
      k.opacity(0.7),
      k.z(0)
    ]);
  }

  // Center circle
  k.add([
    k.circle(50),
    k.pos(map.width / 2, map.height / 2),
    k.anchor("center"),
    k.color(255, 255, 255),
    k.opacity(0),
    k.outline(3, k.rgb(255, 255, 255)),
    k.z(0)
  ]);

  // Center line
  k.add([
    k.rect(map.width - TILE_SIZE * 3, 3),
    k.pos(TILE_SIZE * 1.5, map.height / 2),
    k.color(255, 255, 255),
    k.opacity(0.7),
    k.z(0)
  ]);

  // ============= STADIUM CROWD (Sidelines) =============
  const crowdColors = [k.rgb(200, 50, 50), k.rgb(180, 40, 40), k.rgb(220, 60, 60), k.rgb(255, 80, 80)];
  
  // Left sideline crowd
  for (let i = 0; i < 15; i++) {
    const crowdY = TILE_SIZE * 2 + i * ((map.height - TILE_SIZE * 4) / 15);
    const crowdMember = k.add([
      k.rect(10, 14),
      k.pos(TILE_SIZE * 0.6, crowdY),
      k.anchor("center"),
      k.color(crowdColors[i % crowdColors.length]),
      k.z(2),
      { baseX: TILE_SIZE * 0.6, wavePhase: k.rand(0, Math.PI * 2) }
    ]);
    
    crowdMember.onUpdate(() => {
      crowdMember.pos.x = crowdMember.baseX + Math.sin(k.time() * 3 + crowdMember.wavePhase) * 3;
    });
  }

  // Right sideline crowd
  for (let i = 0; i < 15; i++) {
    const crowdY = TILE_SIZE * 2 + i * ((map.height - TILE_SIZE * 4) / 15);
    const crowdMember = k.add([
      k.rect(10, 14),
      k.pos(map.width - TILE_SIZE * 0.6, crowdY),
      k.anchor("center"),
      k.color(crowdColors[i % crowdColors.length]),
      k.z(2),
      { baseX: map.width - TILE_SIZE * 0.6, wavePhase: k.rand(0, Math.PI * 2) }
    ]);
    
    crowdMember.onUpdate(() => {
      crowdMember.pos.x = crowdMember.baseX + Math.sin(k.time() * 3 + crowdMember.wavePhase) * 3;
    });
  }

  // ============= GOAL AREA (Top center) =============
  const goalWidth = 120;
  const goalHeight = 40;
  const goalX = map.width / 2;
  const goalY = TILE_SIZE * 2.5;

  // Goal posts (white frame)
  k.add([
    k.rect(goalWidth + 10, goalHeight + 6, { radius: 3 }),
    k.pos(goalX, goalY),
    k.anchor("center"),
    k.color(255, 255, 255),
    k.outline(4, k.rgb(200, 200, 200)),
    k.z(4)
  ]);

  // Goal net (inner dark area)
  k.add([
    k.rect(goalWidth, goalHeight, { radius: 2 }),
    k.pos(goalX, goalY),
    k.anchor("center"),
    k.color(30, 30, 30),
    k.z(5)
  ]);

  // Net pattern (visual)
  for (let i = 0; i < 6; i++) {
    k.add([
      k.rect(2, goalHeight - 8),
      k.pos(goalX - goalWidth / 2 + 10 + i * 18, goalY),
      k.anchor("center"),
      k.color(150, 150, 150),
      k.opacity(0.4),
      k.z(6)
    ]);
  }

  // Goal detection area (invisible trigger)
  k.add([
    k.rect(goalWidth - 20, goalHeight - 10),
    k.pos(goalX, goalY),
    k.anchor("center"),
    k.area(),
    k.opacity(0),
    k.z(3),
    "goal_area"
  ]);

  // Goal label
  k.add([
    k.text("⚽ GOAL ⚽", { size: 8 }),
    k.pos(goalX, goalY - goalHeight / 2 - 12),
    k.anchor("center"),
    k.color(255, 215, 0),
    k.z(10)
  ]);

  // ============= THE BALL (Chicken Jerky Box look) =============
  const ball = k.add([
    k.sprite("jerky"),
    k.pos(ballStartPos.x, ballStartPos.y),
    k.anchor("center"),
    k.scale(1.2),
    k.area({ scale: k.vec2(0.8, 0.8) }),
    k.z(8),
    "ball",
    {
      vel: k.vec2(0, 0),
      drag: BALL_DRAG
    }
  ]);

  // Ball physics update
  ball.onUpdate(() => {
    if (gameState.isPaused() || gameState.isDialogueActive()) return;
    
    const dt = k.dt();
    
    // Apply velocity
    ball.pos = ball.pos.add(ball.vel.scale(dt));
    
    // Apply drag (friction)
    ball.vel = ball.vel.scale(1 - ball.drag * dt);
    
    // Stop if very slow
    if (ball.vel.len() < 5) {
      ball.vel = k.vec2(0, 0);
    }
    
    // Bounce off walls
    if (ball.pos.x < TILE_SIZE * 1.5) {
      ball.pos.x = TILE_SIZE * 1.5;
      ball.vel.x *= -0.6;
    }
    if (ball.pos.x > map.width - TILE_SIZE * 1.5) {
      ball.pos.x = map.width - TILE_SIZE * 1.5;
      ball.vel.x *= -0.6;
    }
    if (ball.pos.y < TILE_SIZE * 1.5) {
      ball.pos.y = TILE_SIZE * 1.5;
      ball.vel.y *= -0.6;
    }
    if (ball.pos.y > map.height - TILE_SIZE * 1.5) {
      ball.pos.y = map.height - TILE_SIZE * 1.5;
      ball.vel.y *= -0.6;
    }
  });

  // ============= PLAYER =============
  const player = createPlayer(k, playerStartPos.x, playerStartPos.y, maskManager, map);
  maskManager.initPlayerMask(player);
  camera.snapTo(k.vec2(playerSpawn.x, playerSpawn.y));

  // ============= SAFE TUTORIAL START =============
  // Defenders don't activate until tutorial UI is dismissed
  let challengeStarted = false;
  
  // ============= COMEDY DEFENSE AI (Defenders) =============
  const defenders: GameObj<any>[] = [];
  
  type DefenderState = "confused" | "chase";
  
  for (let i = 0; i < DEFENDER_COUNT; i++) {
    // Spread defenders across the field
    const defX = TILE_SIZE * 3 + k.rand(0, map.width - TILE_SIZE * 6);
    const defY = TILE_SIZE * 5 + k.rand(0, map.height - TILE_SIZE * 10);
    
    const defender = k.add([
      k.rect(12, 16, { radius: 2 }),
      k.pos(defX, defY),
      k.anchor("center"),
      k.area(),
      k.color(200, 40, 40), // Red kit
      k.outline(2, k.rgb(255, 255, 255)),
      k.z(7),
      "defender",
      "enemy",
      {
        name: DEFENDER_NAMES[i % DEFENDER_NAMES.length],
        jerseyNum: Math.floor(k.rand(1, 99)),
        state: "confused" as DefenderState,
        speed: k.rand(70, 110),
        confusedDir: k.vec2(k.rand(-1, 1), k.rand(-1, 1)).unit(),
        confusedTimer: 0,
        confusedInterval: k.rand(0.4, 1.0),
        circlePhase: k.rand(0, Math.PI * 2),
        chaseRadius: k.rand(80, 140) // Distance to start chasing ball
      }
    ]);

    // Draw defender details
    defender.onDraw(() => {
      // Name above head
      k.drawText({
        text: defender.name,
        pos: k.vec2(0, -18),
        size: 5,
        anchor: "center",
        color: k.rgb(255, 220, 220)
      });
      // Jersey number
      k.drawText({
        text: String(defender.jerseyNum),
        pos: k.vec2(0, 0),
        size: 7,
        anchor: "center",
        color: k.rgb(255, 255, 255)
      });
      // State indicator
      if (defender.state === "confused") {
        k.drawText({
          text: "?",
          pos: k.vec2(8, -8),
          size: 6,
          color: k.rgb(255, 255, 100)
        });
      } else {
        k.drawText({
          text: "!",
          pos: k.vec2(8, -8),
          size: 6,
          color: k.rgb(255, 50, 50)
        });
      }
    });

    defenders.push(defender);
  }

  // Defender AI Update
  function updateDefender(def: GameObj<any>, dt: number): void {
    // Safe Tutorial Start: Don't move until challenge begins
    if (!challengeStarted) {
      def.color = k.rgb(100, 100, 100); // Inactive grey
      return;
    }
    
    if (gameState.isTimeFrozen()) {
      def.color = k.rgb(100, 60, 60); // Frozen color
      return;
    } else {
      def.color = k.rgb(200, 40, 40);
    }

    const distToBall = def.pos.dist(ball.pos);
    
    // State transitions
    if (distToBall < def.chaseRadius && ball.vel.len() > 20) {
      def.state = "chase";
    } else if (distToBall > def.chaseRadius * 1.5 || ball.vel.len() < 10) {
      def.state = "confused";
    }

    if (def.state === "confused") {
      // Comedy: Run in small circles
      def.confusedTimer += dt;
      if (def.confusedTimer >= def.confusedInterval) {
        def.confusedTimer = 0;
        def.confusedInterval = k.rand(0.3, 0.8);
        
        // Circular motion
        def.circlePhase += k.rand(0.8, 1.5);
        def.confusedDir = k.vec2(
          Math.cos(def.circlePhase),
          Math.sin(def.circlePhase)
        );
      }
      def.move(def.confusedDir.scale(def.speed * 0.5));
    } else {
      // Chase the ball aggressively
      const dirToBall = ball.pos.sub(def.pos).unit();
      def.move(dirToBall.scale(def.speed * 1.3));
    }

    // Keep within bounds
    def.pos.x = k.clamp(def.pos.x, TILE_SIZE * 2, map.width - TILE_SIZE * 2);
    def.pos.y = k.clamp(def.pos.y, TILE_SIZE * 3, map.height - TILE_SIZE * 2);

    // Defenders bump each other
    defenders.forEach(other => {
      if (other === def || !other.exists()) return;
      if (def.pos.dist(other.pos) < 18) {
        const pushDir = def.pos.sub(other.pos).unit();
        def.pos = def.pos.add(pushDir.scale(2));
      }
    });
  }

  // ============= TACKLE MECHANIC (VAR Check!) =============
  let isTackled = false;

  function triggerTackle(): void {
    if (isTackled) return;
    isTackled = true;

    // Freeze game briefly
    gameState.setPaused(true);

    // VAR Check visual
    const varOverlay = k.add([
      k.rect(k.width(), k.height()),
      k.pos(0, 0),
      k.color(0, 0, 0),
      k.opacity(0.7),
      k.z(500),
      k.fixed()
    ]);

    const varText = k.add([
      k.text("🔴 VAR CHECK! 🔴", { size: 24 }),
      k.pos(k.width() / 2, k.height() / 2 - 20),
      k.anchor("center"),
      k.color(255, 50, 50),
      k.z(501),
      k.fixed()
    ]);

    const whistleText = k.add([
      k.text("📣 FOUL! Reset position...", { size: 14 }),
      k.pos(k.width() / 2, k.height() / 2 + 20),
      k.anchor("center"),
      k.color(255, 255, 200),
      k.z(501),
      k.fixed()
    ]);

    camera.shake(10, 0.3);

    k.wait(0.5, () => {
      // Reset positions
      player.pos = k.vec2(playerStartPos.x, playerStartPos.y);
      player.knockbackVel = k.vec2(0, 0);
      ball.pos = k.vec2(ballStartPos.x, ballStartPos.y);
      ball.vel = k.vec2(0, 0);

      varOverlay.destroy();
      varText.destroy();
      whistleText.destroy();

      gameState.setPaused(false);
      isTackled = false;
    });
  }

  // Player kicks ball on collision
  player.onCollide("ball", () => {
    if (gameState.isPaused() || gameState.isDialogueActive()) return;
    if (player.dir.len() < 0.1) return; // Only kick if moving

    // Kick ball in player's movement direction
    const kickDir = player.dir.unit();
    ball.vel = kickDir.scale(BALL_KICK_FORCE);

    // Small feedback
    camera.shake(2, 0.1);
  });

  // Defender tackles player
  player.onCollide("defender", () => {
    if (gameState.isPlayerEthereal()) return;
    if (gameState.isInvincible()) return;
    if (gameState.isPlayerShielding()) {
      // Shield pushes defender away
      return;
    }
    triggerTackle();
  });

  // Defender tackles ball
  ball.onCollide("defender", () => {
    if (gameState.isTimeFrozen()) return;
    triggerTackle();
  });

  // ============= GOAL DETECTION =============
  let goalScored = false;

  ball.onCollide("goal_area", () => {
    if (goalScored) return;
    goalScored = true;

    // GOAL celebration!
    gameState.setPaused(true);

    const goalOverlay = k.add([
      k.rect(k.width(), k.height()),
      k.pos(0, 0),
      k.color(0, 50, 0),
      k.opacity(0.8),
      k.z(500),
      k.fixed()
    ]);

    k.add([
      k.text("⚽ GOOOOAL!! ⚽", { size: 28 }),
      k.pos(k.width() / 2, k.height() / 2),
      k.anchor("center"),
      k.color(255, 215, 0),
      k.z(501),
      k.fixed()
    ]);

    camera.shake(15, 0.5);

    k.wait(2, () => {
      goalOverlay.destroy();
      gameState.setPaused(false);
      
      // Mask already acquired at floor entry
      showDialogue(k, LEVEL_DIALOGUES[4].outro!, () => {
        k.go("gate_opening");
      });
    });
  });

  // ============= ELEVATOR (hidden until goal) =============
  k.add([
    k.sprite("elevator"),
    k.pos(elevatorPos.x, elevatorPos.y),
    k.anchor("center"),
    k.area(),
    k.opacity(0.3),
    k.z(5),
    "elevator"
  ]);

  // Create UI
  const ui = createGameUI(k);

  // Stadium title
  k.add([
    k.text("⚽ SÂN VẬN ĐỘNG ĐỎ ⚽", { size: 8 }),
    k.pos(map.width / 2, map.height - TILE_SIZE * 1.2),
    k.anchor("center"),
    k.color(255, 255, 200),
    k.z(10)
  ]);

  // Instruction text
  k.add([
    k.text("Kick the Jerky Box into the Goal!", { size: 6 }),
    k.pos(map.width / 2, map.height - TILE_SIZE * 0.6),
    k.anchor("center"),
    k.color(200, 200, 150),
    k.z(10)
  ]);

  // ============= MAIN UPDATE LOOP =============
  k.onUpdate(() => {
    if (gameState.isPaused() || gameState.isDialogueActive()) return;

    const dt = k.dt();
    maskManager.update(dt);
    maskManager.updatePlayerMask();

    // Camera follows player (with slight pull toward ball)
    camera.follow(player, k.mousePos());

    // Update defenders
    defenders.forEach(def => {
      if (def.exists()) {
        updateDefender(def, dt);
      }
    });

    // Update UI
    updateGameUI(k, ui, maskManager, k.vec2(goalX, goalY), camera);
  });

  // Show intro dialogue - Grant mask at floor ENTRY
  showDialogue(k, LEVEL_DIALOGUES[4].intro, () => {
    // Grant Freeze Mask on entry to Floor 4
    gameState.addCollectedMask(MASKS.frozen);
    gameState.setCurrentMask(MASKS.frozen);
    showAcquiredNotification(k, "FREEZE MASK");
    
    gameState.setDialogueActive(false);
    // Show mask description after dialogue
    showMaskDescription(k, 4);
    
    // Safe Tutorial Start: Begin challenge AFTER tutorial UI fades (3.5s total)
    k.wait(3.5, () => {
      challengeStarted = true;
      
      // Flash defenders red to show they're now active
      defenders.forEach(def => {
        if (def.exists()) {
          k.tween(k.rgb(100, 100, 100), k.rgb(200, 40, 40), 0.3, (c) => {
            def.color = c;
          }, k.easings.easeOutQuad);
        }
      });
    });
  });
}

// Show ACQUIRED notification
function showAcquiredNotification(k: KaboomCtx, maskName: string): void {
  const notification = k.add([
    k.text(`✨ ACQUIRED: ${maskName} ✨`, { size: 16 }),
    k.pos(k.width() / 2, k.height() * 0.25),
    k.anchor("center"),
    k.color(255, 215, 0), // Gold
    k.opacity(0),
    k.z(2000),
    k.fixed()
  ]);
  
  // Fade in, hold, fade out
  k.tween(0, 1, 0.4, (val) => { notification.opacity = val; }, k.easings.easeOutQuad);
  k.wait(2.5, () => {
    k.tween(1, 0, 0.6, (val) => { notification.opacity = val; }, k.easings.easeInQuad)
      .onEnd(() => notification.destroy());
  });
}

// ============= BUILD LEVEL =============
function buildLevel(k: KaboomCtx, map: typeof LEVEL_4_MAP): void {
  for (let y = 0; y < map.tiles.length; y++) {
    for (let x = 0; x < map.tiles[y].length; x++) {
      const char = map.tiles[y][x];
      const posX = x * TILE_SIZE + TILE_SIZE / 2;
      const posY = y * TILE_SIZE + TILE_SIZE / 2;

      // Floor tiles (grass)
      k.add([
        k.sprite(map.floorSprite),
        k.pos(posX, posY),
        k.anchor("center"),
        k.z(0)
      ]);

      if (char === '#') {
        k.add([
          k.sprite(map.wallSprite),
          k.pos(posX, posY),
          k.anchor("center"),
          k.area(),
          k.body({ isStatic: true }),
          k.z(2),
          "wall"
        ]);
      }
    }
  }
  
  // Map boundaries
  const mapWidth = map.tiles[0].length * TILE_SIZE;
  const mapHeight = map.tiles.length * TILE_SIZE;
  const boundaryThickness = 16;
  
  [[mapWidth + 32, boundaryThickness, -16, -boundaryThickness],
   [mapWidth + 32, boundaryThickness, -16, mapHeight],
   [boundaryThickness, mapHeight + 32, -boundaryThickness, -16],
   [boundaryThickness, mapHeight + 32, mapWidth, -16]
  ].forEach(([w, h, x, y]) => {
    k.add([
      k.rect(w, h),
      k.pos(x, y),
      k.area(),
      k.body({ isStatic: true }),
      k.opacity(0),
      k.z(100),
      "boundary"
    ]);
  });
}

// ============= CREATE PLAYER =============
function createPlayer(k: KaboomCtx, x: number, y: number, maskManager: MaskManager, map: typeof LEVEL_4_MAP): GameObj<any> {
  // Player state machine
  let currentState: "idle" | "run" = "idle";
  let currentDirection: "down" | "up" | "right" | "left" = "down";
  let lastDirection: "down" | "up" | "right" | "left" = "down";

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
      speed: 120,
      dir: k.vec2(0, 0),
      knockbackVel: k.vec2(0, 0)
    }
  ]);

  try { player.play("idle-down"); } catch {}

  // Mask overlay (Paper Doll system - Face-Only Attachment)
  const maskOverlay = k.add([
    k.sprite("mask-frozen"),
    k.pos(x, y - 5),
    k.anchor("center"),
    k.scale(0.35),
    k.opacity(0),
    k.z(11),
    "mask-overlay"
  ]);

  function getDirection(dir: { x: number; y: number }): "down" | "up" | "right" | "left" {
    if (Math.abs(dir.x) > Math.abs(dir.y)) return dir.x > 0 ? "right" : "left";
    else if (dir.y !== 0) return dir.y > 0 ? "down" : "up";
    return lastDirection;
  }

  player.onUpdate(() => {
    if (gameState.isPaused() || gameState.isDialogueActive()) return;

    const dt = k.dt();

    // Apply knockback
    if (player.knockbackVel.len() > 1) {
      player.move(player.knockbackVel);
      player.knockbackVel = player.knockbackVel.lerp(k.vec2(0, 0), dt * 10);
    } else {
      player.knockbackVel = k.vec2(0, 0);
    }

    const dir = k.vec2(0, 0);
    if (k.isKeyDown("left") || k.isKeyDown("a")) dir.x -= 1;
    if (k.isKeyDown("right") || k.isKeyDown("d")) dir.x += 1;
    if (k.isKeyDown("up") || k.isKeyDown("w")) dir.y -= 1;
    if (k.isKeyDown("down") || k.isKeyDown("s")) dir.y += 1;

    const isMoving = dir.len() > 0.1;
    const newState = isMoving ? "run" : "idle";

    if (isMoving) {
      currentDirection = getDirection(dir);
      lastDirection = currentDirection;
      player.dir = dir.unit();
      player.move(player.dir.scale(player.speed));
    }

    if (newState !== currentState) {
      currentState = newState;
      const spriteName = newState === "run" ? "vu-run" : "vu-idle";
      const animName = `${newState === "run" ? "run" : "idle"}-${currentDirection}`;
      try { player.use(k.sprite(spriteName)); player.play(animName); } catch {}
    }

    // Mask overlay update (follows player head position)
    maskOverlay.pos.x = player.pos.x;
    maskOverlay.pos.y = player.pos.y - 5 + (currentState === "run" ? Math.sin(k.time() * 15) * 0.5 : 0);
    const currentMask = gameState.getPlayerState().currentMask;
    if (currentMask) {
      maskOverlay.opacity = 0.9;
      const maskSprites: Record<string, string> = { shield: "mask-shield", ghost: "mask-ghost", frozen: "mask-frozen", silence: "mask-silence" };
      try { maskOverlay.use(k.sprite(maskSprites[currentMask.id] || "mask-frozen")); maskOverlay.scale = k.vec2(0.35, 0.35); } catch {}
    } else {
      maskOverlay.opacity = 0;
    }

    // Boundary clamp
    const minX = TILE_SIZE * 1.5;
    const minY = TILE_SIZE * 1.5;
    const maxX = map.width - TILE_SIZE * 1.5;
    const maxY = map.height - TILE_SIZE * 1.5;
    player.pos.x = k.clamp(player.pos.x, minX, maxX);
    player.pos.y = k.clamp(player.pos.y, minY, maxY);

    // Shield visual (golden tint when shielding)
    if (gameState.isPlayerShielding()) {
      player.opacity = 1;
    }
  });

  k.onKeyPress("space", () => {
    if (gameState.isPaused() || gameState.isDialogueActive()) return;
    maskManager.activateAbility(player);
  });

  return player;
}
