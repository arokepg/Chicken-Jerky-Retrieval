// Level 5: The CEO's Office - BOSS FIGHT (60s Survival)
// Complete recode with proper State Machine
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

// ============= BOSS FIGHT CONSTANTS =============
const FIGHT_DURATION = 60; // 60 seconds to win
const BOSS_MOVE_INTERVAL = 3; // Boss floats to new position every 3s
const MONEYBAG_SPEED = 150;
const SHOCKWAVE_SPEED = 120;

// Boss State Machine
type BossState = "intro" | "phase1" | "phase2" | "win";

export function level5Scene(k: KaboomCtx): void {
  const map = LEVEL_5_MAP;
  
  // Setup pause system
  setupPauseSystem(k);
  
  // Initialize camera
  const camera = new CameraController(k, {
    zoom: 2.2,
    lerpSpeed: 0.1,
    lookAheadDistance: 20
  });
  camera.setBounds(0, 0, map.width, map.height);

  // Initialize mask manager
  const maskManager = new MaskManager(k);
  
  // Prepare player state
  gameState.prepareForLevel(5);

  // Build level
  buildLevel(k, map);

  // Get spawn positions
  const playerSpawn = getPlayerSpawn(map);
  const bossSpawnPos = { x: map.width / 2, y: TILE_SIZE * 5 };

  // Create player
  const player = createPlayer(k, playerSpawn.x, playerSpawn.y, maskManager);
  camera.snapTo(k.vec2(playerSpawn.x, playerSpawn.y));

  // ============= BOSS STATE MACHINE =============
  let bossState: BossState = "intro";
  let timeRemaining = FIGHT_DURATION;
  let bossMoveTimer = 0;
  let phase1Timer = 0;
  let phase2Timer = 0;
  let shockwaveTimer = 0;

  // Attack intervals
  const PHASE1_ATTACK_RATE = 1.5; // Money bags every 1.5s
  const PHASE2_ATTACK_RATE = 1.2; // Money bags every 1.2s
  const SHOCKWAVE_RATE = 4; // Shockwave every 4s

  // Create Boss
  const boss = k.add([
    k.sprite("boss"),
    k.pos(bossSpawnPos.x, bossSpawnPos.y),
    k.anchor("center"),
    k.area({ scale: k.vec2(0.8, 0.8) }),
    k.color(200, 50, 100),
    k.opacity(1),
    k.z(9),
    "boss"
  ]);

  // ============= UI SETUP =============
  const ui = createGameUI(k);
  
  // Timer bar (visual HP bar showing time remaining)
  const TIMER_BAR_WIDTH = 240;
  const TIMER_BAR_HEIGHT = 16;
  
  const timerBackground = k.add([
    k.rect(TIMER_BAR_WIDTH + 4, TIMER_BAR_HEIGHT + 4),
    k.pos(k.width() / 2, 25),
    k.anchor("center"),
    k.color(30, 30, 30),
    k.outline(2, k.rgb(80, 80, 80)),
    k.opacity(1),
    k.z(300),
    k.fixed()
  ]);

  const timerBar = k.add([
    k.rect(TIMER_BAR_WIDTH, TIMER_BAR_HEIGHT),
    k.pos(k.width() / 2 - TIMER_BAR_WIDTH / 2, 25 - TIMER_BAR_HEIGHT / 2),
    k.color(255, 215, 0),
    k.opacity(1),
    k.z(301),
    k.fixed()
  ]);

  const timerText = k.add([
    k.text(`Survive: ${FIGHT_DURATION}s`, { size: 11 }),
    k.pos(k.width() / 2, 25),
    k.anchor("center"),
    k.color(255, 255, 255),
    k.opacity(1),
    k.z(302),
    k.fixed()
  ]);

  const phaseText = k.add([
    k.text("GET READY!", { size: 9 }),
    k.pos(k.width() / 2, 45),
    k.anchor("center"),
    k.color(255, 200, 100),
    k.z(302),
    k.fixed()
  ]);

  // Mask UI
  const maskUIContainer = k.add([
    k.pos(k.width() / 2, k.height() - 50),
    k.anchor("center"),
    k.z(400),
    k.fixed()
  ]);

  const maskIcons: GameObj<any>[] = [];
  const MASK_SPACING = 50;
  const masks = [
    { id: "silence", key: "1", sprite: "mask-silence" },
    { id: "ghost", key: "2", sprite: "mask-ghost" },
    { id: "frozen", key: "3", sprite: "mask-frozen" },
    { id: "shield", key: "4", sprite: "mask-shield" }
  ];

  masks.forEach((mask, i) => {
    const xPos = (i - 1.5) * MASK_SPACING;
    
    maskUIContainer.add([
      k.text(`[${mask.key}]`, { size: 10 }),
      k.pos(xPos, -25),
      k.anchor("center"),
      k.color(200, 200, 200),
      k.z(401)
    ]);

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

  // Red background for Phase 2
  const redBackground = k.add([
    k.rect(k.width(), k.height()),
    k.pos(0, 0),
    k.color(150, 0, 0),
    k.opacity(0),
    k.z(0),
    k.fixed()
  ]);

  // ============= BOSS MOVEMENT (Tween to random spot) =============
  function moveBossToRandomSpot(): void {
    const newX = k.rand(TILE_SIZE * 4, map.width - TILE_SIZE * 4);
    const newY = k.rand(TILE_SIZE * 3, map.height / 2);
    
    k.tween(
      boss.pos,
      k.vec2(newX, newY),
      0.8,
      (val) => { boss.pos = val; },
      k.easings.easeOutQuad
    );
  }

  // ============= ATTACK 1: MONEY BAGS =============
  function throwMoneyBag(): void {
    if (!boss.exists() || !player.exists()) return;
    
    // Calculate direction towards player
    const dir = player.pos.sub(boss.pos).unit();
    
    // Create money bag projectile
    const moneyBag = k.add([
      k.rect(14, 12, { radius: 3 }),
      k.pos(boss.pos.x, boss.pos.y + 15),
      k.anchor("center"),
      k.color(80, 180, 80), // Green money
      k.outline(2, k.rgb(50, 120, 50)),
      k.area({ scale: k.vec2(0.7, 0.7) }),
      k.offscreen({ destroy: true, distance: 100 }), // Auto-cleanup
      k.z(8),
      "boss_projectile",
      {
        dir: dir,
        speed: MONEYBAG_SPEED
      }
    ]);

    // Dollar sign on bag
    moneyBag.onDraw(() => {
      k.drawText({
        text: "$",
        pos: k.vec2(0, 0),
        size: 8,
        anchor: "center",
        color: k.rgb(255, 255, 255)
      });
    });

    // IMPORTANT: Use onUpdate to ensure projectile moves
    moneyBag.onUpdate(() => {
      moneyBag.move(moneyBag.dir.scale(moneyBag.speed));
    });
  }

  // ============= ATTACK 2: SHOCKWAVE (Ring of projectiles) =============
  function createShockwave(): void {
    if (!boss.exists()) return;
    
    camera.shake(10, 0.3);
    
    // Visual stomp effect
    const stomp = k.add([
      k.circle(20),
      k.pos(boss.pos),
      k.anchor("center"),
      k.color(255, 100, 100),
      k.opacity(0.8),
      k.z(7)
    ]);
    
    k.tween(20, 80, 0.3, (r) => {
      stomp.radius = r;
      stomp.opacity = 0.8 - (r / 100);
    }, k.easings.easeOutQuad).onEnd(() => {
      stomp.destroy();
    });

    // Create ring of projectiles (12 directions)
    const projectileCount = 12;
    for (let i = 0; i < projectileCount; i++) {
      const angle = (i / projectileCount) * Math.PI * 2;
      const dir = k.vec2(Math.cos(angle), Math.sin(angle));
      
      const shockProj = k.add([
        k.circle(8),
        k.pos(boss.pos.x, boss.pos.y),
        k.anchor("center"),
        k.color(255, 80, 80),
        k.opacity(0.9),
        k.area({ scale: k.vec2(0.6, 0.6) }),
        k.offscreen({ destroy: true, distance: 100 }),
        k.z(8),
        "boss_projectile",
        {
          dir: dir,
          speed: SHOCKWAVE_SPEED
        }
      ]);

      // Use onUpdate for reliable movement
      shockProj.onUpdate(() => {
        shockProj.move(shockProj.dir.scale(shockProj.speed));
      });
    }
  }

  // ============= WIN CONDITION =============
  function triggerWin(): void {
    bossState = "win";
    
    // Destroy all projectiles
    k.destroyAll("boss_projectile");
    
    // Boss tired animation
    boss.color = k.rgb(100, 100, 100);
    boss.opacity = 0.6;
    
    // Add tired text above boss
    k.add([
      k.text("*pant* *pant*", { size: 8 }),
      k.pos(boss.pos.x, boss.pos.y - 30),
      k.anchor("center"),
      k.color(200, 200, 200),
      k.z(100)
    ]);
    
    camera.shake(15, 0.5);
    
    // Hide combat UI
    timerBackground.opacity = 0;
    timerBar.opacity = 0;
    timerText.opacity = 0;
    phaseText.text = "YOU WIN!";
    phaseText.color = k.rgb(100, 255, 100);
    redBackground.opacity = 0;

    // Transition to outro after short delay
    k.wait(2, () => {
      k.go("outro");
    });
  }

  // ============= MAIN UPDATE LOOP =============
  k.onUpdate(() => {
    if (gameState.isPaused() || gameState.isDialogueActive()) return;
    if (bossState === "win") return;

    const dt = k.dt();
    maskManager.update(dt);
    camera.follow(player, k.mousePos());

    // Skip combat during intro
    if (bossState === "intro") {
      updateGameUI(k, ui, maskManager, boss.pos, camera);
      return;
    }

    // ============= TIMER COUNTDOWN =============
    timeRemaining -= dt;
    timerText.text = `Survive: ${Math.ceil(timeRemaining)}s`;
    timerBar.width = TIMER_BAR_WIDTH * (timeRemaining / FIGHT_DURATION);

    // Timer color
    if (timeRemaining < 10) {
      timerBar.color = k.rgb(255, 50, 50);
    } else if (timeRemaining < 30) {
      timerBar.color = k.rgb(255, 150, 50);
    } else {
      timerBar.color = k.rgb(255, 215, 0);
    }

    // ============= WIN CHECK =============
    if (timeRemaining <= 0) {
      triggerWin();
      return;
    }

    // ============= BOSS MOVEMENT =============
    bossMoveTimer += dt;
    if (bossMoveTimer >= BOSS_MOVE_INTERVAL) {
      bossMoveTimer = 0;
      moveBossToRandomSpot();
    }

    // ============= PHASE MANAGEMENT =============
    const timeElapsed = FIGHT_DURATION - timeRemaining;
    
    if (timeElapsed < 30) {
      // PHASE 1: Money Bags (0-30s)
      bossState = "phase1";
      phaseText.text = "Phase 1: Money Shower";
      phaseText.color = k.rgb(100, 200, 100);
      boss.color = k.rgb(200, 50, 100);
      redBackground.opacity = 0;
      
      phase1Timer += dt;
      if (phase1Timer >= PHASE1_ATTACK_RATE && !gameState.isTimeFrozen()) {
        phase1Timer = 0;
        throwMoneyBag();
      }
    } else {
      // PHASE 2: Money Bags + Shockwaves (30-60s)
      bossState = "phase2";
      phaseText.text = "Phase 2: FURY!";
      phaseText.color = k.rgb(255, 100, 100);
      boss.color = k.rgb(50, 50, 50); // Dark boss
      redBackground.opacity = 0.15 + Math.sin(k.time() * 3) * 0.05;
      
      // Money bags (faster)
      phase2Timer += dt;
      if (phase2Timer >= PHASE2_ATTACK_RATE && !gameState.isTimeFrozen()) {
        phase2Timer = 0;
        throwMoneyBag();
      }
      
      // Shockwaves
      shockwaveTimer += dt;
      if (shockwaveTimer >= SHOCKWAVE_RATE && !gameState.isTimeFrozen()) {
        shockwaveTimer = 0;
        createShockwave();
      }
    }

    // Update mask UI
    maskIcons.forEach(icon => {
      const playerState = gameState.getPlayerState();
      if (playerState.currentMask && playerState.currentMask.id === icon.maskId) {
        icon.outline.width = 3;
      } else {
        icon.outline.width = 0;
      }
    });

    updateGameUI(k, ui, maskManager, boss.pos, camera);
  });

  // ============= COLLISION HANDLERS =============
  
  // Player hit by boss projectile
  player.onCollide("boss_projectile", (projectile: GameObj<any>) => {
    // Shield deflects
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
    
    player.color = k.rgb(255, 100, 100);
    k.wait(0.15, () => { 
      if (player.exists()) player.color = k.rgb(79, 195, 247); 
    });

    if (gameState.isPlayerDead()) {
      k.go("gameover");
      return;
    }
    
    // Brief invincibility
    gameState.setInvincible(true);
    k.wait(0.8, () => { gameState.setInvincible(false); });
  });

  // Player touches boss
  player.onCollide("boss", () => {
    if (gameState.isPlayerEthereal()) return;
    if (gameState.isInvincible()) return;
    if (bossState === "win") return;

    gameState.damagePlayer(1);
    camera.shake(10, 0.3);
    
    // Knockback
    const knockDir = player.pos.sub(boss.pos).unit();
    player.pos = player.pos.add(knockDir.scale(40));
    player.pos.x = k.clamp(player.pos.x, TILE_SIZE * 1.5, map.width - TILE_SIZE * 1.5);
    player.pos.y = k.clamp(player.pos.y, TILE_SIZE * 1.5, map.height - TILE_SIZE * 1.5);

    gameState.setInvincible(true);
    k.wait(1, () => { gameState.setInvincible(false); });

    if (gameState.isPlayerDead()) {
      k.go("gameover");
    }
  });

  // ============= START FIGHT (After intro dialogue) =============
  showDialogue(k, LEVEL_DIALOGUES[5].intro, () => {
    gameState.setDialogueActive(false);
    bossState = "phase1";
    phaseText.text = "Phase 1: Money Shower";
  });
}

// ============= BUILD LEVEL =============
function buildLevel(k: KaboomCtx, map: typeof LEVEL_5_MAP): void {
  const mapWidth = map.tiles[0].length * TILE_SIZE;
  const mapHeight = map.tiles.length * TILE_SIZE;

  // Dark floor
  k.add([
    k.rect(mapWidth, mapHeight),
    k.pos(0, 0),
    k.color(40, 30, 50),
    k.z(-2)
  ]);

  // Red carpet
  const carpetWidth = TILE_SIZE * 8;
  k.add([
    k.rect(carpetWidth, mapHeight - TILE_SIZE * 4),
    k.pos(mapWidth / 2 - carpetWidth / 2, TILE_SIZE * 2),
    k.color(120, 30, 40),
    k.z(-1)
  ]);

  // Carpet border
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

      // Gold pillars
      if (char === 'O') {
        k.add([
          k.circle(18),
          k.pos(posX, posY),
          k.anchor("center"),
          k.color(180, 140, 60),
          k.z(3)
        ]);
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

  // Money piles in corners
  const moneyPositions = [
    { x: TILE_SIZE * 3, y: TILE_SIZE * 3 },
    { x: mapWidth - TILE_SIZE * 3, y: TILE_SIZE * 3 },
    { x: TILE_SIZE * 3, y: mapHeight - TILE_SIZE * 3 },
    { x: mapWidth - TILE_SIZE * 3, y: mapHeight - TILE_SIZE * 3 }
  ];

  moneyPositions.forEach(pos => {
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

  // Boss throne
  k.add([
    k.rect(TILE_SIZE * 6, TILE_SIZE * 2),
    k.pos(mapWidth / 2, TILE_SIZE * 3),
    k.anchor("center"),
    k.color(60, 40, 70),
    k.outline(3, k.rgb(180, 140, 60)),
    k.z(1)
  ]);
  
  // Boundaries
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
      speed: 100,
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
    const margin = TILE_SIZE * 1.5;
    player.pos.x = k.clamp(player.pos.x, margin, LEVEL_5_MAP.width - margin);
    player.pos.y = k.clamp(player.pos.y, margin, LEVEL_5_MAP.height - margin);

    // Visual states
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

  // Mask switching
  k.onKeyPress("1", () => maskManager.setMask(0));
  k.onKeyPress("2", () => maskManager.setMask(1));
  k.onKeyPress("3", () => maskManager.setMask(2));
  k.onKeyPress("4", () => maskManager.setMask(3));
  k.onKeyPress("tab", () => maskManager.cycleMask());

  return player;
}
