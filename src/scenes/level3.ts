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

  // ============= SẢO ĐỔI NGÔI MECHANIC (TWAN Meme) =============
  interface StarWarning {
    shadow: GameObj<any>;
    timer: number;
    targetX: number;
    targetY: number;
    fallen: boolean;
  }
  const starWarnings: StarWarning[] = [];
  let starSpawnTimer = 0;
  const STAR_SPAWN_INTERVAL = 1.2; // Faster than icicles
  const STAR_FALL_DELAY = 1.5;
  const MAX_STARS = 8;
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

  // Function to spawn star warning shadow
  function spawnStarWarning(): void {
    if (starWarnings.filter(w => !w.fallen).length >= MAX_STARS) return;

    // Target area near player
    const offsetX = k.rand(-80, 80);
    const offsetY = k.rand(-80, 80);
    let targetX = k.clamp(player.pos.x + offsetX, TILE_SIZE * 2, map.width - TILE_SIZE * 2);
    let targetY = k.clamp(player.pos.y + offsetY, TILE_SIZE * 2, map.height - TILE_SIZE * 2);

    // Occasionally target player directly
    if (k.rand() < 0.25) {
      targetX = player.pos.x;
      targetY = player.pos.y;
    }

    // Create golden star shadow
    const shadow = k.add([
      k.circle(8),
      k.pos(targetX, targetY),
      k.anchor("center"),
      k.color(255, 215, 0), // Gold
      k.opacity(0.2),
      k.z(1),
      "star-shadow"
    ]);

    starWarnings.push({
      shadow,
      timer: 0,
      targetX,
      targetY,
      fallen: false
    });
  }

  // Function to drop star
  function dropStar(warning: StarWarning): void {
    warning.fallen = true;
    warning.shadow.destroy();

    // Create falling star (golden)
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
      k.pos(warning.targetX, warning.targetY - 150),
      k.anchor("center"),
      k.color(255, 215, 0),
      k.outline(2, k.rgb(255, 180, 0)),
      k.z(50),
      "falling-star"
    ]);

    // Fall animation
    k.tween(warning.targetY - 150, warning.targetY, 0.25, (y) => {
      star.pos.y = y;
    }, k.easings.easeInQuad).onEnd(() => {
      // Impact
      camera.shake(5, 0.15);

      // Check if player is hit
      const dist = player.pos.dist(k.vec2(warning.targetX, warning.targetY));
      if (dist < 25 && !gameState.isPlayerEthereal() && !gameState.isInvincible()) {
        // Stun player! (turns yellow)
        playerStunned = true;
        stunTimer = 0;
        player.color = k.rgb(255, 215, 0); // Turn yellow when stunned
        camera.shake(10, 0.3);
        
        // Show stun effect
        const stunIndicator = k.add([
          k.text("1 HIT!", { size: 10 }),
          k.pos(player.pos.x, player.pos.y - 20),
          k.anchor("center"),
          k.color(255, 215, 0),
          k.z(100)
        ]);
        k.wait(STUN_DURATION, () => {
          if (stunIndicator.exists()) stunIndicator.destroy();
        });
      }

      // Create golden sparkle particles
      for (let i = 0; i < 8; i++) {
        const particle = k.add([
          k.circle(3),
          k.pos(warning.targetX, warning.targetY),
          k.anchor("center"),
          k.color(255, 215, 0),
          k.opacity(1),
          k.z(49),
          {
            vel: k.vec2(k.rand(-100, 100), k.rand(-120, -30)),
            life: 0.6
          }
        ]);
        particle.onUpdate(() => {
          particle.pos = particle.pos.add(particle.vel.scale(k.dt()));
          particle.vel.y += 250 * k.dt(); // gravity
          particle.opacity -= k.dt() * 1.5;
          particle.life -= k.dt();
          if (particle.life <= 0) particle.destroy();
        });
      }

      // Remove star after brief display
      k.wait(0.2, () => {
        if (star.exists()) star.destroy();
      });
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

    // ===== FALLING STARS SPAWNING =====
    starSpawnTimer += dt;
    if (starSpawnTimer >= STAR_SPAWN_INTERVAL) {
      starSpawnTimer = 0;
      spawnStarWarning();
    }

    // Update star warnings
    starWarnings.forEach(warning => {
      if (warning.fallen) return;
      
      warning.timer += dt;
      
      // Grow shadow as time approaches
      const progress = warning.timer / STAR_FALL_DELAY;
      const radius = 8 + progress * 15;
      warning.shadow.radius = radius;
      warning.shadow.opacity = 0.2 + progress * 0.5;
      
      // Flash brighter when about to fall
      if (progress > 0.7) {
        warning.shadow.color = k.rgb(
          255,
          215 + Math.sin(k.time() * 25) * 40,
          Math.sin(k.time() * 25) * 100
        );
      }

      // Drop star
      if (warning.timer >= STAR_FALL_DELAY) {
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
