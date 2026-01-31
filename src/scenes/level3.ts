// Level 3: TWAN Headquarters - Sao Đổi Ngôi falling & Quỷ Vương statues
import { KaboomCtx, GameObj } from "kaboom";
import { MaskManager } from "../mechanics/MaskManager.ts";
import { setupPauseSystem } from "../mechanics/PauseSystem.ts";
import { gameState } from "../state.ts";
import { LEVEL_DIALOGUES, MASKS } from "../constants.ts";
import { showDialogue } from "./dialogue.ts";
import { CameraController } from "../camera.ts";
import { createGameUI, updateGameUI, showMaskDescription } from "../ui.ts";
import { LEVEL_3_MAP, findInMap, getPlayerSpawn, getElevatorPosition } from "../maps.ts";
import { TILE_SIZE } from "../loader.ts";

export function level3Scene(k: KaboomCtx): void {
  const map = LEVEL_3_MAP;
  
  // Setup pause system (ESC to pause)
  setupPauseSystem(k);
  
  // Initialize camera with zoom
  const camera = new CameraController(k, {
    zoom: 3,
    lerpSpeed: 0.08,
    lookAheadDistance: 25
  });
  
  camera.setBounds(0, 0, map.width, map.height);

  // Initialize mask manager
  const maskManager = new MaskManager(k);
  
  // Prepare player state
  gameState.prepareForLevel(3);

  // Build the level from ASCII map
  buildLevel(k, map);

  // Get spawn positions from map
  const playerSpawn = getPlayerSpawn(map);
  const elevatorPos = getElevatorPosition(map);

  // ============= SLIPPING MECHANIC =============
  // Track player's previous direction for slip detection
  let prevDir = k.vec2(0, 0);
  let isSlipping = false;
  let slipTimer = 0;
  const SLIP_DURATION = 0.3;
  let slipVelocity = k.vec2(0, 0);

  // Create player with ice physics
  const player = createPlayer(k, playerSpawn.x, playerSpawn.y, maskManager, () => prevDir, (v) => { prevDir = v; }, () => isSlipping);
  maskManager.initPlayerMask(player);

  // Snap camera to player initially
  camera.snapTo(k.vec2(playerSpawn.x, playerSpawn.y));

  // Create elevator (goal)
  k.add([
    k.sprite("elevator"),
    k.pos(elevatorPos.x, elevatorPos.y),
    k.anchor("center"),
    k.area(),
    k.z(5),
    "elevator"
  ]);

  // Create Zed Shadows from map (enemies)
  const enemies = createZedShadowsFromMap(k, map);

  // ============= STARFALL MECHANIC (SCREEN-RELATIVE) =============
  // Stars spawn relative to camera view, not map position
  // Includes warning indicators before stars fall
  
  interface StarWarning {
    indicator: GameObj<any>;
    timer: number;
    screenX: number;   // X position on screen (0 to width)
    fallen: boolean;
    isHoming: boolean;
  }
  const starWarnings: StarWarning[] = [];
  
  // Spawn timers
  let starTimer = 0;
  const STAR_SPAWN_INTERVAL = 0.4;  // Spawn rate
  const WARNING_DURATION = 0.5;      // 0.5s warning before star falls
  const MAX_WARNINGS = 12;           // Max concurrent warnings
  
  let playerStunned = false;
  let stunTimer = 0;
  const STUN_DURATION = 1.0;

  // Meme text reminder
  k.add([
    k.text("Coi chừng bị 1 hit!", { size: 6 }),
    k.pos(map.width / 2, 12),
    k.anchor("center"),
    k.color(255, 215, 0),
    k.z(100)
  ]);

  // ============= SPAWN STAR WARNING (Screen-Relative) =============
  function spawnStarWarning(): void {
    if (starWarnings.filter(w => !w.fallen).length >= MAX_WARNINGS) return;

    // Get camera position for screen-relative spawning
    const camPos = k.camPos();
    const screenHalfW = k.width() / 2 / camera.getZoom();
    const screenHalfH = k.height() / 2 / camera.getZoom();
    
    // Aim towards player's current X position with some randomness
    const playerScreenX = player.pos.x;
    const targetX = playerScreenX + k.rand(-40, 40);
    
    // Clamp to visible screen area
    const worldX = k.clamp(targetX, camPos.x - screenHalfW + 20, camPos.x + screenHalfW - 20);
    const worldY = camPos.y - screenHalfH + 10; // Top of visible screen
    
    const isHoming = k.rand() < 0.3; // 30% chance for red homing star
    
    // Create warning indicator (Red "!" or shadow)
    const indicator = k.add([
      k.text("!", { size: 16 }),
      k.pos(worldX, worldY + 20),
      k.anchor("center"),
      k.color(isHoming ? 255 : 255, isHoming ? 50 : 200, isHoming ? 50 : 0),
      k.opacity(0.8),
      k.z(51),
      "star-warning"
    ]);

    starWarnings.push({
      indicator,
      timer: 0,
      screenX: worldX,
      fallen: false,
      isHoming
    });
  }

  // ============= DROP STAR AFTER WARNING =============
  function dropStar(warning: StarWarning): void {
    warning.fallen = true;
    if (warning.indicator.exists()) warning.indicator.destroy();

    // Get current camera position for spawn
    const camPos = k.camPos();
    const screenHalfH = k.height() / 2 / camera.getZoom();
    
    const spawnX = warning.screenX;
    const spawnY = camPos.y - screenHalfH - 10; // Just above visible screen
    const killY = camPos.y + screenHalfH + 20; // Just below visible screen
    
    const starColor = warning.isHoming ? k.rgb(255, 50, 50) : k.rgb(255, 215, 0);
    const outlineColor = warning.isHoming ? k.rgb(200, 0, 0) : k.rgb(255, 180, 0);
    
    // Create star
    const star = k.add([
      k.polygon([
        k.vec2(0, -8),
        k.vec2(2, -3),
        k.vec2(8, -3),
        k.vec2(3, 1),
        k.vec2(5, 8),
        k.vec2(0, 4),
        k.vec2(-5, 8),
        k.vec2(-3, 1),
        k.vec2(-8, -3),
        k.vec2(-2, -3)
      ]),
      k.pos(spawnX, spawnY),
      k.anchor("center"),
      k.color(starColor),
      k.outline(1, outlineColor),
      k.area({ shape: new k.Rect(k.vec2(0), 14, 14), scale: k.vec2(0.5, 0.5) }),
      k.z(50),
      "falling-star",
      {
        isHoming: warning.isHoming,
        speed: warning.isHoming ? 250 : 200,
        killY: killY
      }
    ]);

    // Star movement
    star.onUpdate(() => {
      star.pos.y += star.speed * k.dt();
      
      // Destroy when past bottom of screen
      if (star.pos.y >= star.killY) {
        // Impact particles
        for (let i = 0; i < 4; i++) {
          const particle = k.add([
            k.circle(3),
            k.pos(star.pos.x, star.pos.y),
            k.anchor("center"),
            k.color(star.isHoming ? 255 : 255, star.isHoming ? 50 : 215, star.isHoming ? 50 : 0),
            k.opacity(1),
            k.z(49),
            { vel: k.vec2(k.rand(-60, 60), k.rand(-80, -30)), life: 0.4 }
          ]);
          particle.onUpdate(() => {
            particle.pos = particle.pos.add(particle.vel.scale(k.dt()));
            particle.vel.y += 200 * k.dt();
            particle.opacity -= k.dt() * 2.5;
            particle.life -= k.dt();
            if (particle.life <= 0) particle.destroy();
          });
        }
        star.destroy();
        return;
      }
      
      // Check collision with player
      const dist = player.pos.dist(star.pos);
      if (dist < 14 && !gameState.isPlayerEthereal() && !gameState.isInvincible()) {
        playerStunned = true;
        stunTimer = 0;
        player.color = k.rgb(255, 215, 0);
        camera.shake(8, 0.2);
        star.destroy();
      }
    });
  }

  // Create UI
  const ui = createGameUI(k);

  // Player start position for reset
  const startPos = k.vec2(playerSpawn.x, playerSpawn.y);

  // Frozen particles for atmosphere
  spawnFrozenParticles(k, map);

  // Slip visual indicator
  const slipIndicator = k.add([
    k.text("!", { size: 10 }),
    k.pos(0, 0),
    k.anchor("center"),
    k.color(255, 200, 100),
    k.opacity(0),
    k.z(50)
  ]);

  k.onUpdate(() => {
    if (gameState.isPaused() || gameState.isDialogueActive()) return;

    const dt = k.dt();
    maskManager.update(dt);
    maskManager.updatePlayerMask();

    // Update camera to follow player
    camera.follow(player, k.mousePos());

    // ===== STUN MECHANIC =====
    if (playerStunned) {
      stunTimer += dt;
      // Wobble effect while stunned
      player.angle = Math.sin(k.time() * 20) * 5;
      
      if (stunTimer >= STUN_DURATION) {
        playerStunned = false;
        player.angle = 0;
        player.color = k.rgb(79, 195, 247);
      }
    }

    // ===== SLIPPING MECHANIC =====
    if (isSlipping) {
      slipTimer += dt;
      // Continue sliding
      player.move(slipVelocity.scale(1 - slipTimer / SLIP_DURATION));
      
      // Show slip indicator
      slipIndicator.pos = player.pos.add(k.vec2(0, -20));
      slipIndicator.opacity = 1 - slipTimer / SLIP_DURATION;
      
      if (slipTimer >= SLIP_DURATION) {
        isSlipping = false;
        slipIndicator.opacity = 0;
      }
    }

    // ===== SCREEN-RELATIVE STARFALL SYSTEM =====
    starTimer += dt;
    if (starTimer >= STAR_SPAWN_INTERVAL) {
      starTimer = 0;
      spawnStarWarning();
    }

    // Update star warnings (flash before dropping)
    starWarnings.forEach(warning => {
      if (warning.fallen) return;
      
      warning.timer += dt;
      
      // Flash warning indicator
      const progress = warning.timer / WARNING_DURATION;
      warning.indicator.opacity = 0.5 + Math.sin(k.time() * 20) * 0.3;
      
      // Scale up as approaching drop
      const scale = 1 + progress * 0.5;
      warning.indicator.scale = k.vec2(scale);
      
      // Drop star when warning timer expires
      if (warning.timer >= WARNING_DURATION) {
        dropStar(warning);
      }
    });

    // Clean up fallen warnings
    for (let i = starWarnings.length - 1; i >= 0; i--) {
      if (starWarnings[i].fallen) {
        starWarnings.splice(i, 1);
      }
    }

    // Update Zed Shadows
    enemies.forEach(enemy => {
      if (enemy.exists() && !gameState.isTimeFrozen()) {
        updateZedShadow(k, enemy, map);
        enemy.color = k.rgb(60, 60, 80);
      } else if (gameState.isTimeFrozen()) {
        enemy.color = k.rgb(100, 100, 120);
      }
    });

    // Update UI with objective pointer
    updateGameUI(k, ui, maskManager, k.vec2(elevatorPos.x, elevatorPos.y), camera);
  });

  // Detect abrupt direction changes for slipping
  player.onUpdate(() => {
    if (playerStunned || isSlipping) return;

    const dir = k.vec2(0, 0);
    if (k.isKeyDown("left") || k.isKeyDown("a")) dir.x -= 1;
    if (k.isKeyDown("right") || k.isKeyDown("d")) dir.x += 1;
    if (k.isKeyDown("up") || k.isKeyDown("w")) dir.y -= 1;
    if (k.isKeyDown("down") || k.isKeyDown("s")) dir.y += 1;

    if (dir.len() > 0 && prevDir.len() > 0) {
      const currentDir = dir.unit();
      const dot = currentDir.dot(prevDir);
      
      // If direction changed significantly (dot product < 0 = more than 90 degrees)
      if (dot < -0.5) {
        // Trigger slip!
        isSlipping = true;
        slipTimer = 0;
        slipVelocity = prevDir.scale(player.speed * 0.8);
        
        // Brief visual feedback
        player.color = k.rgb(150, 200, 255);
        k.wait(0.1, () => {
          if (!playerStunned) player.color = k.rgb(79, 195, 247);
        });
      }
    }

    if (dir.len() > 0) {
      prevDir = dir.unit();
    }
  });

  // Zed Shadow collision - reset position
  player.onCollide("zed-shadow", () => {
    if (gameState.isPlayerEthereal()) return;
    if (gameState.isInvincible()) return;

    player.color = k.rgb(255, 100, 100);
    camera.shake(10, 0.3);

    gameState.damagePlayer(1);

    if (gameState.isPlayerDead()) {
      k.go("gameover");
      return;
    }

    // Reset to start
    player.pos = startPos.clone();
    camera.snapTo(player.pos);
    playerStunned = false;
    isSlipping = false;

    // Brief invincibility
    gameState.setInvincible(true);
    k.wait(1, () => {
      gameState.setInvincible(false);
      player.color = k.rgb(79, 195, 247);
    });
  });

  // Elevator collision - level complete
  player.onCollide("elevator", () => {
    // Mask already acquired at floor entry
    
    showDialogue(k, LEVEL_DIALOGUES[3].outro!, () => {
      k.go("level4");
    });
  });

  // Show intro dialogue - Grant mask at floor ENTRY
  showDialogue(k, LEVEL_DIALOGUES[3].intro, () => {
    // Grant Ghost Mask on entry to Floor 3
    gameState.addCollectedMask(MASKS.ghost);
    gameState.setCurrentMask(MASKS.ghost);
    showAcquiredNotification(k, "GHOST MASK");
    
    gameState.setDialogueActive(false);
    // Show mask description after dialogue
    showMaskDescription(k, 3);
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

// Build level tiles from ASCII map
function buildLevel(k: KaboomCtx, map: typeof LEVEL_3_MAP): void {
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
  
  // Add map boundaries
  const mapWidth = map.tiles[0].length * TILE_SIZE;
  const mapHeight = map.tiles.length * TILE_SIZE;
  const boundaryThickness = 16;
  
  // Boundaries (top, bottom, left, right)
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

// Create player entity with ice physics
function createPlayer(
  k: KaboomCtx, 
  x: number, 
  y: number, 
  maskManager: MaskManager,
  _getPrevDir: () => any,
  _setPrevDir: (v: any) => void,
  getIsSlipping: () => boolean
): GameObj<any> {
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
    k.rotate(0),
    k.z(10),
    "player",
    {
      speed: 85,
      dir: k.vec2(0, 0)
    }
  ]);

  try { player.play("idle-down"); } catch {}

  // Mask overlay (Paper Doll system - Face-Only Attachment)
  const maskOverlay = k.add([
    k.sprite("mask-ghost"),
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
    if (getIsSlipping()) return; // Can't control while slipping

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
      try { maskOverlay.use(k.sprite(maskSprites[currentMask.id] || "mask-ghost")); maskOverlay.scale = k.vec2(0.35, 0.35); } catch {}
    } else {
      maskOverlay.opacity = 0;
    }
  });

  k.onKeyPress("space", () => {
    if (gameState.isPaused() || gameState.isDialogueActive()) return;
    maskManager.activateAbility(player);
  });

  return player;
}

// Create Quỷ Vương statues from map positions (TWAN meme enemies)
function createZedShadowsFromMap(k: KaboomCtx, map: typeof LEVEL_3_MAP): GameObj<any>[] {
  const positions = findInMap(map, 'F');
  const enemies: GameObj<any>[] = [];

  positions.forEach(() => {
    const x = k.rand(TILE_SIZE * 2, map.width - TILE_SIZE * 2);
    const y = k.rand(TILE_SIZE * 2, map.height - TILE_SIZE * 2);
    
    const shadow = k.add([
      k.sprite("frozen-fan"), // Reuse sprite, tint dark
      k.pos(x, y),
      k.anchor("center"),
      k.area(),
      k.color(60, 60, 80), // Dark shadow color
      k.z(5),
      "zed-shadow",
      "enemy",
      {
        speed: k.rand(180, 280),
        dir: k.vec2(k.rand(-1, 1), k.rand(-1, 1)).unit()
      }
    ]);
    enemies.push(shadow);
  });

  // Add extra Zed Shadows
  for (let i = 0; i < 5; i++) {
    const x = k.rand(TILE_SIZE * 2, map.width - TILE_SIZE * 2);
    const y = k.rand(TILE_SIZE * 2, map.height - TILE_SIZE * 2);
    
    const shadow = k.add([
      k.sprite("frozen-fan"),
      k.pos(x, y),
      k.anchor("center"),
      k.area(),
      k.color(60, 60, 80),
      k.z(5),
      "zed-shadow",
      "enemy",
      {
        speed: k.rand(200, 320),
        dir: k.vec2(k.rand(-1, 1), k.rand(-1, 1)).unit()
      }
    ]);
    enemies.push(shadow);
  }

  return enemies;
}

// Update Zed Shadow movement - fast erratic dashing
function updateZedShadow(k: KaboomCtx, shadow: GameObj<any>, map: typeof LEVEL_3_MAP): void {
  shadow.move(shadow.dir.scale(shadow.speed * k.dt()));

  if (shadow.pos.x < TILE_SIZE || shadow.pos.x > map.width - TILE_SIZE) {
    shadow.dir.x *= -1;
    shadow.pos.x = k.clamp(shadow.pos.x, TILE_SIZE, map.width - TILE_SIZE);
  }
  if (shadow.pos.y < TILE_SIZE || shadow.pos.y > map.height - TILE_SIZE) {
    shadow.dir.y *= -1;
    shadow.pos.y = k.clamp(shadow.pos.y, TILE_SIZE, map.height - TILE_SIZE);
  }

  // More erratic movement than frozen fans
  if (k.rand() < 0.02) {
    shadow.dir = k.vec2(k.rand(-1, 1), k.rand(-1, 1)).unit();
  }
}

// Spawn starry particles for atmosphere (dark background with golden sparkles)
function spawnFrozenParticles(k: KaboomCtx, map: typeof LEVEL_3_MAP): void {
  // Darken background
  k.add([
    k.rect(map.width, map.height),
    k.pos(0, 0),
    k.color(20, 20, 40),
    k.opacity(0.3),
    k.z(-1)
  ]);

  // Golden star particles
  for (let i = 0; i < 25; i++) {
    k.add([
      k.circle(k.rand(1, 3)),
      k.pos(k.rand(0, map.width), k.rand(0, map.height)),
      k.color(255, 215, 0), // Gold
      k.opacity(k.rand(0.2, 0.6)),
      k.z(1),
      {
        speed: k.rand(15, 35),
        offset: k.rand(0, Math.PI * 2),
        mapHeight: map.height,
        mapWidth: map.width,
        twinkle: k.rand(0, Math.PI * 2)
      }
    ]).onUpdate(function(this: GameObj<any>) {
      this.pos.y += this.speed * k.dt();
      this.pos.x += Math.sin(k.time() * 2 + this.offset) * 0.5;
      // Twinkle effect
      this.opacity = 0.3 + Math.sin(k.time() * 3 + this.twinkle) * 0.3;
      if (this.pos.y > this.mapHeight) {
        this.pos.y = -5;
        this.pos.x = k.rand(0, this.mapWidth);
      }
    });
  }
}
