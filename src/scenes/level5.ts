// Level 5: The CEO's Office - BOSS FIGHT (90s Survival)
// 3-Phase Meme Boss: "Alo Vu" Copypasta -> Jerky Rain -> Foggy Finale
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
const FIGHT_DURATION = 90; // 90 seconds to survive
const PHASE_1_END = 30;    // 0-30s: Alo Vu Copypasta
const PHASE_2_END = 60;    // 30-60s: Jerky Rain
// 60-90s: Foggy Finale (BOTH attacks + fog)

const BOSS_MOVE_INTERVAL = 3;

// Phase 1: Text projectile copypasta lines
const ALO_VU_COPYPASTA = [
  "Alo, em có phải Vũ không?",
  "Ui Vũ ơi… em đừng có chối",
  "Anh có cả ở đây rồi!",
  "Vũ có cần anh đọc cho nghe không?",
  "Vũ ơi… em còn trẻ quá",
  "Hơn con anh có mấy tuổi à",
  "Sao Vũ lại làm thế...",
  "Còn cả tương lai đằng trước...",
];

// Boss State Machine
type BossState = "intro" | "phase1" | "phase2" | "phase3" | "win";

export function level5Scene(k: KaboomCtx): void {
  const map = LEVEL_5_MAP;
  
  setupPauseSystem(k);
  
  const camera = new CameraController(k, {
    zoom: 2.2,
    lerpSpeed: 0.1,
    lookAheadDistance: 20
  });
  camera.setBounds(0, 0, map.width, map.height);

  const maskManager = new MaskManager(k);
  gameState.prepareForLevel(5);
  buildLevel(k, map);

  const playerSpawn = getPlayerSpawn(map);
  const bossSpawnPos = { x: map.width / 2, y: TILE_SIZE * 5 };

  const player = createPlayer(k, playerSpawn.x, playerSpawn.y, maskManager);
  camera.snapTo(k.vec2(playerSpawn.x, playerSpawn.y));

  // ============= STATE MACHINE =============
  let bossState: BossState = "intro";
  let timeRemaining = FIGHT_DURATION;
  let bossMoveTimer = 0;
  
  // Phase timers
  let textTimer = 0;
  let jerkyTimer = 0;
  let currentTextIndex = 0;
  
  const TEXT_FIRE_RATE = 1.8;
  const JERKY_SPAWN_RATE = 0.15; // Very fast for bullet hell

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

  // Red background for intensity
  const redBackground = k.add([
    k.rect(k.width(), k.height()),
    k.pos(0, 0),
    k.color(150, 0, 0),
    k.opacity(0),
    k.z(0),
    k.fixed()
  ]);

  // ============= FOG LAYER (Phase 3) =============
  let fogLayer: GameObj<any> | null = null;
  let fogMoveTimer = 0;
  let fogTargetX = k.width() / 2;
  let fogTargetY = k.height() / 2;

  function createFog(): void {
    if (fogLayer) return;
    
    fogLayer = k.add([
      k.circle(300), // Large cloud covering view
      k.pos(k.width() / 2, k.height() / 2),
      k.anchor("center"),
      k.color(50, 50, 80),
      k.opacity(0.75),
      k.z(99), // Just below UI
      k.fixed(),
      "fog"
    ]);
  }

  function updateFog(): void {
    if (!fogLayer || !fogLayer.exists()) return;
    
    fogMoveTimer += k.dt();
    if (fogMoveTimer >= 1.5) {
      fogMoveTimer = 0;
      fogTargetX = k.rand(100, k.width() - 100);
      fogTargetY = k.rand(100, k.height() - 100);
    }
    
    // Smooth movement
    fogLayer.pos.x = k.lerp(fogLayer.pos.x, fogTargetX, k.dt() * 2);
    fogLayer.pos.y = k.lerp(fogLayer.pos.y, fogTargetY, k.dt() * 2);
    
    // Pulsing opacity
    fogLayer.opacity = 0.6 + Math.sin(k.time() * 2) * 0.15;
  }

  // ============= BOSS MOVEMENT =============
  function moveBossToRandomSpot(): void {
    const newX = k.rand(TILE_SIZE * 4, map.width - TILE_SIZE * 4);
    const newY = k.rand(TILE_SIZE * 3, map.height / 2);
    
    const speed = bossState === "phase3" ? 0.4 : 0.8; // Faster in phase 3
    
    k.tween(
      boss.pos,
      k.vec2(newX, newY),
      speed,
      (val) => { boss.pos = val; },
      k.easings.easeOutQuad
    );
  }

  // ============= ATTACK 1: TEXT PROJECTILES =============
  function fireTextProjectile(): void {
    if (!boss.exists() || !player.exists()) return;
    
    const textStr = ALO_VU_COPYPASTA[currentTextIndex % ALO_VU_COPYPASTA.length];
    currentTextIndex++;
    
    const dir = player.pos.sub(boss.pos).unit();
    
    const textBullet = k.add([
      k.text(textStr, { size: 7 }),
      k.pos(boss.pos.x, boss.pos.y + 20),
      k.anchor("center"),
      k.color(255, 100, 100),
      k.area({ shape: new k.Rect(k.vec2(0), textStr.length * 4, 12) }),
      k.offscreen({ destroy: true, distance: 100 }),
      k.z(8),
      "boss_projectile",
      {
        dir: dir,
        speed: 100
      }
    ]);

    textBullet.onUpdate(() => {
      textBullet.move(textBullet.dir.scale(textBullet.speed));
    });
  }

  // ============= ATTACK 2: JERKY RAIN (Bullet Hell) =============
  function spawnJerkyRain(): void {
    // Spawn from random X at top
    const x = k.rand(TILE_SIZE * 2, map.width - TILE_SIZE * 2);
    const y = -10;
    
    // Slight random angle for variety
    const angle = k.rand(-0.3, 0.3);
    const dir = k.vec2(angle, 1).unit();
    
    const jerky = k.add([
      k.rect(10, 8, { radius: 2 }),
      k.pos(x, y),
      k.anchor("center"),
      k.color(139, 90, 43), // Brown jerky color
      k.outline(1, k.rgb(100, 60, 30)),
      k.area({ scale: k.vec2(0.6, 0.6) }),
      k.offscreen({ destroy: true, distance: 50 }),
      k.z(8),
      "boss_projectile",
      "jerky",
      {
        dir: dir,
        speed: 180
      }
    ]);

    jerky.onUpdate(() => {
      jerky.move(jerky.dir.scale(jerky.speed));
    });
  }

  // ============= WIN CONDITION =============
  function triggerWin(): void {
    bossState = "win";
    
    k.destroyAll("boss_projectile");
    if (fogLayer && fogLayer.exists()) fogLayer.destroy();
    
    boss.color = k.rgb(100, 100, 100);
    boss.opacity = 0.6;
    
    // Boss tired animation
    k.add([
      k.text("*thở hổn hển*", { size: 8 }),
      k.pos(boss.pos.x, boss.pos.y - 30),
      k.anchor("center"),
      k.color(200, 200, 200),
      k.z(100)
    ]);
    
    camera.shake(15, 0.5);
    
    timerBackground.opacity = 0;
    timerBar.opacity = 0;
    timerText.opacity = 0;
    phaseText.text = "YOU WIN!";
    phaseText.color = k.rgb(100, 255, 100);
    redBackground.opacity = 0;

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

    if (bossState === "intro") {
      updateGameUI(k, ui, maskManager, boss.pos, camera);
      return;
    }

    // ============= TIMER COUNTDOWN =============
    timeRemaining -= dt;
    timerText.text = `Survive: ${Math.ceil(timeRemaining)}s`;
    timerBar.width = TIMER_BAR_WIDTH * (timeRemaining / FIGHT_DURATION);

    if (timeRemaining < 15) {
      timerBar.color = k.rgb(255, 50, 50);
    } else if (timeRemaining < 45) {
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
    
    if (timeElapsed < PHASE_1_END) {
      // PHASE 1: Alo Vu Copypasta (0-30s)
      bossState = "phase1";
      phaseText.text = "Phase 1: Alo Vũ Copypasta";
      phaseText.color = k.rgb(255, 150, 150);
      boss.color = k.rgb(200, 50, 100);
      redBackground.opacity = 0;
      
      textTimer += dt;
      if (textTimer >= TEXT_FIRE_RATE && !gameState.isTimeFrozen()) {
        textTimer = 0;
        fireTextProjectile();
      }
      
    } else if (timeElapsed < PHASE_2_END) {
      // PHASE 2: Jerky Rain (30-60s)
      bossState = "phase2";
      phaseText.text = "Phase 2: Chicken Jerky Rain!";
      phaseText.color = k.rgb(139, 90, 43);
      boss.color = k.rgb(139, 90, 43);
      redBackground.opacity = 0.1;
      
      jerkyTimer += dt;
      if (jerkyTimer >= JERKY_SPAWN_RATE && !gameState.isTimeFrozen()) {
        jerkyTimer = 0;
        spawnJerkyRain();
      }
      
    } else {
      // PHASE 3: Foggy Finale (60-90s)
      bossState = "phase3";
      phaseText.text = "Phase 3: FOGGY FINALE!";
      phaseText.color = k.rgb(255, 50, 50);
      boss.color = k.rgb(50, 50, 50);
      redBackground.opacity = 0.2 + Math.sin(k.time() * 3) * 0.1;
      
      // Create fog if not exists
      if (!fogLayer) createFog();
      updateFog();
      
      // BOTH attacks simultaneously
      textTimer += dt;
      if (textTimer >= TEXT_FIRE_RATE * 0.7 && !gameState.isTimeFrozen()) {
        textTimer = 0;
        fireTextProjectile();
      }
      
      jerkyTimer += dt;
      if (jerkyTimer >= JERKY_SPAWN_RATE * 1.2 && !gameState.isTimeFrozen()) {
        jerkyTimer = 0;
        spawnJerkyRain();
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
  
  player.onCollide("boss_projectile", (projectile: GameObj<any>) => {
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
    
    gameState.setInvincible(true);
    k.wait(0.8, () => { gameState.setInvincible(false); });
  });

  player.onCollide("boss", () => {
    if (gameState.isPlayerEthereal()) return;
    if (gameState.isInvincible()) return;
    if (bossState === "win") return;

    gameState.damagePlayer(1);
    camera.shake(10, 0.3);
    
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

  // Start fight after intro dialogue
  showDialogue(k, LEVEL_DIALOGUES[5].intro, () => {
    gameState.setDialogueActive(false);
    bossState = "phase1";
    phaseText.text = "Phase 1: Alo Vũ Copypasta";
  });
}

// ============= BUILD LEVEL =============
function buildLevel(k: KaboomCtx, map: typeof LEVEL_5_MAP): void {
  const mapWidth = map.tiles[0].length * TILE_SIZE;
  const mapHeight = map.tiles.length * TILE_SIZE;

  k.add([
    k.rect(mapWidth, mapHeight),
    k.pos(0, 0),
    k.color(40, 30, 50),
    k.z(-2)
  ]);

  const carpetWidth = TILE_SIZE * 8;
  k.add([
    k.rect(carpetWidth, mapHeight - TILE_SIZE * 4),
    k.pos(mapWidth / 2 - carpetWidth / 2, TILE_SIZE * 2),
    k.color(120, 30, 40),
    k.z(-1)
  ]);

  k.add([
    k.rect(carpetWidth + 8, mapHeight - TILE_SIZE * 4 + 8),
    k.pos(mapWidth / 2 - carpetWidth / 2 - 4, TILE_SIZE * 2 - 4),
    k.color(180, 140, 60),
    k.opacity(0),
    k.outline(4, k.rgb(180, 140, 60)),
    k.z(-1)
  ]);

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

  k.add([
    k.rect(TILE_SIZE * 6, TILE_SIZE * 2),
    k.pos(mapWidth / 2, TILE_SIZE * 3),
    k.anchor("center"),
    k.color(60, 40, 70),
    k.outline(3, k.rgb(180, 140, 60)),
    k.z(1)
  ]);
  
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

    const margin = TILE_SIZE * 1.5;
    player.pos.x = k.clamp(player.pos.x, margin, LEVEL_5_MAP.width - margin);
    player.pos.y = k.clamp(player.pos.y, margin, LEVEL_5_MAP.height - margin);

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

  k.onKeyPress("1", () => maskManager.setMask(0));
  k.onKeyPress("2", () => maskManager.setMask(1));
  k.onKeyPress("3", () => maskManager.setMask(2));
  k.onKeyPress("4", () => maskManager.setMask(3));
  k.onKeyPress("tab", () => maskManager.cycleMask());

  return player;
}
