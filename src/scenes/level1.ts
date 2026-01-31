// Level 1: The Gatekeepers - Stealth Level (Updated with Camera & Maps)
import { KaboomCtx, GameObj } from "kaboom";
import { MaskManager } from "../mechanics/MaskManager.ts";
import { setupPauseSystem } from "../mechanics/PauseSystem.ts";
import { gameState } from "../state.ts";
import { LEVEL_DIALOGUES, MASKS } from "../constants.ts";
import { showDialogue } from "./dialogue.ts";
import { CameraController } from "../camera.ts";
import { createGameUI, updateGameUI } from "../ui.ts";
import { LEVEL_1_MAP, findInMap, getPlayerSpawn, getElevatorPosition } from "../maps.ts";
import { TILE_SIZE } from "../loader.ts";

export function level1Scene(k: KaboomCtx): void {
  const map = LEVEL_1_MAP;
  
  // Setup pause system (ESC to pause)
  setupPauseSystem(k);
  
  // Initialize camera with zoom
  const camera = new CameraController(k, {
    zoom: 3,
    lerpSpeed: 0.08,
    lookAheadDistance: 20
  });
  
  // Set camera bounds to level size
  camera.setBounds(0, 0, map.width, map.height);

  // Initialize mask manager
  const maskManager = new MaskManager(k);
  
  // Prepare player state for level
  gameState.prepareForLevel(1);

  // Build the level from ASCII map
  buildLevel(k, map);

  // Get spawn positions from map
  const playerSpawn = getPlayerSpawn(map);
  const elevatorPos = getElevatorPosition(map);

  // Create player
  const player = createPlayer(k, playerSpawn.x, playerSpawn.y, maskManager);

  // Snap camera to player initially
  camera.snapTo(k.vec2(playerSpawn.x, playerSpawn.y));

  // Create elevator
  k.add([
    k.sprite("elevator"),
    k.pos(elevatorPos.x, elevatorPos.y),
    k.anchor("center"),
    k.area(),
    k.z(5),
    "elevator"
  ]);

  // Create guards from map
  const guards = createGuardsFromMap(k, map);
  
  // Create cameras from map
  const cameras = createCamerasFromMap(k, map);

  // Create UI
  const ui = createGameUI(k);

  // Detection state with alert UI
  let detectionTimer = 0;
  const DETECTION_TIME = 0.5;
  
  // Alert icon above player (! with red fill)
  const alertIcon = k.add([
    k.text("!", { size: 20 }),
    k.pos(player.pos.x, player.pos.y - 20),
    k.anchor("center"),
    k.color(255, 50, 50),
    k.opacity(0),
    k.z(200)
  ]);

  const alertBg = k.add([
    k.rect(18, 18),
    k.pos(player.pos.x, player.pos.y - 20),
    k.anchor("center"),
    k.color(255, 50, 50),
    k.opacity(0),
    k.z(199)
  ]);

  // Main game loop
  k.onUpdate(() => {
    if (gameState.isPaused() || gameState.isDialogueActive()) return;

    // Update mask manager
    maskManager.update(k.dt());

    // Update camera to follow player
    camera.follow(player, k.mousePos());

    // Check detection from guards and cameras
    let isDetected = false;

    guards.forEach(guard => {
      if (gameState.isTimeFrozen()) return;
      updateGuardPatrol(k, guard);
      const canSee = canSeePlayer(k, guard, player, guard.visionRange, guard.visionAngle);
      guard.canSeePlayer = canSee;
      if (canSee && !gameState.isPlayerInvisible()) isDetected = true;
    });

    cameras.forEach(cam => {
      if (gameState.isTimeFrozen()) return;
      updateCameraRotation(k, cam);
      const canSee = canSeeByCam(k, cam, player);
      cam.canSeePlayer = canSee;
      if (canSee && !gameState.isPlayerInvisible()) isDetected = true;
    });

    // Update alert icon position to follow player
    alertIcon.pos = k.vec2(player.pos.x, player.pos.y - 20);
    alertBg.pos = k.vec2(player.pos.x, player.pos.y - 20);

    // Handle detection with grace period
    if (isDetected) {
      detectionTimer += k.dt();
      
      // Show alert UI with fill-up effect
      const fillPercent = Math.min(detectionTimer / DETECTION_TIME, 1);
      alertIcon.opacity = 0.5 + Math.sin(k.time() * 20) * 0.3; // Pulse fast
      alertBg.opacity = fillPercent * 0.6;
      alertBg.height = 18 * fillPercent; // Fill up from bottom
      
      // Flash player red
      player.color = k.rgb(255, 100, 100);
      
      // If timer exceeds threshold, damage player AND teleport to spawn
      if (detectionTimer >= DETECTION_TIME) {
        gameState.damagePlayer(1);
        detectionTimer = 0;
        camera.shake(10, 0.4);
        
        // STRICTER PENALTY: Teleport player back to spawn point
        player.pos.x = playerSpawn.x;
        player.pos.y = playerSpawn.y;
        camera.snapTo(k.vec2(playerSpawn.x, playerSpawn.y));

        // Hide alert briefly
        alertIcon.opacity = 0;
        alertBg.opacity = 0;

        if (gameState.isPlayerDead()) {
          k.go("gameover");
        }
        
        // Brief invincibility
        gameState.setInvincible(true);
        k.wait(1, () => {
          gameState.setInvincible(false);
        });
      }
    } else {
      // Not detected - reset timer and hide alert
      detectionTimer = 0;
      alertIcon.opacity = 0;
      alertBg.opacity = 0;
      
      if (!gameState.isPlayerInvisible()) {
        player.color = k.rgb(79, 195, 247);
      }
    }

    // Update UI with objective pointer
    updateGameUI(k, ui, maskManager, k.vec2(elevatorPos.x, elevatorPos.y), camera);
  });

  // Elevator collision - level complete
  player.onCollide("elevator", () => {
    gameState.addCollectedMask(MASKS.silence);
    
    showDialogue(k, LEVEL_DIALOGUES[1].outro!, () => {
      k.go("level2");
    });
  });

  // Show intro dialogue
  showDialogue(k, LEVEL_DIALOGUES[1].intro, () => {
    gameState.setDialogueActive(false);
  });
}

// Build level tiles from ASCII map
function buildLevel(k: KaboomCtx, map: typeof LEVEL_1_MAP): void {
  for (let y = 0; y < map.tiles.length; y++) {
    for (let x = 0; x < map.tiles[y].length; x++) {
      const char = map.tiles[y][x];
      const posX = x * TILE_SIZE + TILE_SIZE / 2;
      const posY = y * TILE_SIZE + TILE_SIZE / 2;

      // Always add floor
      k.add([
        k.sprite(map.floorSprite),
        k.pos(posX, posY),
        k.anchor("center"),
        k.z(0)
      ]);

      // Add wall if needed
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
  
  // Add invisible map boundaries to prevent player from leaving
  const mapWidth = map.tiles[0].length * TILE_SIZE;
  const mapHeight = map.tiles.length * TILE_SIZE;
  const boundaryThickness = 16;
  
  // Top boundary
  k.add([
    k.rect(mapWidth + boundaryThickness * 2, boundaryThickness),
    k.pos(-boundaryThickness, -boundaryThickness),
    k.area(),
    k.body({ isStatic: true }),
    k.opacity(0),
    k.z(100),
    "boundary"
  ]);
  
  // Bottom boundary
  k.add([
    k.rect(mapWidth + boundaryThickness * 2, boundaryThickness),
    k.pos(-boundaryThickness, mapHeight),
    k.area(),
    k.body({ isStatic: true }),
    k.opacity(0),
    k.z(100),
    "boundary"
  ]);
  
  // Left boundary
  k.add([
    k.rect(boundaryThickness, mapHeight + boundaryThickness * 2),
    k.pos(-boundaryThickness, -boundaryThickness),
    k.area(),
    k.body({ isStatic: true }),
    k.opacity(0),
    k.z(100),
    "boundary"
  ]);
  
  // Right boundary
  k.add([
    k.rect(boundaryThickness, mapHeight + boundaryThickness * 2),
    k.pos(mapWidth, -boundaryThickness),
    k.area(),
    k.body({ isStatic: true }),
    k.opacity(0),
    k.z(100),
    "boundary"
  ]);
}

// Create player entity
function createPlayer(k: KaboomCtx, x: number, y: number, maskManager: MaskManager): GameObj<any> {
  const player = k.add([
    k.sprite("player"),
    k.pos(x, y),
    k.anchor("center"),
    k.area(),
    k.body(),
    k.color(79, 195, 247),
    k.opacity(1),
    k.z(10),
    "player",
    {
      speed: 80,
      dir: k.vec2(0, 0)
    }
  ]);

  // Movement controls
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

    // Update visual based on state
    if (gameState.isPlayerInvisible()) {
      player.opacity = 0.3;
    } else {
      player.opacity = 1;
    }
  });

  // Ability activation
  k.onKeyPress("space", () => {
    if (gameState.isPaused() || gameState.isDialogueActive()) return;
    maskManager.activateAbility(player);
  });

  return player;
}

// Create guards from map positions
function createGuardsFromMap(k: KaboomCtx, map: typeof LEVEL_1_MAP): GameObj<any>[] {
  const positions = findInMap(map, 'G');
  const guards: GameObj<any>[] = [];

  positions.forEach((pos, index) => {
    const guard = k.add([
      k.sprite("guard"),
      k.pos(pos.x, pos.y),
      k.anchor("center"),
      k.area(),
      k.z(5),
      "guard",
      "enemy",
      {
        visionRange: 100,  // Increased for visibility
        visionAngle: 75,   // Wider angle for better detection
        speed: 30,
        patrolDir: index % 2 === 0 ? 1 : -1,
        patrolRange: 70,
        startX: pos.x,
        canSeePlayer: false,
        direction: k.vec2(1, 0)
      }
    ]);
    
    // Add vision cone rendering
    guard.onDraw(() => {
      const range = guard.visionRange;
      const halfAngle = (guard.visionAngle / 2) * (Math.PI / 180);
      const baseAngle = Math.atan2(guard.direction.y, guard.direction.x);
      
      // Vision cone color - red when detecting, yellow when patrolling
      const color = guard.canSeePlayer 
        ? k.rgb(255, 50, 50) 
        : k.rgb(255, 200, 50);
      const alpha = guard.canSeePlayer ? 0.5 : 0.25;
      
      // Draw filled triangle for vision cone
      k.drawTriangle({
        p1: k.vec2(0, 0),
        p2: k.vec2(
          Math.cos(baseAngle - halfAngle) * range,
          Math.sin(baseAngle - halfAngle) * range
        ),
        p3: k.vec2(
          Math.cos(baseAngle + halfAngle) * range,
          Math.sin(baseAngle + halfAngle) * range
        ),
        color: color,
        opacity: alpha
      });
    });
    
    guards.push(guard);
  });

  return guards;
}

// Create security cameras from map positions
function createCamerasFromMap(k: KaboomCtx, map: typeof LEVEL_1_MAP): GameObj<any>[] {
  const positions = findInMap(map, 'C');
  const cameras: GameObj<any>[] = [];

  positions.forEach((pos) => {
    const cam = k.add([
      k.sprite("camera-enemy"),
      k.pos(pos.x, pos.y),
      k.anchor("center"),
      k.z(6),
      "camera",
      "enemy",
      {
        visionRange: 120,  // Longer range
        visionAngle: 60,   // Wider angle
        rotationSpeed: 35,
        currentAngle: 90,
        sweepAngle: 100,   // Wider sweep
        sweepDir: 1,
        canSeePlayer: false
      }
    ]);
    
    // Add vision cone rendering for camera
    cam.onDraw(() => {
      const range = cam.visionRange;
      const halfAngle = (cam.visionAngle / 2) * (Math.PI / 180);
      const baseAngle = cam.currentAngle * (Math.PI / 180);
      
      // Vision cone color - red when detecting, cyan when scanning
      const color = cam.canSeePlayer 
        ? k.rgb(255, 50, 50) 
        : k.rgb(100, 200, 255);
      const alpha = cam.canSeePlayer ? 0.5 : 0.2;
      
      // Draw filled triangle for vision cone
      k.drawTriangle({
        p1: k.vec2(0, 0),
        p2: k.vec2(
          Math.cos(baseAngle - halfAngle) * range,
          Math.sin(baseAngle - halfAngle) * range
        ),
        p3: k.vec2(
          Math.cos(baseAngle + halfAngle) * range,
          Math.sin(baseAngle + halfAngle) * range
        ),
        color: color,
        opacity: alpha
      });
    });
    
    cameras.push(cam);
  });

  return cameras;
}

// Update guard patrol
function updateGuardPatrol(k: KaboomCtx, guard: GameObj<any>): void {
  // Simple horizontal patrol
  guard.pos.x += guard.speed * guard.patrolDir * k.dt();
  guard.direction.x = guard.patrolDir;
  guard.direction.y = 0;

  if (Math.abs(guard.pos.x - guard.startX) > guard.patrolRange) {
    guard.patrolDir *= -1;
  }
}

// Update camera rotation
function updateCameraRotation(k: KaboomCtx, cam: GameObj<any>): void {
  cam.currentAngle += cam.rotationSpeed * cam.sweepDir * k.dt();
  
  if (cam.currentAngle > 90 + cam.sweepAngle / 2) {
    cam.sweepDir = -1;
  } else if (cam.currentAngle < 90 - cam.sweepAngle / 2) {
    cam.sweepDir = 1;
  }
}

// Check if guard can see player
function canSeePlayer(_k: KaboomCtx, entity: GameObj<any>, player: GameObj<any>, range: number, fov: number): boolean {
  if (gameState.isPlayerInvisible()) return false;

  const toPlayer = player.pos.sub(entity.pos);
  const distance = toPlayer.len();

  if (distance > range) return false;

  const entityAngle = Math.atan2(entity.direction.y, entity.direction.x);
  const playerAngle = Math.atan2(toPlayer.y, toPlayer.x);
  
  let angleDiff = Math.abs(entityAngle - playerAngle);
  if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;

  const halfFov = (fov / 2) * (Math.PI / 180);
  
  return angleDiff <= halfFov;
}

// Check if camera can see player
function canSeeByCam(_k: KaboomCtx, cam: GameObj<any>, player: GameObj<any>): boolean {
  if (gameState.isPlayerInvisible()) return false;

  const toPlayer = player.pos.sub(cam.pos);
  const distance = toPlayer.len();

  if (distance > cam.visionRange) return false;

  const camAngle = cam.currentAngle * (Math.PI / 180);
  const playerAngle = Math.atan2(toPlayer.y, toPlayer.x);
  
  let angleDiff = Math.abs(camAngle - playerAngle);
  if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;

  const halfFov = (cam.visionAngle / 2) * (Math.PI / 180);
  
  return angleDiff <= halfFov;
}
