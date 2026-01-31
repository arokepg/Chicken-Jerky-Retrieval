// Level 2: The Debt Office - Survival Level with Interest Rate Mechanic
import { KaboomCtx, GameObj } from "kaboom";
import { MaskManager } from "../mechanics/MaskManager.ts";
import { setupPauseSystem } from "../mechanics/PauseSystem.ts";
import { gameState } from "../state.ts";
import { LEVEL_DIALOGUES, MASKS } from "../constants.ts";
import { showDialogue } from "./dialogue.ts";
import { CameraController } from "../camera.ts";
import { createGameUI, updateGameUI } from "../ui.ts";
import { LEVEL_2_MAP, getPlayerSpawn } from "../maps.ts";
import { TILE_SIZE } from "../loader.ts";

export function level2Scene(k: KaboomCtx): void {
  const map = LEVEL_2_MAP;
  
  // Setup pause system (ESC to pause)
  setupPauseSystem(k);
  
  // Initialize camera with zoom
  const camera = new CameraController(k, {
    zoom: 3,
    lerpSpeed: 0.1,
    lookAheadDistance: 15
  });
  
  camera.setBounds(0, 0, map.width, map.height);

  // Initialize mask manager
  const maskManager = new MaskManager(k);
  
  // Prepare player state for level 2 (survival mode)
  gameState.prepareForLevel(2);

  // Build the level from ASCII map
  buildLevel(k, map);

  // ============= INVISIBLE BOUNDARY WALLS =============
  // Ensure player cannot escape the map edges
  const WALL_THICKNESS = TILE_SIZE;
  
  // Top wall
  k.add([
    k.rect(map.width + WALL_THICKNESS * 2, WALL_THICKNESS),
    k.pos(-WALL_THICKNESS, -WALL_THICKNESS),
    k.area(),
    k.body({ isStatic: true }),
    k.opacity(0),
    "boundary"
  ]);
  
  // Bottom wall
  k.add([
    k.rect(map.width + WALL_THICKNESS * 2, WALL_THICKNESS),
    k.pos(-WALL_THICKNESS, map.height),
    k.area(),
    k.body({ isStatic: true }),
    k.opacity(0),
    "boundary"
  ]);
  
  // Left wall
  k.add([
    k.rect(WALL_THICKNESS, map.height + WALL_THICKNESS * 2),
    k.pos(-WALL_THICKNESS, -WALL_THICKNESS),
    k.area(),
    k.body({ isStatic: true }),
    k.opacity(0),
    "boundary"
  ]);
  
  // Right wall
  k.add([
    k.rect(WALL_THICKNESS, map.height + WALL_THICKNESS * 2),
    k.pos(map.width, -WALL_THICKNESS),
    k.area(),
    k.body({ isStatic: true }),
    k.opacity(0),
    "boundary"
  ]);

  // Get spawn position from map
  const playerSpawn = getPlayerSpawn(map);

  // Create player at center
  const player = createPlayer(k, playerSpawn.x, playerSpawn.y, maskManager, map.width, map.height);

  // Snap camera to player initially
  camera.snapTo(k.vec2(playerSpawn.x, playerSpawn.y));

  // Create Debt Manager (the shouting NPC)
  const tuSe = createTuSe(k, map.width / 2, 40);
  let shoutTimer = 0;

  // ============= INTEREST RATE MECHANIC =============
  // Safe zone that shrinks over time
  const mapCenterX = map.width / 2;
  const mapCenterY = map.height / 2;
  const initialSafeRadius = Math.min(map.width, map.height) / 2 - TILE_SIZE; // Larger initial zone
  let currentSafeRadius = initialSafeRadius;
  const SHRINK_RATE = 5; // pixels per second (slower shrink)
  let outsideDamageTimer = 0;
  const OUTSIDE_DAMAGE_INTERVAL = 0.8; // More forgiving damage interval

  // Visual for safe zone boundary
  const safeZoneVisual = k.add([
    k.circle(currentSafeRadius),
    k.pos(mapCenterX, mapCenterY),
    k.anchor("center"),
    k.color(100, 255, 100),
    k.opacity(0.15),
    k.outline(2, k.rgb(100, 255, 100)),
    k.z(1)
  ]);

  // Interest rate display
  const interestText = k.add([
    k.text("Interest: 0%", { size: 8 }),
    k.pos(map.width / 2, 10),
    k.anchor("center"),
    k.color(255, 100, 100),
    k.z(100)
  ]);

  // ============= DEBT COLLECTORS =============
  const debtCollectors: GameObj<any>[] = [];
  let collectorSpawnTimer = 0;
  const COLLECTOR_SPAWN_INTERVAL = 6; // Slower collector spawns
  const MAX_COLLECTORS = 3; // Fewer max collectors

  // ============= PROJECTILE SYSTEM =============
  // Debt Manager throws: Rocket (fast straight), Diamond (bounces), Egg (slippery zone)
  const projectiles: GameObj<any>[] = [];
  const slipperyZones: GameObj<any>[] = [];
  let projectileSpawnTimer = 0;
  const PROJECTILE_SPAWN_INTERVAL = 2.5; // Slower projectile spawns
  const PROJECTILE_TYPES = ["rocket", "diamond", "egg"] as const;
  type ProjectileType = typeof PROJECTILE_TYPES[number];

  function spawnProjectile(type: ProjectileType): void {
    const tuSePos = k.vec2(map.width / 2, 40);
    const toPlayer = player.pos.sub(tuSePos);
    const dir = toPlayer.unit();
    
    // ============= WARNING INDICATOR (0.5s before firing) =============
    const warningAngle = Math.atan2(dir.y, dir.x) * (180 / Math.PI);
    const warningLength = toPlayer.len();
    
    const warningLine = k.add([
      k.rect(warningLength, 2),
      k.pos(tuSePos.x, tuSePos.y + 30),
      k.anchor("left"),
      k.rotate(warningAngle),
      k.color(255, 50, 50),
      k.opacity(0.6),
      k.z(7),
      "hazardous",
      "temporary_junk" // Tag for cleanup on win
    ]);
    
    // Flash the warning line
    warningLine.onUpdate(() => {
      warningLine.opacity = 0.3 + Math.sin(k.time() * 20) * 0.3;
    });
    
    // Spawn actual projectile after delay
    k.wait(0.5, () => {
      if (warningLine.exists()) warningLine.destroy();
      actuallySpawnProjectile(type, dir, tuSePos);
    });
  }

  function actuallySpawnProjectile(type: ProjectileType, dir: any, tuSePos: any): void {
    let projectile: GameObj<any>;
    
    if (type === "rocket") {
      // Fast straight line - smaller hitbox for precision dodging
      projectile = k.add([
        k.polygon([k.vec2(-6, -3), k.vec2(6, 0), k.vec2(-6, 3)]),
        k.pos(tuSePos.x, tuSePos.y + 30),
        k.anchor("center"),
        k.area({ shape: new k.Rect(k.vec2(0, 0), 8, 5), scale: k.vec2(0.6, 0.6) }),
        k.rotate(Math.atan2(dir.y, dir.x) * (180 / Math.PI)),
        k.color(255, 100, 50),
        k.z(8),
        "projectile",
        "hazardous",
        "rocket",
        {
          projType: "rocket",
          dir: dir,
          speed: 160 // Slower speed
        }
      ]);
    } else if (type === "diamond") {
      // Bounces off walls - smaller hitbox
      projectile = k.add([
        k.polygon([k.vec2(0, -6), k.vec2(6, 0), k.vec2(0, 6), k.vec2(-6, 0)]),
        k.pos(tuSePos.x, tuSePos.y + 30),
        k.anchor("center"),
        k.area({ shape: new k.Rect(k.vec2(0, 0), 8, 8), scale: k.vec2(0.6, 0.6) }),
        k.color(100, 200, 255),
        k.z(8),
        "projectile",
        "hazardous",
        "diamond",
        {
          projType: "diamond",
          dir: k.vec2(k.rand(-1, 1), k.rand(0.3, 1)).unit(),
          speed: 100, // Slower speed
          bounces: 0,
          maxBounces: 3 // Fewer bounces
        }
      ]);
      // Sparkle effect
      projectile.onUpdate(() => {
        projectile.angle = (projectile.angle || 0) + 180 * k.dt();
      });
    } else {
      // Egg - splats on ground, smaller hitbox
      projectile = k.add([
        k.circle(7),
        k.pos(tuSePos.x, tuSePos.y + 30),
        k.anchor("center"),
        k.area({ shape: new k.Rect(k.vec2(0, 0), 10, 10), scale: k.vec2(0.6, 0.6) }),
        k.color(255, 240, 200),
        k.z(8),
        "projectile",
        "hazardous",
        "egg",
        {
          projType: "egg",
          dir: dir,
          speed: 80, // Slower speed
          targetPos: player.pos.clone()
        }
      ]);
    }
    
    projectiles.push(projectile);
  }

  function updateProjectiles(dt: number): void {
    projectiles.forEach((proj, idx) => {
      if (!proj.exists()) return;
      
      if (proj.projType === "rocket") {
        proj.pos = proj.pos.add(proj.dir.scale(proj.speed * dt));
        // Destroy if out of bounds
        if (proj.pos.x < 0 || proj.pos.x > map.width || 
            proj.pos.y < 0 || proj.pos.y > map.height) {
          proj.destroy();
          projectiles.splice(idx, 1);
        }
      } else if (proj.projType === "diamond") {
        proj.pos = proj.pos.add(proj.dir.scale(proj.speed * dt));
        // Bounce off walls
        if (proj.pos.x < TILE_SIZE || proj.pos.x > map.width - TILE_SIZE) {
          proj.dir.x *= -1;
          proj.bounces++;
          proj.pos.x = k.clamp(proj.pos.x, TILE_SIZE, map.width - TILE_SIZE);
        }
        if (proj.pos.y < TILE_SIZE || proj.pos.y > map.height - TILE_SIZE) {
          proj.dir.y *= -1;
          proj.bounces++;
          proj.pos.y = k.clamp(proj.pos.y, TILE_SIZE, map.height - TILE_SIZE);
        }
        if (proj.bounces >= proj.maxBounces) {
          proj.destroy();
          projectiles.splice(idx, 1);
        }
      } else if (proj.projType === "egg") {
        proj.pos = proj.pos.add(proj.dir.scale(proj.speed * dt));
        // Check if reached target area
        const distToTarget = proj.pos.dist(proj.targetPos);
        if (distToTarget < 15) {
          // Splat! Create slippery zone
          createSlipperyZone(proj.pos.x, proj.pos.y);
          proj.destroy();
          projectiles.splice(idx, 1);
        }
        // Also splat if out of bounds
        if (proj.pos.x < TILE_SIZE || proj.pos.x > map.width - TILE_SIZE ||
            proj.pos.y < TILE_SIZE || proj.pos.y > map.height - TILE_SIZE) {
          createSlipperyZone(proj.pos.x, proj.pos.y);
          proj.destroy();
          projectiles.splice(idx, 1);
        }
      }
    });
  }

  function createSlipperyZone(x: number, y: number): void {
    const zone = k.add([
      k.circle(25),
      k.pos(x, y),
      k.anchor("center"),
      k.color(255, 255, 100),
      k.opacity(0.4),
      k.area(),
      k.z(2),
      "slippery",
      {
        lifetime: 5,
        timer: 0
      }
    ]);
    slipperyZones.push(zone);
    
    // Egg splat particles
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      k.add([
        k.circle(4),
        k.pos(x + Math.cos(angle) * 10, y + Math.sin(angle) * 10),
        k.anchor("center"),
        k.color(255, 230, 150),
        k.opacity(0.8),
        k.z(3),
        {
          vel: k.vec2(Math.cos(angle) * 30, Math.sin(angle) * 30)
        }
      ]).onUpdate(function(this: GameObj<any>) {
        this.pos = this.pos.add(this.vel.scale(k.dt()));
        this.opacity -= k.dt() * 0.8;
        if (this.opacity <= 0) this.destroy();
      });
    }
  }

  // Babythree enemies
  const enemies: GameObj<any>[] = [];
  
  // Spawn timer
  let spawnTimer = 0;
  const SPAWN_INTERVAL = 2.5;
  const MAX_ENEMIES = 6;
  const SURVIVAL_TIME = 15;
  let timeElapsed = 0;
  let levelComplete = false;

  // Create UI
  const ui = createGameUI(k);

  // Survival timer display (world-space)
  const timerText = k.add([
    k.text(`Time: ${SURVIVAL_TIME}s`, { size: 10 }),
    k.pos(map.width / 2, 25),
    k.anchor("center"),
    k.color(255, 255, 100),
    k.z(100),
    "temporary_junk" // Tag for cleanup on win
  ]);

  // Tutorial text at start
  const tutorialText = k.add([
    k.text("Survive 15 seconds for the elevator to open!", { size: 8 }),
    k.pos(map.width / 2, map.height - 30),
    k.anchor("center"),
    k.color(100, 255, 200),
    k.z(100),
    k.opacity(1)
  ]);

  // Fade out tutorial after 3 seconds
  k.wait(3, () => {
    if (tutorialText.exists()) {
      k.tween(1, 0, 1, (val) => {
        if (tutorialText.exists()) tutorialText.opacity = val;
      }, k.easings.easeOutQuad).onEnd(() => {
        if (tutorialText.exists()) tutorialText.destroy();
      });
    }
  });

  // ============= ELEVATOR MECHANIC =============
  let elevatorOpen = false;
  const elevatorX = map.width - TILE_SIZE * 3; // Top-right corner
  const elevatorY = TILE_SIZE * 1.5;

  // Elevator door (initially closed)
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

  // Elevator label
  k.add([
    k.text("ELEVATOR", { size: 6 }),
    k.pos(elevatorX, elevatorY + 10),
    k.anchor("center"),
    k.color(150, 150, 150),
    k.z(4)
  ]);

  // Elevator glow (hidden until timer ends)
  const elevatorGlow = k.add([
    k.circle(TILE_SIZE),
    k.pos(elevatorX, elevatorY),
    k.anchor("center"),
    k.color(100, 255, 100),
    k.opacity(0),
    k.z(2)
  ]);

  function openElevator(): void {
    elevatorOpen = true;
    
    // ============= CLEAN UP THE ROOM =============
    // Destroy ALL hazardous entities - room must be EMPTY
    k.destroyAll("hazardous");
    k.destroyAll("enemy");
    k.destroyAll("projectile");
    k.destroyAll("slippery");
    k.destroyAll("babythree");
    k.destroyAll("debt-collector");
    k.destroyAll("shout");
    k.destroyAll("temporary_junk"); // Critical: removes timer, warning lines, Pay up! text
    
    // Show "Elevator Open!" text (new object, not the destroyed timer)
    const elevatorOpenText = k.add([
      k.text("Elevator Open!", { size: 10 }),
      k.pos(map.width / 2, 25),
      k.anchor("center"),
      k.color(100, 255, 100),
      k.z(100)
    ]);
    
    // Fade out and destroy after 1.5s
    k.wait(1.5, () => {
      if (elevatorOpenText.exists()) {
        k.tween(1, 0, 0.5, (val) => {
          if (elevatorOpenText.exists()) elevatorOpenText.opacity = val;
        }, k.easings.easeOutQuad).onEnd(() => {
          if (elevatorOpenText.exists()) elevatorOpenText.destroy();
        });
      }
    });
    
    // Clear local arrays
    enemies.length = 0;
    debtCollectors.length = 0;
    projectiles.length = 0;
    slipperyZones.length = 0;
    
    // Change elevator color to green (open)
    elevator.color = k.rgb(100, 200, 100);
    elevator.outline.color = k.rgb(50, 255, 50);
    
    // Show glowing light
    k.tween(0, 0.5, 0.5, (val) => {
      elevatorGlow.opacity = val;
    }, k.easings.easeOutQuad);

    // Pulsing glow effect
    elevatorGlow.onUpdate(() => {
      elevatorGlow.opacity = 0.3 + Math.sin(k.time() * 4) * 0.2;
    });

    // Show "Enter" text above elevator
    k.add([
      k.text("ENTER!", { size: 8 }),
      k.pos(elevatorX, elevatorY - 15),
      k.anchor("center"),
      k.color(100, 255, 100),
      k.z(100),
      "elevator-prompt"
    ]);

    // Debt Manager "Defeated" animation - change to thumbs up pose
    if (tuSe && tuSe.exists()) {
      tuSe.color = k.rgb(100, 180, 100); // Change to green (defeated/accepts)
      
      // Show defeat message
      const defeatText = k.add([
        k.text("👍 Tch... Fine. The elevator is yours.", { size: 7 }),
        k.pos(tuSe.pos.x, tuSe.pos.y - 30),
        k.anchor("center"),
        k.color(200, 200, 100),
        k.opacity(1),
        k.z(100)
      ]);
      
      // Fade out defeat text after 2s, then destroy tuSe
      k.wait(2, () => {
        if (defeatText.exists()) {
          k.tween(1, 0, 0.5, (val) => {
            if (defeatText.exists()) defeatText.opacity = val;
          }, k.easings.easeOutQuad).onEnd(() => {
            if (defeatText.exists()) defeatText.destroy();
          });
        }
        // Fade out and destroy tuSe (Debt Manager)
        if (tuSe && tuSe.exists()) {
          k.tween(1, 0, 0.5, (val) => {
            if (tuSe.exists()) tuSe.opacity = val;
          }, k.easings.easeOutQuad).onEnd(() => {
            if (tuSe.exists()) tuSe.destroy();
          });
        }
      });
    }
  }

  // Spawn Babythree enemies
  function spawnBabythree(): void {
    if (enemies.length >= MAX_ENEMIES) return;

    const side = Math.floor(k.rand(0, 4));
    let x = 0, y = 0;
    
    switch (side) {
      case 0: x = TILE_SIZE * 2; y = k.rand(TILE_SIZE * 2, map.height - TILE_SIZE * 2); break;
      case 1: x = map.width - TILE_SIZE * 2; y = k.rand(TILE_SIZE * 2, map.height - TILE_SIZE * 2); break;
      case 2: x = k.rand(TILE_SIZE * 2, map.width - TILE_SIZE * 2); y = TILE_SIZE * 2; break;
      case 3: x = k.rand(TILE_SIZE * 2, map.width - TILE_SIZE * 2); y = map.height - TILE_SIZE * 2; break;
    }

    const babythree = k.add([
      k.sprite("babythree"),
      k.pos(x, y),
      k.anchor("center"),
      k.area(),
      k.z(5),
      "babythree",
      "enemy",
      {
        speed: 36 + timeElapsed * 1.5,
        target: player
      }
    ]);
    enemies.push(babythree);
  }

  // Spawn Debt Collector - charges in straight line with telegraph
  function spawnDebtCollector(): void {
    if (debtCollectors.length >= MAX_COLLECTORS) return;

    // Spawn at random edge, facing player
    const side = Math.floor(k.rand(0, 4));
    let x = 0, y = 0;
    
    switch (side) {
      case 0: x = TILE_SIZE; y = k.rand(TILE_SIZE * 3, map.height - TILE_SIZE * 3); break;
      case 1: x = map.width - TILE_SIZE; y = k.rand(TILE_SIZE * 3, map.height - TILE_SIZE * 3); break;
      case 2: x = k.rand(TILE_SIZE * 3, map.width - TILE_SIZE * 3); y = TILE_SIZE; break;
      case 3: x = k.rand(TILE_SIZE * 3, map.width - TILE_SIZE * 3); y = map.height - TILE_SIZE; break;
    }

    const collector = k.add([
      k.sprite("debt-collector"),
      k.pos(x, y),
      k.anchor("center"),
      k.area(),
      k.z(6),
      "debt-collector",
      "enemy",
      {
        state: "telegraph", // telegraph -> charging -> cooldown
        stateTimer: 0,
        chargeDir: k.vec2(0, 0),
        chargeSpeed: 300,
        telegraphLine: null as GameObj<any> | null
      }
    ]);
    
    debtCollectors.push(collector);
  }

  // Update debt collector behavior
  function updateDebtCollector(collector: GameObj<any>, dt: number): void {
    collector.stateTimer += dt;

    if (collector.state === "telegraph") {
      // Calculate direction to player
      const toPlayer = player.pos.sub(collector.pos);
      collector.chargeDir = toPlayer.unit();

      // Show telegraph line (red warning line)
      if (!collector.telegraphLine) {
        collector.telegraphLine = k.add([
          k.rect(toPlayer.len(), 3),
          k.pos(collector.pos),
          k.anchor("left"),
          k.rotate(Math.atan2(toPlayer.y, toPlayer.x) * (180 / Math.PI)),
          k.color(255, 50, 50),
          k.opacity(0.7),
          k.z(4)
        ]);
        
        // Blink effect
        collector.telegraphLine.onUpdate(() => {
          if (collector.telegraphLine) {
            collector.telegraphLine.opacity = 0.4 + Math.sin(k.time() * 20) * 0.3;
          }
        });
      }

      // Update telegraph line
      if (collector.telegraphLine) {
        const newToPlayer = player.pos.sub(collector.pos);
        collector.telegraphLine.pos = collector.pos;
        collector.telegraphLine.width = newToPlayer.len();
        collector.telegraphLine.angle = Math.atan2(newToPlayer.y, newToPlayer.x) * (180 / Math.PI);
        collector.chargeDir = newToPlayer.unit();
      }

      // After 0.5s, start charging
      if (collector.stateTimer >= 0.5) {
        collector.state = "charging";
        collector.stateTimer = 0;
        if (collector.telegraphLine) {
          collector.telegraphLine.destroy();
          collector.telegraphLine = null;
        }
        // Flash white before charge
        collector.color = k.rgb(255, 255, 255);
        k.wait(0.1, () => {
          if (collector.exists()) collector.color = k.rgb(255, 255, 255);
        });
      }
    }

    if (collector.state === "charging") {
      // Move in straight line at high speed
      collector.pos = collector.pos.add(collector.chargeDir.scale(collector.chargeSpeed * dt));

      // Flash red while charging
      collector.color = k.rgb(255, 100 + Math.sin(k.time() * 30) * 50, 100);

      // Stop after 0.6s or hitting wall
      if (collector.stateTimer >= 0.6) {
        collector.state = "cooldown";
        collector.stateTimer = 0;
        collector.color = k.rgb(255, 255, 255);
      }

      // Check bounds
      if (collector.pos.x < TILE_SIZE || collector.pos.x > map.width - TILE_SIZE ||
          collector.pos.y < TILE_SIZE || collector.pos.y > map.height - TILE_SIZE) {
        collector.state = "cooldown";
        collector.stateTimer = 0;
      }
    }

    if (collector.state === "cooldown") {
      // Wait before next charge
      collector.color = k.rgb(139, 69, 69); // Dimmed
      if (collector.stateTimer >= 1.5) {
        collector.state = "telegraph";
        collector.stateTimer = 0;
      }
    }
  }

  // Spawn initial wave
  for (let i = 0; i < 2; i++) {
    spawnBabythree();
  }

  k.onUpdate(() => {
    if (gameState.isPaused() || gameState.isDialogueActive() || levelComplete) return;

    const dt = k.dt();
    timeElapsed += dt;
    maskManager.update(dt);

    // Update camera to follow player
    camera.follow(player, k.mousePos());

    // ===== INTEREST RATE: Shrink safe zone (only while level active) =====
    if (!elevatorOpen) {
      currentSafeRadius = Math.max(TILE_SIZE * 3, initialSafeRadius - timeElapsed * SHRINK_RATE);
      safeZoneVisual.radius = currentSafeRadius;
      
      // Update interest rate display
      const interestRate = Math.floor((1 - currentSafeRadius / initialSafeRadius) * 100);
      interestText.text = `Lãi suất: ${interestRate}%`;
      interestText.color = k.rgb(255, Math.max(0, 255 - interestRate * 2), Math.max(0, 100 - interestRate));

      // Change safe zone color as it shrinks
      const dangerLevel = 1 - currentSafeRadius / initialSafeRadius;
      safeZoneVisual.color = k.rgb(
        100 + dangerLevel * 155,
        255 - dangerLevel * 200,
        100 - dangerLevel * 100
      );

      // Check if player is outside safe zone
      const distFromCenter = player.pos.dist(k.vec2(mapCenterX, mapCenterY));
      if (distFromCenter > currentSafeRadius) {
        outsideDamageTimer += dt;
        
        // Visual warning - tint player red when outside zone
        if (!gameState.isInvincible() && !gameState.isPlayerEthereal()) {
          player.color = k.rgb(255, 100, 100);
        }
      
      if (outsideDamageTimer >= OUTSIDE_DAMAGE_INTERVAL) {
        outsideDamageTimer = 0;
        
        // Only damage if not invincible
        if (!gameState.isInvincible() && !gameState.isPlayerEthereal()) {
          gameState.damagePlayer(1);
          camera.shake(5, 0.2);
          
          // Brief invincibility to prevent rapid damage
          gameState.setInvincible(true);
          const blinkLoop = k.loop(0.1, () => {
            player.opacity = player.opacity > 0.5 ? 0.3 : 1;
          });
          k.wait(0.5, () => {
            blinkLoop.cancel();
            player.opacity = 1;
            gameState.setInvincible(false);
          });
          
          if (gameState.isPlayerDead()) {
            k.go("gameover");
            return;
          }
        }
      }
    } else {
      outsideDamageTimer = 0;
      // Restore normal color when back in safe zone
      if (!gameState.isPlayerEthereal() && !gameState.isInvincible()) {
        player.color = k.rgb(79, 195, 247);
      }
    }
    } // End of !elevatorOpen block for safe zone mechanics

    // Update timer display (only if elevator not yet open)
    if (!elevatorOpen && timerText.exists()) {
      const remaining = Math.max(0, SURVIVAL_TIME - timeElapsed);
      timerText.text = `Time: ${remaining.toFixed(1)}s`;
    }

    // Check for victory
    if (timeElapsed >= SURVIVAL_TIME && !elevatorOpen) {
      // Open elevator instead of immediate level complete
      openElevator();
    }

    // Spawn more babythree enemies
    spawnTimer += dt;
    if (spawnTimer >= SPAWN_INTERVAL && !elevatorOpen) {
      spawnTimer = 0;
      spawnBabythree();
    }

    // Spawn debt collectors periodically
    collectorSpawnTimer += dt;
    if (collectorSpawnTimer >= COLLECTOR_SPAWN_INTERVAL && timeElapsed > 3 && !elevatorOpen) {
      collectorSpawnTimer = 0;
      spawnDebtCollector();
    }

    // Spawn projectiles from Debt Manager
    projectileSpawnTimer += dt;
    if (projectileSpawnTimer >= PROJECTILE_SPAWN_INTERVAL && timeElapsed > 1 && !elevatorOpen) {
      projectileSpawnTimer = 0;
      const randomType = PROJECTILE_TYPES[Math.floor(k.rand(0, PROJECTILE_TYPES.length))];
      spawnProjectile(randomType);
    }

    // Update projectiles
    updateProjectiles(dt);

    // Update slippery zones lifetime
    slipperyZones.forEach((zone, idx) => {
      if (!zone.exists()) return;
      zone.timer += dt;
      zone.opacity = 0.4 * (1 - zone.timer / zone.lifetime);
      if (zone.timer >= zone.lifetime) {
        zone.destroy();
        slipperyZones.splice(idx, 1);
      }
    });

    // Update enemies - chase player (stop when elevator open)
    enemies.forEach(enemy => {
      if (enemy.exists() && !gameState.isTimeFrozen() && !elevatorOpen) {
        const dir = player.pos.sub(enemy.pos).unit();
        enemy.move(dir.scale(enemy.speed));
      }
    });

    // Update debt collectors
    debtCollectors.forEach(collector => {
      if (collector.exists() && !gameState.isTimeFrozen()) {
        updateDebtCollector(collector, dt);
      }
    });

    // Debt Manager shouts periodically
    shoutTimer += dt;
    if (shoutTimer >= 3) {
      shoutTimer = 0;
      tuSeShout(k, tuSe);
    }

    // Update UI
    updateGameUI(k, ui, maskManager, player.pos, camera);
  });

  // Enemy collision - damage player
  player.onCollide("babythree", () => {
    if (gameState.isPlayerEthereal()) return;
    if (gameState.isInvincible()) return;

    gameState.damagePlayer(1);
    camera.shake(8, 0.3);
    
    // Flash player red
    player.color = k.rgb(255, 50, 50);
    k.wait(0.2, () => {
      if (!gameState.isPlayerEthereal()) player.color = k.rgb(79, 195, 247);
    });
    
    // Knockback (with boundary clamping)
    const knockbackDir = player.pos.sub(k.vec2(map.width / 2, map.height / 2)).unit();
    const newX = player.pos.x + knockbackDir.x * 30;
    const newY = player.pos.y + knockbackDir.y * 30;
    player.pos.x = k.clamp(newX, TILE_SIZE * 1.5, map.width - TILE_SIZE * 1.5);
    player.pos.y = k.clamp(newY, TILE_SIZE * 1.5, map.height - TILE_SIZE * 1.5);

    if (gameState.isPlayerDead()) {
      k.go("gameover");
    }

    // Brief invincibility with blink effect
    gameState.setInvincible(true);
    const blinkLoop = k.loop(0.1, () => {
      player.opacity = player.opacity > 0.5 ? 0.3 : 1;
    });
    k.wait(1, () => {
      blinkLoop.cancel();
      player.opacity = 1;
      gameState.setInvincible(false);
    });
  });

  // Debt collector collision - more damage
  player.onCollide("debt-collector", (collector: GameObj<any>) => {
    if (gameState.isPlayerEthereal()) return;
    if (gameState.isInvincible()) return;
    if (collector.state !== "charging") return; // Only damage during charge

    gameState.damagePlayer(2);
    camera.shake(12, 0.4);
    
    // Flash player red
    player.color = k.rgb(255, 50, 50);
    k.wait(0.2, () => {
      if (!gameState.isPlayerEthereal()) player.color = k.rgb(79, 195, 247);
    });
    
    // Strong knockback (with boundary clamping)
    const knockbackDir = collector.chargeDir;
    const newX = player.pos.x + knockbackDir.x * 50;
    const newY = player.pos.y + knockbackDir.y * 50;
    player.pos.x = k.clamp(newX, TILE_SIZE * 1.5, map.width - TILE_SIZE * 1.5);
    player.pos.y = k.clamp(newY, TILE_SIZE * 1.5, map.height - TILE_SIZE * 1.5);

    if (gameState.isPlayerDead()) {
      k.go("gameover");
    }

    // Invincibility with blink effect
    gameState.setInvincible(true);
    const blinkLoop = k.loop(0.1, () => {
      player.opacity = player.opacity > 0.5 ? 0.3 : 1;
    });
    k.wait(1.5, () => {
      blinkLoop.cancel();
      player.opacity = 1;
      gameState.setInvincible(false);
    });
  });

  // Projectile collision - damage and special effects
  player.onCollide("projectile", (proj: GameObj<any>) => {
    if (gameState.isPlayerEthereal()) return;
    if (gameState.isInvincible()) return;

    gameState.damagePlayer(1);
    camera.shake(6, 0.2);
    
    // Flash player red
    player.color = k.rgb(255, 50, 50);
    k.wait(0.2, () => {
      if (!gameState.isPlayerEthereal()) player.color = k.rgb(79, 195, 247);
    });
    
    // Knockback based on projectile direction (with boundary clamping)
    if (proj.dir) {
      const newX = player.pos.x + proj.dir.x * 20;
      const newY = player.pos.y + proj.dir.y * 20;
      player.pos.x = k.clamp(newX, TILE_SIZE * 1.5, map.width - TILE_SIZE * 1.5);
      player.pos.y = k.clamp(newY, TILE_SIZE * 1.5, map.height - TILE_SIZE * 1.5);
    }

    if (gameState.isPlayerDead()) {
      k.go("gameover");
    }

    // Destroy projectile on hit
    proj.destroy();

    // Invincibility with blink effect
    gameState.setInvincible(true);
    const blinkLoop = k.loop(0.1, () => {
      player.opacity = player.opacity > 0.5 ? 0.3 : 1;
    });
    k.wait(0.8, () => {
      blinkLoop.cancel();
      player.opacity = 1;
      gameState.setInvincible(false);
    });
  });

  // Slippery zone effect - player slides
  let isSlipping = false;
  let slipDir = k.vec2(0, 0);
  
  player.onCollide("slippery", () => {
    if (!isSlipping) {
      isSlipping = true;
      // Get current movement direction
      slipDir = k.vec2(
        k.isKeyDown("d") ? 1 : k.isKeyDown("a") ? -1 : 0,
        k.isKeyDown("s") ? 1 : k.isKeyDown("w") ? -1 : 0
      ).unit();
      if (slipDir.len() === 0) slipDir = k.vec2(k.rand(-1, 1), k.rand(-1, 1)).unit();
    }
  });

  player.onCollideEnd("slippery", () => {
    isSlipping = false;
  });

  // Add slipping movement in update
  k.onUpdate(() => {
    if (isSlipping && !gameState.isPaused() && !levelComplete) {
      player.pos = player.pos.add(slipDir.scale(80 * k.dt()));
      // Clamp to map bounds
      player.pos.x = k.clamp(player.pos.x, TILE_SIZE, map.width - TILE_SIZE);
      player.pos.y = k.clamp(player.pos.y, TILE_SIZE, map.height - TILE_SIZE);
    }
  });

  // Elevator collision - enter to complete level
  player.onCollide("elevator", () => {
    if (!elevatorOpen || levelComplete) return;
    
    levelComplete = true;
    gameState.addCollectedMask(MASKS.ghost);
    
    // Clear enemies and projectiles
    enemies.forEach(e => e.destroy());
    debtCollectors.forEach(c => {
      if (c.telegraphLine) c.telegraphLine.destroy();
      c.destroy();
    });
    projectiles.forEach(p => p.destroy());
    slipperyZones.forEach(z => z.destroy());
    
    // Player enters elevator animation
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
  });
}

// Build level tiles from ASCII map
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

// Create player entity
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
      speed: 90,
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

    // Clamp player position to map boundaries
    const margin = TILE_SIZE;
    player.pos.x = k.clamp(player.pos.x, margin, mapWidth - margin);
    player.pos.y = k.clamp(player.pos.y, margin, mapHeight - margin);

    if (gameState.isPlayerEthereal()) {
      player.opacity = 0.4;
      player.color = k.rgb(200, 150, 255);
    } else {
      player.opacity = 1;
      player.color = k.rgb(79, 195, 247);
    }
  });

  k.onKeyPress("space", () => {
    if (gameState.isPaused() || gameState.isDialogueActive()) return;
    maskManager.activateAbility(player);
  });

  return player;
}

// Create Debt Manager NPC
function createTuSe(k: KaboomCtx, x: number, y: number): GameObj<any> {
  return k.add([
    k.sprite("tuse"),
    k.pos(x, y),
    k.anchor("center"),
    k.z(5),
    "tuse",
    {
      lastShout: 0
    }
  ]);
}

// Debt Manager shout effect
function tuSeShout(k: KaboomCtx, tuSe: GameObj<any>): void {
  const shout = k.add([
    k.text("Pay up!", { size: 8 }),
    k.pos(tuSe.pos.x, tuSe.pos.y + 12),
    k.anchor("center"),
    k.color(255, 200, 50),
    k.z(99),
    "shout",
    "temporary_junk" // Tag for cleanup on win
  ]);

  k.wait(1.5, () => {
    if (shout.exists()) shout.destroy();
  });
}
