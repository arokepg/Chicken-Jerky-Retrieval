// Level 4: The Football Stadium - Theatre of Dreams with chaotic red players
import { KaboomCtx, GameObj } from "kaboom";
import { MaskManager } from "../mechanics/MaskManager.ts";
import { setupPauseSystem } from "../mechanics/PauseSystem.ts";
import { gameState } from "../state.ts";
import { LEVEL_DIALOGUES, MASKS } from "../constants.ts";
import { showDialogue } from "./dialogue.ts";
import { CameraController } from "../camera.ts";
import { createGameUI, updateGameUI } from "../ui.ts";
import { LEVEL_4_MAP, getPlayerSpawn, getElevatorPosition } from "../maps.ts";
import { TILE_SIZE } from "../loader.ts";

export function level4Scene(k: KaboomCtx): void {
  const map = LEVEL_4_MAP;
  
  // Setup pause system (ESC to pause)
  setupPauseSystem(k);
  
  // Initialize camera with zoom
  const camera = new CameraController(k, {
    zoom: 3,
    lerpSpeed: 0.1,
    lookAheadDistance: 20
  });
  
  camera.setBounds(0, 0, map.width, map.height);

  // Initialize mask manager
  const maskManager = new MaskManager(k);
  
  // Prepare player state
  gameState.prepareForLevel(4);

  // Build the level from ASCII map
  buildLevel(k, map);

  // Get spawn positions from map
  const playerSpawn = getPlayerSpawn(map);
  const elevatorPos = getElevatorPosition(map);

  // Create player
  const player = createPlayer(k, playerSpawn.x, playerSpawn.y, maskManager);

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

  // ============= FOOTBALL STADIUM DECORATIONS =============
  
  // Green grass background overlay
  k.add([
    k.rect(map.width, map.height),
    k.pos(0, 0),
    k.color(40, 120, 40),
    k.z(-1)
  ]);

  // White yard lines (horizontal)
  const yardLineCount = 6;
  for (let i = 1; i < yardLineCount; i++) {
    const lineY = (map.height / yardLineCount) * i;
    k.add([
      k.rect(map.width - TILE_SIZE * 4, 2),
      k.pos(TILE_SIZE * 2, lineY),
      k.color(255, 255, 255),
      k.opacity(0.6),
      k.z(0)
    ]);
  }

  // Center circle
  k.add([
    k.circle(40),
    k.pos(map.width / 2, map.height / 2),
    k.anchor("center"),
    k.color(255, 255, 255),
    k.opacity(0),
    k.outline(2, k.rgb(255, 255, 255)),
    k.z(0)
  ]);

  // Center line (vertical)
  k.add([
    k.rect(2, map.height - TILE_SIZE * 4),
    k.pos(map.width / 2, TILE_SIZE * 2),
    k.color(255, 255, 255),
    k.opacity(0.6),
    k.z(0)
  ]);

  // ============= ANIMATED CROWD ON SIDELINES =============
  const crowdColors = [k.rgb(200, 50, 50), k.rgb(180, 40, 40), k.rgb(220, 60, 60)];
  
  // Top sideline crowd
  for (let i = 0; i < 20; i++) {
    const crowdX = TILE_SIZE * 1.5 + i * ((map.width - TILE_SIZE * 3) / 20);
    const crowdMember = k.add([
      k.rect(8, 12),
      k.pos(crowdX, TILE_SIZE * 0.8),
      k.anchor("bot"),
      k.color(crowdColors[i % 3]),
      k.z(2),
      {
        baseY: TILE_SIZE * 0.8,
        jumpOffset: k.rand(0, Math.PI * 2),
        isJumping: false
      }
    ]);
    
    // Crowd jumping animation using loop
    k.loop(0.5 + k.rand(0, 0.3), () => {
      if (crowdMember.exists()) {
        crowdMember.isJumping = !crowdMember.isJumping;
      }
    });
    
    crowdMember.onUpdate(() => {
      crowdMember.pos.y = crowdMember.baseY - (crowdMember.isJumping ? 6 : 0);
    });
  }

  // Bottom sideline crowd
  for (let i = 0; i < 20; i++) {
    const crowdX = TILE_SIZE * 1.5 + i * ((map.width - TILE_SIZE * 3) / 20);
    const crowdMember = k.add([
      k.rect(8, 12),
      k.pos(crowdX, map.height - TILE_SIZE * 0.3),
      k.anchor("bot"),
      k.color(crowdColors[i % 3]),
      k.z(2),
      {
        baseY: map.height - TILE_SIZE * 0.3,
        isJumping: false
      }
    ]);
    
    k.loop(0.5 + k.rand(0, 0.3), () => {
      if (crowdMember.exists()) {
        crowdMember.isJumping = !crowdMember.isJumping;
      }
    });
    
    crowdMember.onUpdate(() => {
      crowdMember.pos.y = crowdMember.baseY - (crowdMember.isJumping ? 6 : 0);
    });
  }

  // ============= RED DEVIL STATUES IN CORNERS =============
  const corners = [
    { x: TILE_SIZE * 2.5, y: TILE_SIZE * 2.5 },
    { x: map.width - TILE_SIZE * 2.5, y: TILE_SIZE * 2.5 },
    { x: TILE_SIZE * 2.5, y: map.height - TILE_SIZE * 2.5 },
    { x: map.width - TILE_SIZE * 2.5, y: map.height - TILE_SIZE * 2.5 }
  ];

  corners.forEach(corner => {
    // Statue base
    k.add([
      k.rect(20, 8),
      k.pos(corner.x, corner.y + 10),
      k.anchor("center"),
      k.color(60, 60, 60),
      k.z(3)
    ]);
    
    // Devil statue body
    k.add([
      k.text("👹", { size: 20 }),
      k.pos(corner.x, corner.y),
      k.anchor("center"),
      k.z(4)
    ]);
    
    // "Tượng Quỷ Đỏ" label
    k.add([
      k.text("Quỷ Đỏ", { size: 5 }),
      k.pos(corner.x, corner.y + 18),
      k.anchor("center"),
      k.color(200, 50, 50),
      k.z(4)
    ]);
  });

  // ============= RED PLAYERS (Football Players in Red Kits) =============
  const redPlayers: GameObj<any>[] = [];
  const RED_PLAYER_COUNT = 15; // High density crowd
  
  // Random names pool for Red Players (Fan Áo Đỏ) - Updated with new names
  const NAME_POOL = ["Anh Lực", "Anh Long", "Anh Vực", "Anh Những", "Anh Thể", "A Hoàng", "Vuốt Phó", "A Núi", "A Bủ", "Mắc Hài"];

  // Create Red Players (Football players)
  for (let i = 0; i < RED_PLAYER_COUNT; i++) {
    const x = k.rand(TILE_SIZE * 3, map.width - TILE_SIZE * 3);
    const y = k.rand(TILE_SIZE * 3, map.height - TILE_SIZE * 3);
    const randomName = NAME_POOL[Math.floor(k.rand(0, NAME_POOL.length))];
    
    const redPlayer = k.add([
      k.rect(10, 14, { radius: 2 }),
      k.pos(x, y),
      k.anchor("center"),
      k.area(),
      k.color(200, 40, 40), // Red kit
      k.outline(1, k.rgb(255, 255, 255)), // White trim
      k.z(5),
      "red-player",
      "enemy",
      {
        speed: k.rand(60, 120),
        dir: k.vec2(k.rand(-1, 1), k.rand(-1, 1)).unit(),
        dirChangeTimer: 0,
        dirChangeInterval: k.rand(0.3, 0.8), // Chaotic direction changes
        circlePhase: k.rand(0, Math.PI * 2),
        circleRadius: k.rand(20, 50),
        displayName: randomName,
        jerseyNumber: Math.floor(k.rand(1, 99))
      }
    ]);
    
    // Draw player details (name + jersey number)
    redPlayer.onDraw(() => {
      // Name above head
      k.drawText({
        text: redPlayer.displayName,
        pos: k.vec2(0, -16),
        size: 5,
        anchor: "center",
        color: k.rgb(255, 220, 220)
      });
      // Jersey number on back
      k.drawText({
        text: String(redPlayer.jerseyNumber),
        pos: k.vec2(0, 0),
        size: 6,
        anchor: "center",
        color: k.rgb(255, 255, 255)
      });
    });
    
    redPlayers.push(redPlayer);
  }

  // Chaotic Defense AI update
  function updateRedPlayer(rp: GameObj<any>, dt: number): void {
    rp.dirChangeTimer += dt;
    
    // Change direction randomly (Comedy Defense)
    if (rp.dirChangeTimer >= rp.dirChangeInterval) {
      rp.dirChangeTimer = 0;
      rp.dirChangeInterval = k.rand(0.3, 0.8);
      
      // Choose random new direction (circular loop pattern sometimes)
      if (k.rand() < 0.4) {
        // Circular loop movement
        rp.circlePhase += k.rand(0.5, 1.5);
        rp.dir = k.vec2(
          Math.cos(rp.circlePhase),
          Math.sin(rp.circlePhase)
        );
      } else {
        // Pure random direction
        rp.dir = k.vec2(k.rand(-1, 1), k.rand(-1, 1)).unit();
      }
    }
    
    // Move
    rp.move(rp.dir.scale(rp.speed));
    
    // Bounce off walls
    if (rp.pos.x < TILE_SIZE || rp.pos.x > map.width - TILE_SIZE) {
      rp.dir.x *= -1;
      rp.pos.x = k.clamp(rp.pos.x, TILE_SIZE, map.width - TILE_SIZE);
    }
    if (rp.pos.y < TILE_SIZE || rp.pos.y > map.height - TILE_SIZE) {
      rp.dir.y *= -1;
      rp.pos.y = k.clamp(rp.pos.y, TILE_SIZE, map.height - TILE_SIZE);
    }
    
    // Red Players bump into each other and change direction
    redPlayers.forEach(other => {
      if (other === rp || !other.exists()) return;
      const dist = rp.pos.dist(other.pos);
      if (dist < 16) {
        // Bump! Change directions chaotically
        rp.dir = rp.pos.sub(other.pos).unit();
        other.dir = other.pos.sub(rp.pos).unit();
      }
    });
  }

  // Stadium title text
  k.add([
    k.text("⚽ SÂN VẬN ĐỘNG ĐỎ ⚽", { size: 7 }),
    k.pos(map.width / 2, TILE_SIZE * 1.3),
    k.anchor("center"),
    k.color(255, 255, 200),
    k.z(100)
  ]);

  // Create UI
  const ui = createGameUI(k);

  k.onUpdate(() => {
    if (gameState.isPaused() || gameState.isDialogueActive()) return;

    const dt = k.dt();
    maskManager.update(dt);

    // Update camera to follow player
    camera.follow(player, k.mousePos());

    // ===== UPDATE RED PLAYERS (Chaotic Defense AI) =====
    redPlayers.forEach(rp => {
      if (rp.exists() && !gameState.isTimeFrozen()) {
        updateRedPlayer(rp, dt);
      } else if (gameState.isTimeFrozen()) {
        rp.color = k.rgb(150, 80, 80); // Dimmed when frozen
      } else {
        rp.color = k.rgb(220, 50, 50);
      }
    });

    // Update UI with objective pointer
    updateGameUI(k, ui, maskManager, k.vec2(elevatorPos.x, elevatorPos.y), camera);
  });

  // Red Player collision - damage and knockback
  player.onCollide("red-player", (redPlayer: GameObj<any>) => {
    if (gameState.isPlayerEthereal()) return;
    if (gameState.isInvincible()) return;
    if (gameState.isPlayerShielding()) return;

    gameState.damagePlayer(1);
    camera.shake(8, 0.3);

    // Velocity-based knockback (respects walls via move())
    const knockDir = player.pos.sub(redPlayer.pos).unit();
    player.knockbackVel = knockDir.scale(800); // High initial velocity, decays in onUpdate

    player.color = k.rgb(255, 100, 100);
    k.wait(0.15, () => {
      if (gameState.isPlayerShielding()) {
        player.color = k.rgb(255, 215, 0);
      } else {
        player.color = k.rgb(79, 195, 247);
      }
    });

    if (gameState.isPlayerDead()) {
      k.go("gameover");
    }

    gameState.setInvincible(true);
    k.wait(1, () => {
      gameState.setInvincible(false);
    });
  });

  // Elevator collision - level complete
  player.onCollide("elevator", () => {
    gameState.addCollectedMask(MASKS.shield);
    
    showDialogue(k, LEVEL_DIALOGUES[4].outro!, () => {
      k.go("gate_opening");
    });
  });

  // Show intro dialogue
  showDialogue(k, LEVEL_DIALOGUES[4].intro, () => {
    gameState.setDialogueActive(false);
  });
}

// Build level tiles from ASCII map
function buildLevel(k: KaboomCtx, map: typeof LEVEL_4_MAP): void {
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
      speed: 90,
      dir: k.vec2(0, 0),
      knockbackVel: k.vec2(0, 0) // Velocity-based knockback
    }
  ]);

  player.onUpdate(() => {
    if (gameState.isPaused() || gameState.isDialogueActive()) return;

    const dt = k.dt();

    // ============= APPLY KNOCKBACK VELOCITY =============
    // Use move() which respects physics/walls instead of direct pos modification
    if (player.knockbackVel.len() > 1) {
      player.move(player.knockbackVel);
      // Decay knockback velocity (friction)
      player.knockbackVel = player.knockbackVel.lerp(k.vec2(0, 0), dt * 10);
    } else {
      player.knockbackVel = k.vec2(0, 0);
    }

    const dir = k.vec2(0, 0);
    if (k.isKeyDown("left") || k.isKeyDown("a")) dir.x -= 1;
    if (k.isKeyDown("right") || k.isKeyDown("d")) dir.x += 1;
    if (k.isKeyDown("up") || k.isKeyDown("w")) dir.y -= 1;
    if (k.isKeyDown("down") || k.isKeyDown("s")) dir.y += 1;

    if (dir.len() > 0) {
      player.dir = dir.unit();
      player.move(player.dir.scale(player.speed));
    }

    // ============= BOUNDARY CLAMP (Safety net) =============
    const minX = TILE_SIZE * 1.5;
    const minY = TILE_SIZE * 1.5;
    const maxX = LEVEL_4_MAP.width - TILE_SIZE * 1.5;
    const maxY = LEVEL_4_MAP.height - TILE_SIZE * 1.5;
    player.pos.x = k.clamp(player.pos.x, minX, maxX);
    player.pos.y = k.clamp(player.pos.y, minY, maxY);

    if (gameState.isPlayerShielding()) {
      player.color = k.rgb(255, 215, 0);
    } else {
      player.color = k.rgb(79, 195, 247);
    }
  });

  k.onKeyPress("space", () => {
    if (gameState.isPaused() || gameState.isDialogueActive()) return;
    maskManager.activateAbility(player);
  });

  return player;
}
