// Level 5: The CEO's Office - SURVIVAL BOSS FIGHT (60s Endurance)
import { KaboomCtx, GameObj } from "kaboom";
import { MaskManager } from "../mechanics/MaskManager.ts";
import { setupPauseSystem } from "../mechanics/PauseSystem.ts";
import { gameState } from "../state.ts";
import { LEVEL_DIALOGUES } from "../constants.ts";
import { showDialogue } from "./dialogue.ts";
import { CameraController } from "../camera.ts";
import { createGameUI, updateGameUI } from "../ui.ts";
import { LEVEL_5_MAP, getPlayerSpawn } from "../maps.ts";
import { TILE_SIZE } from "../loader.ts";

// Boss Fight Constants - SURVIVAL MODE
const FIGHT_DURATION = 60; // 60 seconds to win
const PHASE_1_END = 20; // 0-20s: Talk No Jutsu
const PHASE_2_END = 40; // 20-40s: Document Storm

export function level5Scene(k: KaboomCtx): void {
  const map = LEVEL_5_MAP;
  
  // Setup pause system (ESC to pause)
  setupPauseSystem(k);
  
  // Initialize camera with zoom (adjusted for larger map)
  const camera = new CameraController(k, {
    zoom: 2.2, // Slightly zoomed out to see more of the arena
    lerpSpeed: 0.1,
    lookAheadDistance: 20
  });
  
  camera.setBounds(0, 0, map.width, map.height);

  // Initialize mask manager
  const maskManager = new MaskManager(k);
  
  // Prepare player state for boss level
  gameState.prepareForLevel(5);

  // Build the level from ASCII map
  buildLevel(k, map);

  // Get spawn position from map
  const playerSpawn = getPlayerSpawn(map);
  const bossPos = { x: map.width / 2, y: TILE_SIZE * 5 }; // Top-center of larger map

  // Create player
  const player = createPlayer(k, playerSpawn.x, playerSpawn.y, maskManager);

  // Snap camera to player initially
  camera.snapTo(k.vec2(playerSpawn.x, playerSpawn.y));

  // Create boss (now just visual, no HP)
  const boss = k.add([
    k.sprite("boss"),
    k.pos(bossPos.x, bossPos.y),
    k.anchor("center"),
    k.area(),
    k.color(200, 50, 100),
    k.z(9),
    "boss",
    {
      currentPhase: 1
    }
  ]);

  // Arrays for projectiles and enemies
  const projectiles: GameObj<any>[] = [];
  const textBubbles: GameObj<any>[] = [];
  const documents: GameObj<any>[] = [];
  const whiteCows: GameObj<any>[] = [];

  // Survival timer
  let timeRemaining = FIGHT_DURATION;
  let bossDefeated = false;

  // Create UI
  const ui = createGameUI(k);

  // ============= COUNTDOWN TIMER (REPLACES HP BAR) =============
  const TIMER_BAR_WIDTH = 240;
  const TIMER_BAR_HEIGHT = 16;
  
  const timerBackground = k.add([
    k.rect(TIMER_BAR_WIDTH + 4, TIMER_BAR_HEIGHT + 4),
    k.pos(k.width() / 2, 25),
    k.anchor("center"),
    k.color(30, 30, 30),
    k.outline(2, k.rgb(80, 80, 80)),
    k.z(300),
    k.fixed()
  ]);

  const timerBar = k.add([
    k.rect(TIMER_BAR_WIDTH, TIMER_BAR_HEIGHT),
    k.pos(k.width() / 2 - TIMER_BAR_WIDTH / 2, 25 - TIMER_BAR_HEIGHT / 2),
    k.color(255, 215, 0),
    k.z(301),
    k.fixed()
  ]);

  const timerText = k.add([
    k.text(`Time until Salary: 60s`, { size: 11 }),
    k.pos(k.width() / 2, 25),
    k.anchor("center"),
    k.color(255, 255, 255),
    k.z(302),
    k.fixed()
  ]);

  const phaseText = k.add([
    k.text("Phase 1: Talk No Jutsu", { size: 9 }),
    k.pos(k.width() / 2, 45),
    k.anchor("center"),
    k.color(255, 100, 100),
    k.z(302),
    k.fixed()
  ]);

  // Enhanced Mask UI - bottom center with keybinds
  const maskUIContainer = k.add([
    k.pos(k.width() / 2, k.height() - 50),
    k.anchor("center"),
    k.z(400),
    k.fixed()
  ]);

  const maskIcons: GameObj<any>[] = [];
  const maskKeybinds: GameObj<any>[] = [];
  const MASK_SPACING = 50;
  const masks = [
    { id: "silence", key: "1", sprite: "mask-silence" },
    { id: "ghost", key: "2", sprite: "mask-ghost" },
    { id: "frozen", key: "3", sprite: "mask-frozen" },
    { id: "shield", key: "4", sprite: "mask-shield" }
  ];

  masks.forEach((mask, i) => {
    const xPos = (i - 1.5) * MASK_SPACING;
    
    // Keybind label
    const keybind = maskUIContainer.add([
      k.text(`[${mask.key}]`, { size: 10 }),
      k.pos(xPos, -25),
      k.anchor("center"),
      k.color(200, 200, 200),
      k.z(401)
    ]);
    maskKeybinds.push(keybind);

    // Mask icon
    const icon = maskUIContainer.add([
      k.sprite(mask.sprite),
      k.pos(xPos, 0),
      k.anchor("center"),
      k.scale(2),
      k.outline(0, k.rgb(255, 215, 0)),
      k.z(401),
      { maskId: mask.id }
    ]);
    maskIcons.push(icon);
  });

  // ============= PHASE-BASED ATTACKS =============
  
  // Phase 1 (0-20s): Talk No Jutsu - Text bubbles
  let phase1Timer = 0;
  const PHASE1_FIRE_RATE = 1.2;
  const MEME_TEXTS = ["Hello Vu!", "I know everything", "Don't deny it", "No escape!"];
  
  function fireTextBubble(): void {
    const memeText = MEME_TEXTS[Math.floor(Math.random() * MEME_TEXTS.length)];
    
    // Target player position with some prediction
    const targetPos = player.pos.add(player.dir.scale(30));
    const dir = targetPos.sub(boss.pos).unit();
    const dist = targetPos.dist(boss.pos);
    
    // Telegraph line (0.3s warning) - draw as thin rectangle
    const angle = Math.atan2(dir.y, dir.x);
    const telegraphLine = k.add([
      k.rect(dist, 2),
      k.pos(boss.pos.x, boss.pos.y),
      k.anchor("left"),
      k.rotate(angle * (180 / Math.PI)),
      k.color(255, 200, 200),
      k.opacity(0.6),
      k.z(7)
    ]);
    
    k.wait(0.3, () => {
      telegraphLine.destroy();
      
      const textBubble = k.add([
        k.text(memeText, { size: 8 }),
        k.pos(boss.pos.x, boss.pos.y + 10),
        k.anchor("center"),
        k.color(255, 100, 100),
        k.area({ shape: new k.Rect(k.vec2(0), 20, 12) }),
        k.z(8),
        "boss-projectile",
        {
          dir: dir,
          speed: 120
        }
      ]);
      
      textBubbles.push(textBubble);
    });
  }

  // Phase 2 (20-40s): Document Storm - Papers fly in waves
  let phase2Timer = 0;
  const PHASE2_WAVE_RATE = 2.5;
  
  function fireDocumentWave(): void {
    const numDocs = 8;
    const side = Math.floor(Math.random() * 4); // 0=top, 1=right, 2=bottom, 3=left
    
    for (let i = 0; i < numDocs; i++) {
      let x = 0, y = 0, dirX = 0, dirY = 0;
      
      switch (side) {
        case 0: // Top
          x = (i / numDocs) * map.width;
          y = TILE_SIZE;
          dirX = k.rand(-0.3, 0.3);
          dirY = 1;
          break;
        case 1: // Right
          x = map.width - TILE_SIZE;
          y = (i / numDocs) * map.height;
          dirX = -1;
          dirY = k.rand(-0.3, 0.3);
          break;
        case 2: // Bottom
          x = (i / numDocs) * map.width;
          y = map.height - TILE_SIZE;
          dirX = k.rand(-0.3, 0.3);
          dirY = -1;
          break;
        case 3: // Left
          x = TILE_SIZE;
          y = (i / numDocs) * map.height;
          dirX = 1;
          dirY = k.rand(-0.3, 0.3);
          break;
      }
      
      // Telegraph shadow (0.5s warning)
      const shadowPos = k.vec2(x, y);
      const shadow = k.add([
        k.rect(12, 16),
        k.pos(shadowPos),
        k.anchor("center"),
        k.color(100, 100, 100),
        k.opacity(0.3),
        k.z(2)
      ]);
      
      k.wait(0.5, () => {
        shadow.destroy();
        
        const document = k.add([
          k.rect(10, 14),
          k.pos(x, y),
          k.anchor("center"),
          k.color(255, 255, 255),
          k.area(),
          k.z(8),
          "boss-projectile",
          {
            dir: k.vec2(dirX, dirY).unit(),
            speed: 100
          }
        ]);
        
        documents.push(document);
      });
    }
  }

  // Phase 3 (40-60s): The Blazer - Background turns red, White Cows charge
  let phase3Timer = 0;
  const PHASE3_COW_RATE = 2;
  const redBackground = k.add([
    k.rect(k.width(), k.height()),
    k.pos(0, 0),
    k.color(150, 0, 0),
    k.opacity(0),
    k.z(0),
    k.fixed()
  ]);
  
  function spawnWhiteCow(): void {
    // Random side
    const side = Math.floor(Math.random() * 4);
    let x = 0, y = 0, targetX = 0, targetY = 0;
    
    switch (side) {
      case 0: // Top
        x = k.rand(TILE_SIZE * 2, map.width - TILE_SIZE * 2);
        y = -TILE_SIZE;
        targetX = x + k.rand(-100, 100);
        targetY = map.height + TILE_SIZE;
        break;
      case 1: // Right
        x = map.width + TILE_SIZE;
        y = k.rand(TILE_SIZE * 2, map.height - TILE_SIZE * 2);
        targetX = -TILE_SIZE;
        targetY = y + k.rand(-100, 100);
        break;
      case 2: // Bottom
        x = k.rand(TILE_SIZE * 2, map.width - TILE_SIZE * 2);
        y = map.height + TILE_SIZE;
        targetX = x + k.rand(-100, 100);
        targetY = -TILE_SIZE;
        break;
      case 3: // Left
        x = -TILE_SIZE;
        y = k.rand(TILE_SIZE * 2, map.height - TILE_SIZE * 2);
        targetX = map.width + TILE_SIZE;
        targetY = y + k.rand(-100, 100);
        break;
    }
    
    const dir = k.vec2(targetX, targetY).sub(k.vec2(x, y)).unit();
    
    const cow = k.add([
      k.circle(10),
      k.pos(x, y),
      k.anchor("center"),
      k.color(255, 255, 255),
      k.area(),
      k.z(8),
      "boss-projectile",
      "white-cow",
      {
        dir: dir,
        speed: 180
      }
    ]);
    
    whiteCows.push(cow);
  }

  // ============= MAIN UPDATE LOOP - SURVIVAL MODE =============
  k.onUpdate(() => {
    if (gameState.isPaused() || gameState.isDialogueActive() || bossDefeated) return;

    const dt = k.dt();
    maskManager.update(dt);

    // Update camera to follow player
    camera.follow(player, k.mousePos());

    // **TIMER COUNTDOWN** - Main win condition
    timeRemaining -= dt;
    
    // Update timer UI
    timerText.text = `Time until Salary: ${Math.ceil(timeRemaining)}s`;
    timerBar.width = TIMER_BAR_WIDTH * (timeRemaining / FIGHT_DURATION);
    
    // Timer color changes with time
    if (timeRemaining < 10) {
      timerBar.color = k.rgb(255, 50, 50);
      timerText.color = k.rgb(255, 100, 100);
    } else if (timeRemaining < 30) {
      timerBar.color = k.rgb(255, 150, 50);
    } else {
      timerBar.color = k.rgb(255, 215, 0);
      timerText.color = k.rgb(255, 255, 255);
    }

    // **PHASE MANAGEMENT** based on time
    const timeElapsed = FIGHT_DURATION - timeRemaining;
    let currentPhase = 1;
    
    if (timeElapsed >= PHASE_2_END) {
      currentPhase = 3;
      phaseText.text = "Phase 3: The Blazer";
      phaseText.color = k.rgb(255, 0, 0);
      redBackground.opacity = 0.25 + Math.sin(k.time() * 3) * 0.05; // Pulsing red
      boss.color = k.rgb(50, 50, 50); // Black suit
    } else if (timeElapsed >= PHASE_1_END) {
      currentPhase = 2;
      phaseText.text = "Phase 2: Document Storm";
      phaseText.color = k.rgb(255, 255, 255);
      redBackground.opacity = 0;
      boss.color = k.rgb(200, 50, 100);
    } else {
      currentPhase = 1;
      phaseText.text = "Phase 1: Talk No Jutsu";
      phaseText.color = k.rgb(255, 100, 100);
      redBackground.opacity = 0;
      boss.color = k.rgb(200, 50, 100);
    }
    
    boss.currentPhase = currentPhase;

    // **PHASE 1 ATTACKS**: Text bubbles
    if (currentPhase === 1 && !gameState.isTimeFrozen()) {
      phase1Timer += dt;
      if (phase1Timer >= PHASE1_FIRE_RATE) {
        phase1Timer = 0;
        fireTextBubble();
      }
    }

    // **PHASE 2 ATTACKS**: Document waves
    if (currentPhase === 2 && !gameState.isTimeFrozen()) {
      phase2Timer += dt;
      if (phase2Timer >= PHASE2_WAVE_RATE) {
        phase2Timer = 0;
        fireDocumentWave();
      }
    }

    // **PHASE 3 ATTACKS**: White cows
    if (currentPhase === 3 && !gameState.isTimeFrozen()) {
      phase3Timer += dt;
      if (phase3Timer >= PHASE3_COW_RATE) {
        phase3Timer = 0;
        spawnWhiteCow();
      }
    }

    // Update all projectiles
    [...textBubbles, ...documents, ...whiteCows, ...projectiles].forEach(proj => {
      if (proj.exists()) {
        proj.move(proj.dir.scale(proj.speed));
        
        // Remove off-screen projectiles
        if (proj.pos.x < -50 || proj.pos.x > map.width + 50 ||
            proj.pos.y < -50 || proj.pos.y > map.height + 50) {
          proj.destroy();
        }
      }
    });

    // Update mask UI highlighting
    maskIcons.forEach(icon => {
      const playerState = gameState.getPlayerState();
      if (playerState.currentMask && playerState.currentMask.id === icon.maskId) {
        icon.outline.width = 3;
        icon.outline.color = k.rgb(255, 215, 0);
      } else {
        icon.outline.width = 0;
      }
    });

    // **WIN CONDITION**: Survived 60 seconds!
    if (timeRemaining <= 0 && !bossDefeated) {
      bossDefeated = true;
      
      // Clear all projectiles
      [...textBubbles, ...documents, ...whiteCows, ...projectiles].forEach(p => p.destroy());
      
      // Boss tired animation
      boss.use(k.opacity(0.6));
      camera.shake(15, 0.5);
      
      // Hide UI
      timerBackground.destroy();
      timerBar.destroy();
      timerText.destroy();
      phaseText.destroy();
      maskUIContainer.destroy();
      redBackground.destroy();
      
      // Go directly to outro scene for the big reveal
      k.wait(1, () => {
        k.go("outro");
      });
    }

    // Update UI (health and cooldowns)
    updateGameUI(k, ui, maskManager, boss.pos, camera);
  });

  // ============= COLLISION HANDLERS - SURVIVAL MODE =============
  
  // Player damage from boss projectiles (text bubbles, documents, cows)
  player.onCollide("boss-projectile", (projectile: GameObj<any>) => {
    // Shield can deflect/destroy projectiles
    if (gameState.isPlayerShielding()) {
      projectile.destroy();
      camera.shake(5, 0.1);
      return;
    }

    if (gameState.isPlayerEthereal()) return;
    if (gameState.isInvincible()) return;

    projectile.destroy();
    gameState.damagePlayer(1);
    camera.shake(10, 0.3);
    
    // Visual feedback
    player.color = k.rgb(255, 100, 100);
    k.wait(0.15, () => { 
      if (player.exists()) player.color = k.rgb(79, 195, 247); 
    });

    if (gameState.isPlayerDead()) {
      k.go("gameover");
    }
    
    // Brief invincibility
    gameState.setInvincible(true);
    k.wait(0.6, () => { gameState.setInvincible(false); });
  });

  // Boss collision (touching boss damages player)
  player.onCollide("boss", () => {
    if (gameState.isPlayerEthereal()) return;
    if (gameState.isInvincible()) return;

    gameState.damagePlayer(1);
    camera.shake(10, 0.3);
    
    // Knockback away from boss (with boundary clamping)
    const knockDir = player.pos.sub(boss.pos).unit();
    const newX = player.pos.x + knockDir.x * 50;
    const newY = player.pos.y + knockDir.y * 50;
    player.pos.x = k.clamp(newX, TILE_SIZE * 1.5, map.width - TILE_SIZE * 1.5);
    player.pos.y = k.clamp(newY, TILE_SIZE * 1.5, map.height - TILE_SIZE * 1.5);

    gameState.setInvincible(true);
    k.wait(1, () => { gameState.setInvincible(false); });

    if (gameState.isPlayerDead()) {
      k.go("gameover");
    }
  });

  // Show intro dialogue
  showDialogue(k, LEVEL_DIALOGUES[5].intro, () => {
    gameState.setDialogueActive(false);
  });
}

// Build level tiles from ASCII map
function buildLevel(k: KaboomCtx, map: typeof LEVEL_5_MAP): void {
  const mapWidth = map.tiles[0].length * TILE_SIZE;
  const mapHeight = map.tiles.length * TILE_SIZE;

  // ============= DECORATIVE BACKGROUND =============
  // Dark luxurious floor base
  k.add([
    k.rect(mapWidth, mapHeight),
    k.pos(0, 0),
    k.color(40, 30, 50),
    k.z(-2)
  ]);

  // Red carpet path (center of room, from player to boss)
  const carpetWidth = TILE_SIZE * 8;
  k.add([
    k.rect(carpetWidth, mapHeight - TILE_SIZE * 4),
    k.pos(mapWidth / 2 - carpetWidth / 2, TILE_SIZE * 2),
    k.color(120, 30, 40),
    k.z(-1)
  ]);

  // Carpet border (gold trim)
  k.add([
    k.rect(carpetWidth + 8, mapHeight - TILE_SIZE * 4 + 8),
    k.pos(mapWidth / 2 - carpetWidth / 2 - 4, TILE_SIZE * 2 - 4),
    k.color(180, 140, 60),
    k.opacity(0),
    k.outline(4, k.rgb(180, 140, 60)),
    k.z(-1)
  ]);

  // Build tiles
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

      // Gold pillars (O markers)
      if (char === 'O') {
        // Pillar base
        k.add([
          k.circle(18),
          k.pos(posX, posY),
          k.anchor("center"),
          k.color(180, 140, 60),
          k.z(3)
        ]);
        // Pillar top (shiny)
        k.add([
          k.circle(12),
          k.pos(posX, posY),
          k.anchor("center"),
          k.color(220, 180, 80),
          k.z(4)
        ]);
      }
    }
  }

  // ============= MONEY PILES (Corners) =============
  const moneyPositions = [
    { x: TILE_SIZE * 3, y: TILE_SIZE * 3 },
    { x: mapWidth - TILE_SIZE * 3, y: TILE_SIZE * 3 },
    { x: TILE_SIZE * 3, y: mapHeight - TILE_SIZE * 3 },
    { x: mapWidth - TILE_SIZE * 3, y: mapHeight - TILE_SIZE * 3 }
  ];

  moneyPositions.forEach(pos => {
    // Money pile (green bills)
    for (let i = 0; i < 5; i++) {
      k.add([
        k.rect(20, 10),
        k.pos(pos.x + k.rand(-15, 15), pos.y + k.rand(-10, 10)),
        k.anchor("center"),
        k.rotate(k.rand(-30, 30)),
        k.color(100, 180, 100),
        k.z(1)
      ]);
    }
    // Gold coins
    for (let i = 0; i < 3; i++) {
      k.add([
        k.circle(6),
        k.pos(pos.x + k.rand(-10, 10), pos.y + k.rand(-10, 10)),
        k.anchor("center"),
        k.color(220, 180, 50),
        k.z(2)
      ]);
    }
  });

  // ============= BOSS THRONE AREA =============
  // Throne platform
  k.add([
    k.rect(TILE_SIZE * 6, TILE_SIZE * 2),
    k.pos(mapWidth / 2, TILE_SIZE * 3),
    k.anchor("center"),
    k.color(60, 40, 70),
    k.outline(3, k.rgb(180, 140, 60)),
    k.z(1)
  ]);
  
  // Add map boundaries
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
      speed: 95,
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

    if (gameState.isPlayerShielding()) {
      player.color = k.rgb(255, 215, 0);
    } else if (gameState.isPlayerEthereal()) {
      player.color = k.rgb(200, 150, 255);
      player.opacity = 0.4;
    } else if (gameState.isPlayerInvisible()) {
      player.opacity = 0.3;
    } else {
      player.color = k.rgb(79, 195, 247);
      player.opacity = 1;
    }
  });

  k.onKeyPress("space", () => {
    if (gameState.isPaused() || gameState.isDialogueActive()) return;
    maskManager.activateAbility(player);
  });

  // Mask switching with number keys
  k.onKeyPress("1", () => maskManager.setMask(0));
  k.onKeyPress("2", () => maskManager.setMask(1));
  k.onKeyPress("3", () => maskManager.setMask(2));
  k.onKeyPress("4", () => maskManager.setMask(3));
  k.onKeyPress("tab", () => maskManager.cycleMask());

  return player;
}
