// Level 3: TWAN Headquarters - Sao Đổi Ngôi falling & Quỷ Vương statues
import { KaboomCtx, GameObj } from "kaboom";
import { MaskManager } from "../mechanics/MaskManager.ts";
import { setupPauseSystem } from "../mechanics/PauseSystem.ts";
import { gameState } from "../state.ts";
import { LEVEL_DIALOGUES, MASKS } from "../constants.ts";
import { showDialogue } from "./dialogue.ts";
import { CameraController } from "../camera.ts";
import { createGameUI, updateGameUI } from "../ui.ts";
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

  // ============= STARFALL MECHANIC (REWORKED) =============
  // Two types: Random falling stars + Homing red stars
  
  interface StarWarning {
    shadow: GameObj<any>;
    timer: number;
    targetX: number;  // Player X at spawn time (for homing)
    targetY: number;  // Player Y at spawn time (for homing)
    spawnX: number;   // Where star spawns (top of map)
    spawnY: number;
    fallen: boolean;
    isHoming: boolean; // Red homing star vs yellow falling star
  }
  const starWarnings: StarWarning[] = [];
  
  // Spawn timers
  let randomStarTimer = 0;
  let homingStarTimer = 0;
  const RANDOM_STAR_INTERVAL = 0.5;  // Every 0.5s - rapid random stars
  const HOMING_STAR_INTERVAL = 1.5;  // Every 1.5s - red homing stars
  const STAR_FALL_DELAY = 0.3;       // Very short warning
  const MAX_STARS = 20;              // High density
  
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

  // ============= SPAWN RANDOM FALLING STAR (Yellow - Falls straight down) =============
  function spawnRandomStar(): void {
    if (starWarnings.filter(w => !w.fallen).length >= MAX_STARS) return;

    const spawnX = k.rand(TILE_SIZE * 2, map.width - TILE_SIZE * 2);
    const spawnY = -10; // Above screen

    // No warning shadow for random stars - they just fall!
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
      k.color(255, 215, 0), // Yellow
      k.outline(1, k.rgb(255, 180, 0)),
      k.area({ shape: new k.Rect(k.vec2(0), 14, 14), scale: k.vec2(0.5, 0.5) }),
      k.z(50),
      "falling-star",
      {
        isHoming: false,
        speed: 200, // Fall speed (gravity-like)
        lifetime: 5
      }
    ]);

    // Straight down movement
    star.onUpdate(() => {
      star.pos.y += star.speed * k.dt();
      star.lifetime -= k.dt();
      
      // Create impact particles when hitting ground
      if (star.pos.y >= map.height - TILE_SIZE) {
        // Impact particles
        for (let i = 0; i < 5; i++) {
          const particle = k.add([
            k.circle(3),
            k.pos(star.pos.x, map.height - TILE_SIZE),
            k.anchor("center"),
            k.color(255, 215, 0),
            k.opacity(1),
            k.z(49),
            { vel: k.vec2(k.rand(-80, 80), k.rand(-100, -40)), life: 0.5 }
          ]);
          particle.onUpdate(() => {
            particle.pos = particle.pos.add(particle.vel.scale(k.dt()));
            particle.vel.y += 300 * k.dt();
            particle.opacity -= k.dt() * 2;
            particle.life -= k.dt();
            if (particle.life <= 0) particle.destroy();
          });
        }
        star.destroy();
        return;
      }
      
      if (star.lifetime <= 0) {
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

  // ============= SPAWN HOMING RED STAR (Targets player position at spawn) =============
  function spawnHomingStar(): void {
    if (starWarnings.filter(w => !w.fallen).length >= MAX_STARS) return;

    const spawnX = k.rand(TILE_SIZE * 2, map.width - TILE_SIZE * 2);
    const spawnY = TILE_SIZE;
    
    // Capture player position at spawn time
    const playerTargetX = player.pos.x;
    const playerTargetY = player.pos.y;

    // Brief warning indicator
    const shadow = k.add([
      k.circle(10),
      k.pos(spawnX, spawnY),
      k.anchor("center"),
      k.color(255, 50, 50), // Red warning
      k.opacity(0.6),
      k.z(50),
      "star-shadow"
    ]);

    starWarnings.push({
      shadow,
      timer: 0,
      targetX: playerTargetX,
      targetY: playerTargetY,
      spawnX: spawnX,
      spawnY: spawnY,
      fallen: false,
      isHoming: true
    });
  }

  // Function to drop homing star
  function dropHomingStar(warning: StarWarning): void {
    warning.fallen = true;
    warning.shadow.destroy();

    // Calculate direction from spawn towards player position
    const dir = k.vec2(warning.targetX - warning.spawnX, warning.targetY - warning.spawnY).unit();
    const angle = Math.atan2(dir.y, dir.x) * (180 / Math.PI) + 90;

    // Create RED homing star
    const star = k.add([
      k.polygon([
        k.vec2(0, -12),
        k.vec2(3, -4),
        k.vec2(12, -4),
        k.vec2(5, 2),
        k.vec2(7, 12),
        k.vec2(0, 6),
        k.vec2(-7, 12),
        k.vec2(-5, 2),
        k.vec2(-12, -4),
        k.vec2(-3, -4)
      ]),
      k.pos(warning.spawnX, warning.spawnY),
      k.anchor("center"),
      k.rotate(angle),
      k.color(255, 50, 50), // RED
      k.outline(2, k.rgb(200, 0, 0)),
      k.area({ shape: new k.Rect(k.vec2(0), 20, 20), scale: k.vec2(0.5, 0.5) }),
      k.z(50),
      "falling-star",
      "red-star",
      {
        dir: dir,
        speed: 220, // Fast homing
        lifetime: 4
      }
    ]);

    // Linear movement towards captured target
    star.onUpdate(() => {
      star.pos = star.pos.add(star.dir.scale(star.speed * k.dt()));
      star.lifetime -= k.dt();
      
      // Impact particles when off-screen or expired
      if (star.pos.x < -TILE_SIZE || star.pos.x > map.width + TILE_SIZE ||
          star.pos.y < -TILE_SIZE || star.pos.y > map.height + TILE_SIZE ||
          star.lifetime <= 0) {
        // Impact particles
        for (let i = 0; i < 6; i++) {
          const particle = k.add([
            k.circle(4),
            k.pos(star.pos),
            k.anchor("center"),
            k.color(255, 100, 100),
            k.opacity(1),
            k.z(49),
            { vel: k.vec2(k.rand(-100, 100), k.rand(-100, 100)), life: 0.4 }
          ]);
          particle.onUpdate(() => {
            particle.pos = particle.pos.add(particle.vel.scale(k.dt()));
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
      if (dist < 18 && !gameState.isPlayerEthereal() && !gameState.isInvincible()) {
        playerStunned = true;
        stunTimer = 0;
        player.color = k.rgb(255, 50, 50);
        camera.shake(12, 0.3);
        
        const stunIndicator = k.add([
          k.text("1 HIT!", { size: 10 }),
          k.pos(player.pos.x, player.pos.y - 20),
          k.anchor("center"),
          k.color(255, 50, 50),
          k.z(100)
        ]);
        k.wait(STUN_DURATION, () => {
          if (stunIndicator.exists()) stunIndicator.destroy();
        });
        
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

    // ===== DUAL STAR SPAWNING SYSTEM =====
    // Random falling stars (yellow) - every 0.5s
    randomStarTimer += dt;
    if (randomStarTimer >= RANDOM_STAR_INTERVAL) {
      randomStarTimer = 0;
      spawnRandomStar();
    }
    
    // Homing red stars - every 1.5s
    homingStarTimer += dt;
    if (homingStarTimer >= HOMING_STAR_INTERVAL) {
      homingStarTimer = 0;
      spawnHomingStar();
    }

    // Update homing star warnings (red stars only)
    starWarnings.forEach(warning => {
      if (warning.fallen) return;
      
      warning.timer += dt;
      
      // Grow shadow as time approaches
      const progress = warning.timer / STAR_FALL_DELAY;
      const radius = 10 + progress * 12;
      warning.shadow.radius = radius;
      warning.shadow.opacity = 0.4 + progress * 0.4;
      
      // Flash red when about to fire
      if (progress > 0.5) {
        warning.shadow.color = k.rgb(
          255,
          50 + Math.sin(k.time() * 30) * 50,
          50
        );
      }

      // Fire homing star
      if (warning.timer >= STAR_FALL_DELAY) {
        dropHomingStar(warning);
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
    gameState.addCollectedMask(MASKS.frozen);
    
    showDialogue(k, LEVEL_DIALOGUES[3].outro!, () => {
      k.go("level4");
    });
  });

  // Show intro dialogue
  showDialogue(k, LEVEL_DIALOGUES[3].intro, () => {
    gameState.setDialogueActive(false);
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
  const player = k.add([
    k.sprite("player"),
    k.pos(x, y),
    k.anchor("center"),
    k.area(),
    k.body(),
    k.color(79, 195, 247),
    k.opacity(1),
    k.rotate(0),
    k.z(10),
    "player",
    {
      speed: 85,
      dir: k.vec2(0, 0)
    }
  ]);

  player.onUpdate(() => {
    if (gameState.isPaused() || gameState.isDialogueActive()) return;
    if (getIsSlipping()) return; // Can't control while slipping

    const dir = k.vec2(0, 0);
    if (k.isKeyDown("left") || k.isKeyDown("a")) dir.x -= 1;
    if (k.isKeyDown("right") || k.isKeyDown("d")) dir.x += 1;
    if (k.isKeyDown("up") || k.isKeyDown("w")) dir.y -= 1;
    if (k.isKeyDown("down") || k.isKeyDown("s")) dir.y += 1;

    if (dir.len() > 0) {
      player.dir = dir.unit();
      player.move(player.dir.scale(player.speed));
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
