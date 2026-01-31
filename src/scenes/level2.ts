// Level 2: The Debt Office - SURVIVAL LEVEL (Wave-Based Patterns)
// Completely reworked for fair, predictable gameplay
import { KaboomCtx, GameObj } from "kaboom";
import { MaskManager } from "../mechanics/MaskManager.ts";
import { setupPauseSystem } from "../mechanics/PauseSystem.ts";
import { gameState } from "../state.ts";
import { LEVEL_DIALOGUES, MASKS } from "../constants.ts";
import { showDialogue } from "./dialogue.ts";
import { CameraController } from "../camera.ts";
import { createGameUI, updateGameUI, showMaskDescription } from "../ui.ts";
import { LEVEL_2_MAP, getPlayerSpawn } from "../maps.ts";
import { TILE_SIZE } from "../loader.ts";

export function level2Scene(k: KaboomCtx): void {
  const map = LEVEL_2_MAP;
  
  // Setup pause system
  setupPauseSystem(k);
  
  // Initialize camera
  const camera = new CameraController(k, {
    zoom: 3,
    lerpSpeed: 0.1,
    lookAheadDistance: 15
  });
  camera.setBounds(0, 0, map.width, map.height);

  // Initialize mask manager
  const maskManager = new MaskManager(k);
  
  // Prepare player state
  gameState.prepareForLevel(2);

  // Build level
  buildLevel(k, map);

  // ============= INVISIBLE BOUNDARY WALLS =============
  const WALL_THICKNESS = TILE_SIZE;
  
  // Top/Bottom/Left/Right walls
  k.add([k.rect(map.width + WALL_THICKNESS * 2, WALL_THICKNESS), k.pos(-WALL_THICKNESS, -WALL_THICKNESS), k.area(), k.body({ isStatic: true }), k.opacity(0), "boundary"]);
  k.add([k.rect(map.width + WALL_THICKNESS * 2, WALL_THICKNESS), k.pos(-WALL_THICKNESS, map.height), k.area(), k.body({ isStatic: true }), k.opacity(0), "boundary"]);
  k.add([k.rect(WALL_THICKNESS, map.height + WALL_THICKNESS * 2), k.pos(-WALL_THICKNESS, -WALL_THICKNESS), k.area(), k.body({ isStatic: true }), k.opacity(0), "boundary"]);
  k.add([k.rect(WALL_THICKNESS, map.height + WALL_THICKNESS * 2), k.pos(map.width, -WALL_THICKNESS), k.area(), k.body({ isStatic: true }), k.opacity(0), "boundary"]);

  // Get spawn position
  const playerSpawn = getPlayerSpawn(map);

  // ============= INVINCIBILITY SYSTEM =============
  let playerInvincible = false;
  let invincibilityTimer = 0;
  const INVINCIBILITY_DURATION = 2.0; // 2 FULL SECONDS of god mode after hit
  let blinkLoop: { cancel: () => void } | null = null;

  function triggerInvincibility(player: GameObj<any>): void {
    if (playerInvincible) return;
    
    playerInvincible = true;
    invincibilityTimer = INVINCIBILITY_DURATION;
    gameState.setInvincible(true);
    
    // Flashing effect (opacity 0.3 <-> 1.0)
    blinkLoop = k.loop(0.1, () => {
      if (player.exists()) {
        player.opacity = player.opacity > 0.5 ? 0.3 : 1.0;
      }
    });
  }

  function updateInvincibility(player: GameObj<any>, dt: number): void {
    if (!playerInvincible) return;
    
    invincibilityTimer -= dt;
    if (invincibilityTimer <= 0) {
      playerInvincible = false;
      gameState.setInvincible(false);
      if (blinkLoop) {
        blinkLoop.cancel();
        blinkLoop = null;
      }
      if (player.exists()) {
        player.opacity = 1;
        player.color = k.rgb(79, 195, 247);
      }
    }
  }

  function damagePlayer(player: GameObj<any>, amount: number = 1): boolean {
    // CHECK INVINCIBILITY FIRST - CRITICAL
    if (playerInvincible) return false;
    if (gameState.isPlayerEthereal()) return false;
    if (gameState.isInvincible()) return false;
    
    // Apply damage
    gameState.damagePlayer(amount);
    camera.shake(8, 0.3);
    
    // Visual feedback - flash red
    player.color = k.rgb(255, 50, 50);
    
    // Trigger invincibility frames
    triggerInvincibility(player);
    
    // Check death
    if (gameState.isPlayerDead()) {
      k.go("gameover");
      return true;
    }
    
    return false;
  }

  // Create player
  const player = createPlayer(k, playerSpawn.x, playerSpawn.y, maskManager, map.width, map.height);
  maskManager.initPlayerMask(player);
  camera.snapTo(k.vec2(playerSpawn.x, playerSpawn.y));

  // Create Debt Manager (NPC at top)
  const tuSe = createTuSe(k, map.width / 2, 40);

  // ============= GAME CONSTANTS =============
  const SURVIVAL_TIME = 15;
  let timeElapsed = 0;
  let levelComplete = false;
  let elevatorOpen = false;

  // ============= UI ELEMENTS =============
  const ui = createGameUI(k);

  // BIG COUNTDOWN TIMER - Top center, very visible
  const timerText = k.add([
    k.text("15", { size: 16 }),
    k.pos(map.width / 2, 15),
    k.anchor("center"),
    k.color(255, 255, 100),
    k.z(100),
    "temporary_junk"
  ]);

  // Phase indicator
  const phaseText = k.add([
    k.text("PHASE 1: LASER LINES", { size: 8 }),
    k.pos(map.width / 2, 30),
    k.anchor("center"),
    k.color(255, 150, 150),
    k.z(100),
    "temporary_junk"
  ]);

  // Tutorial text
  const tutorialText = k.add([
    k.text("Survive 15 seconds! Avoid RED hazards!", { size: 7 }),
    k.pos(map.width / 2, map.height - 20),
    k.anchor("center"),
    k.color(100, 255, 200),
    k.z(100),
    k.opacity(1)
  ]);
  k.wait(4, () => {
    if (tutorialText.exists()) {
      k.tween(1, 0, 1, (val) => { if (tutorialText.exists()) tutorialText.opacity = val; });
    }
  });

  // ============= ELEVATOR SETUP =============
  const elevatorX = map.width - TILE_SIZE * 3;
  const elevatorY = TILE_SIZE * 1.5;

  const elevator = k.add([
    k.rect(TILE_SIZE * 1.5, TILE_SIZE),
    k.pos(elevatorX, elevatorY),
    k.anchor("center"),
    k.color(80, 80, 100),
    k.outline(2, k.rgb(60, 60, 80)),
    k.area(),
    k.z(3),
    "elevator"
  ]);

  k.add([
    k.text("EXIT", { size: 6 }),
    k.pos(elevatorX, elevatorY + 10),
    k.anchor("center"),
    k.color(150, 150, 150),
    k.z(4)
  ]);

  const elevatorGlow = k.add([
    k.circle(TILE_SIZE),
    k.pos(elevatorX, elevatorY),
    k.anchor("center"),
    k.color(100, 255, 100),
    k.opacity(0),
    k.z(2)
  ]);

  // ============= WAVE PATTERN SYSTEM =============
  // Phase 1 (0-5s): Laser Lines - Horizontal/Vertical warning boxes
  // Phase 2 (5-10s): Debt Bubbles - Large slow orbs from corners
  // Phase 3 (10-15s): Targeted shots - Crosshair then projectile

  const hazards: GameObj<any>[] = [];

  // Helper: Check if spawn position is too close to player
  function isTooCloseToPlayer(x: number, y: number, minDist: number = 40): boolean {
    return player.pos.dist(k.vec2(x, y)) < minDist;
  }

  // ============= PHASE 1: LASER LINES =============
  function spawnLaserLine(): void {
    const isHorizontal = k.rand() > 0.5;
    let x: number, y: number, width: number, height: number;

    if (isHorizontal) {
      // Horizontal line spanning the map
      x = map.width / 2;
      y = k.rand(TILE_SIZE * 2, map.height - TILE_SIZE * 2);
      // Avoid spawning on player
      if (Math.abs(player.pos.y - y) < 30) {
        y = player.pos.y > map.height / 2 ? TILE_SIZE * 2 : map.height - TILE_SIZE * 2;
      }
      width = map.width - TILE_SIZE * 2;
      height = 20;
    } else {
      // Vertical line spanning the map
      x = k.rand(TILE_SIZE * 2, map.width - TILE_SIZE * 2);
      y = map.height / 2;
      // Avoid spawning on player
      if (Math.abs(player.pos.x - x) < 30) {
        x = player.pos.x > map.width / 2 ? TILE_SIZE * 2 : map.width - TILE_SIZE * 2;
      }
      width = 20;
      height = map.height - TILE_SIZE * 2;
    }

    // WARNING PHASE: Semi-transparent red box for 2 SECONDS
    const warning = k.add([
      k.rect(width, height),
      k.pos(x, y),
      k.anchor("center"),
      k.color(255, 50, 50),
      k.opacity(0.25),
      k.z(5),
      "warning",
      "hazard",
      "temporary_junk"
    ]);

    // Flash animation
    warning.onUpdate(() => {
      warning.opacity = 0.15 + Math.sin(k.time() * 12) * 0.15;
    });

    // After 1 second, activate the laser (damage zone for 0.5s)
    k.wait(1.0, () => {
      if (!warning.exists()) return;
      warning.destroy();

      // ACTIVE LASER - Bright red, deals damage
      const laser = k.add([
        k.rect(width, height * 0.6), // Thinner actual hitbox
        k.pos(x, y),
        k.anchor("center"),
        k.color(255, 100, 100),
        k.opacity(0.8),
        k.area({ scale: k.vec2(0.8, 0.5) }), // SMALL hitbox for fairness
        k.z(6),
        "laser",
        "hazard",
        "temporary_junk"
      ]);
      hazards.push(laser);

      // Destroy after 0.5s (quick burst)
      k.wait(0.5, () => {
        if (laser.exists()) laser.destroy();
      });
    });
  }

  // ============= PHASE 2: DEBT BUBBLES =============
  function spawnDebtBubble(): void {
    // Spawn from corners
    const corners = [
      { x: TILE_SIZE, y: TILE_SIZE },
      { x: map.width - TILE_SIZE, y: TILE_SIZE },
      { x: TILE_SIZE, y: map.height - TILE_SIZE },
      { x: map.width - TILE_SIZE, y: map.height - TILE_SIZE }
    ];
    
    // Pick a random corner that's not too close to player
    let corner = corners[Math.floor(k.rand(0, corners.length))];
    let attempts = 0;
    while (isTooCloseToPlayer(corner.x, corner.y, 60) && attempts < 4) {
      corner = corners[Math.floor(k.rand(0, corners.length))];
      attempts++;
    }

    // Direction towards center
    const centerX = map.width / 2;
    const centerY = map.height / 2;
    const dir = k.vec2(centerX - corner.x, centerY - corner.y).unit();

    const bubble = k.add([
      k.circle(18), // Large visual
      k.pos(corner.x, corner.y),
      k.anchor("center"),
      k.color(255, 80, 80),
      k.opacity(0.7),
      k.area({ shape: new k.Rect(k.vec2(0, 0), 20, 20), scale: k.vec2(0.5, 0.5) }), // Small hitbox
      k.z(6),
      "bubble",
      "hazard",
      "temporary_junk",
      {
        dir: dir,
        speed: 44 // 25% faster
      }
    ]);
    hazards.push(bubble);

    // Pulsing animation
    bubble.onUpdate(() => {
      bubble.opacity = 0.5 + Math.sin(k.time() * 4) * 0.2;
      bubble.pos = bubble.pos.add(bubble.dir.scale(bubble.speed * k.dt()));
      
      // Destroy if out of bounds
      if (bubble.pos.x < 0 || bubble.pos.x > map.width ||
          bubble.pos.y < 0 || bubble.pos.y > map.height) {
        bubble.destroy();
      }
    });
  }

  // ============= PHASE 3: TARGETED SHOTS =============
  function spawnCrosshair(): void {
    // Get player's CURRENT position for crosshair
    const targetX = player.pos.x;
    const targetY = player.pos.y;

    // Crosshair warning (2 seconds)
    const crosshair = k.add([
      k.text("X", { size: 20 }),
      k.pos(targetX, targetY),
      k.anchor("center"),
      k.color(255, 50, 50),
      k.opacity(0.6),
      k.z(7),
      "crosshair",
      "temporary_junk"
    ]);

    // Flash animation
    crosshair.onUpdate(() => {
      crosshair.opacity = 0.3 + Math.sin(k.time() * 15) * 0.4;
    });

    // After 1 second, fire projectile AT THAT POSITION (not tracking)
    k.wait(1.0, () => {
      if (!crosshair.exists()) return;
      const savedX = crosshair.pos.x;
      const savedY = crosshair.pos.y;
      crosshair.destroy();

      // Fire projectile from boss towards crosshair position
      const startPos = k.vec2(map.width / 2, 50);
      const dir = k.vec2(savedX - startPos.x, savedY - startPos.y).unit();

      const projectile = k.add([
        k.circle(8),
        k.pos(startPos.x, startPos.y),
        k.anchor("center"),
        k.color(255, 100, 50),
        k.opacity(0.9),
        k.area({ scale: k.vec2(0.4, 0.4) }), // TINY hitbox
        k.z(6),
        "projectile",
        "hazard",
        "temporary_junk",
        {
          dir: dir,
          speed: 100 // 25% faster
        }
      ]);
      hazards.push(projectile);

      projectile.onUpdate(() => {
        projectile.pos = projectile.pos.add(projectile.dir.scale(projectile.speed * k.dt()));
        
        // Destroy if out of bounds
        if (projectile.pos.x < 0 || projectile.pos.x > map.width ||
            projectile.pos.y < 0 || projectile.pos.y > map.height) {
          projectile.destroy();
        }
      });
    });
  }

  // ============= PHASE TIMERS (BUFFED DIFFICULTY) =============
  let phase1Timer = 0;
  let phase2Timer = 0;
  let phase3Timer = 0;
  let chaosLaserTimer = 0;
  let chaosBubbleTimer = 0;
  const PHASE1_SPAWN_INTERVAL = 0.5; // Spawn laser every 0.5s (was 2s)
  const PHASE2_SPAWN_INTERVAL = 0.5; // Spawn bubble every 0.5s (was 1.2s)
  const PHASE3_SPAWN_INTERVAL = 0.6; // Spawn crosshair every 0.6s (was 1.8s)
  const CHAOS_LASER_INTERVAL = 0.8; // Chaos mode laser interval
  const CHAOS_BUBBLE_INTERVAL = 0.6; // Chaos mode bubble interval

  // ============= OPEN ELEVATOR =============
  function openElevator(): void {
    elevatorOpen = true;
    
    // DESTROY ALL HAZARDS - Room must be SAFE
    k.destroyAll("hazard");
    k.destroyAll("laser");
    k.destroyAll("bubble");
    k.destroyAll("projectile");
    k.destroyAll("warning");
    k.destroyAll("crosshair");
    k.destroyAll("temporary_junk");
    hazards.length = 0;
    
    // Update elevator appearance
    elevator.color = k.rgb(100, 255, 100);
    elevator.outline.color = k.rgb(50, 255, 50);
    
    // Show glow
    k.tween(0, 0.6, 0.5, (val) => { elevatorGlow.opacity = val; });
    elevatorGlow.onUpdate(() => {
      elevatorGlow.opacity = 0.4 + Math.sin(k.time() * 4) * 0.2;
    });

    // Victory text
    k.add([
      k.text("SURVIVED! GO TO EXIT!", { size: 10 }),
      k.pos(map.width / 2, 25),
      k.anchor("center"),
      k.color(100, 255, 100),
      k.opacity(1),
      k.z(100)
    ]);

    // Enter prompt
    k.add([
      k.text("ENTER!", { size: 8 }),
      k.pos(elevatorX, elevatorY - 15),
      k.anchor("center"),
      k.color(100, 255, 100),
      k.z(100)
    ]);

    // Boss defeated message
    if (tuSe && tuSe.exists()) {
      tuSe.color = k.rgb(100, 180, 100);
      const defeatText = k.add([
        k.text("Fine... You win.", { size: 7 }),
        k.pos(tuSe.pos.x, tuSe.pos.y - 25),
        k.anchor("center"),
        k.color(200, 200, 100),
        k.opacity(1),
        k.z(100)
      ]);
      k.wait(2, () => {
        if (defeatText.exists()) defeatText.destroy();
      });
    }
  }

  // ============= MAIN UPDATE LOOP =============
  k.onUpdate(() => {
    if (gameState.isPaused() || gameState.isDialogueActive() || levelComplete) return;

    const dt = k.dt();
    timeElapsed += dt;
    maskManager.update(dt);
    maskManager.updatePlayerMask();

    // Update invincibility
    updateInvincibility(player, dt);

    // Update camera
    camera.follow(player, k.mousePos());

    // Update timer display
    if (!elevatorOpen && timerText.exists()) {
      const remaining = Math.max(0, SURVIVAL_TIME - timeElapsed);
      timerText.text = `${Math.ceil(remaining)}`;
      
      // Color changes as time runs out
      if (remaining <= 5) {
        timerText.color = k.rgb(100, 255, 100); // Green - almost done!
      } else if (remaining <= 10) {
        timerText.color = k.rgb(255, 255, 100); // Yellow
      }
    }

    // Check for victory
    if (timeElapsed >= SURVIVAL_TIME && !elevatorOpen) {
      openElevator();
      return;
    }

    // Skip spawning if elevator is open
    if (elevatorOpen) return;

    // ============= PHASE-BASED SPAWNING (BUFFED: Multiple projectiles) =============
    if (timeElapsed < 5) {
      // PHASE 1: Laser Lines (0-5s)
      if (phaseText.exists()) {
        phaseText.text = "PHASE 1: LASER STORM";
        phaseText.color = k.rgb(255, 150, 150);
      }
      
      phase1Timer += dt;
      if (phase1Timer >= PHASE1_SPAWN_INTERVAL) {
        phase1Timer = 0;
        // Spawn 2 lasers at once
        spawnLaserLine();
        spawnLaserLine();
      }
    } else if (timeElapsed < 10) {
      // PHASE 2: Debt Bubbles (5-10s)
      if (phaseText.exists()) {
        phaseText.text = "PHASE 2: BUBBLE HELL";
        phaseText.color = k.rgb(255, 200, 100);
      }
      
      phase2Timer += dt;
      if (phase2Timer >= PHASE2_SPAWN_INTERVAL) {
        phase2Timer = 0;
        // Spawn 2-3 bubbles at once
        spawnDebtBubble();
        spawnDebtBubble();
        if (k.rand() > 0.5) spawnDebtBubble();
      }
    } else {
      // PHASE 3: CHAOS MODE - ALL AT ONCE (10-15s)
      if (phaseText.exists()) {
        phaseText.text = "PHASE 3: TOTAL CHAOS!";
        phaseText.color = k.rgb(255, 50, 50);
      }
      
      // Crosshairs (main attack) - spawn 2
      phase3Timer += dt;
      if (phase3Timer >= PHASE3_SPAWN_INTERVAL) {
        phase3Timer = 0;
        spawnCrosshair();
        spawnCrosshair();
      }
      
      // Laser Lines (simultaneous chaos) - spawn 2
      chaosLaserTimer += dt;
      if (chaosLaserTimer >= CHAOS_LASER_INTERVAL) {
        chaosLaserTimer = 0;
        spawnLaserLine();
        spawnLaserLine();
      }
      
      // Debt Bubbles (simultaneous chaos) - spawn 3
      chaosBubbleTimer += dt;
      if (chaosBubbleTimer >= CHAOS_BUBBLE_INTERVAL) {
        chaosBubbleTimer = 0;
        spawnDebtBubble();
        spawnDebtBubble();
        spawnDebtBubble();
      }
    }

    // Update UI
    updateGameUI(k, ui, maskManager, player.pos, camera);
  });

  // ============= COLLISION HANDLERS =============
  
  // Laser collision
  player.onCollide("laser", () => {
    damagePlayer(player, 1);
  });

  // Bubble collision
  player.onCollide("bubble", (bubble: GameObj<any>) => {
    if (damagePlayer(player, 1)) return;
    bubble.destroy(); // Destroy bubble on hit
  });

  // Projectile collision
  player.onCollide("projectile", (proj: GameObj<any>) => {
    if (damagePlayer(player, 1)) return;
    proj.destroy(); // Destroy projectile on hit
  });

  // Elevator collision
  player.onCollide("elevator", () => {
    if (!elevatorOpen || levelComplete) return;
    
    levelComplete = true;
    gameState.addCollectedMask(MASKS.shield); // Floor 2: Shield Mask
    
    // Clear everything
    k.destroyAll("hazard");
    k.destroyAll("temporary_junk");
    
    // Player enters elevator
    player.pos = k.vec2(elevatorX, elevatorY);
    
    k.tween(1, 0, 0.5, (val) => {
      player.opacity = val;
    }, k.easings.easeInQuad).onEnd(() => {
      showDialogue(k, LEVEL_DIALOGUES[2].outro!, () => {
        k.go("level3");
      });
    });
  });

  // Show intro dialogue
  showDialogue(k, LEVEL_DIALOGUES[2].intro, () => {
    gameState.setDialogueActive(false);
    // Show mask description after dialogue
    showMaskDescription(k, 2);
  });
}

// ============= HELPER FUNCTIONS =============

function buildLevel(k: KaboomCtx, map: typeof LEVEL_2_MAP): void {
  for (let y = 0; y < map.tiles.length; y++) {
    for (let x = 0; x < map.tiles[y].length; x++) {
      const char = map.tiles[y][x];
      const posX = x * TILE_SIZE + TILE_SIZE / 2;
      const posY = y * TILE_SIZE + TILE_SIZE / 2;

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
}

function createPlayer(k: KaboomCtx, x: number, y: number, maskManager: MaskManager, mapWidth: number, mapHeight: number): GameObj<any> {
  const player = k.add([
    k.sprite("player"),
    k.pos(x, y),
    k.anchor("center"),
    k.area(),
    k.body(),
    k.health(3),
    k.color(79, 195, 247),
    k.opacity(1),
    k.z(10),
    "player",
    {
      speed: 100, // Slightly faster for dodging
      dir: k.vec2(0, 0)
    }
  ]);

  player.onUpdate(() => {
    if (gameState.isPaused() || gameState.isDialogueActive()) return;

    const dir = k.vec2(0, 0);
    if (k.isKeyDown("left") || k.isKeyDown("a")) dir.x -= 1;
    if (k.isKeyDown("right") || k.isKeyDown("d")) dir.x += 1;
    if (k.isKeyDown("up") || k.isKeyDown("w")) dir.y -= 1;
    if (k.isKeyDown("down") || k.isKeyDown("s")) dir.y += 1;

    if (dir.len() > 0) {
      player.dir = dir.unit();
      player.move(player.dir.scale(player.speed));
    }

    // Clamp to map
    const margin = TILE_SIZE;
    player.pos.x = k.clamp(player.pos.x, margin, mapWidth - margin);
    player.pos.y = k.clamp(player.pos.y, margin, mapHeight - margin);
  });

  k.onKeyPress("space", () => {
    if (gameState.isPaused() || gameState.isDialogueActive()) return;
    maskManager.activateAbility(player);
  });

  return player;
}

function createTuSe(k: KaboomCtx, x: number, y: number): GameObj<any> {
  return k.add([
    k.sprite("tuse"),
    k.pos(x, y),
    k.anchor("center"),
    k.z(5),
    k.opacity(1),
    "tuse"
  ]);
}
