// Level 2: The Debt Tunnel - COLLECTOR CHASE (30-second 3-Phase Survival)
// Phase 1: The Chase - Run from Collector
// Phase 2: The Payment - Shield to anchor against vacuum
// Phase 3: The Getaway - Reflect Debt Notes back at Collector
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

// ============= PHASE CONSTANTS =============
const TOTAL_SURVIVAL_TIME = 30;
const PHASE_1_END = 10;   // 0s - 10s: The Chase
const PHASE_2_END = 20;   // 10s - 20s: The Payment (Vacuum)
// Phase 3: 20s - 30s: The Getaway (Debt Notes)

export function level2Scene(k: KaboomCtx): void {
  const map = LEVEL_2_MAP;
  
  setupPauseSystem(k);
  
  const camera = new CameraController(k, {
    zoom: 3,
    lerpSpeed: 0.1,
    lookAheadDistance: 15
  });
  camera.setBounds(0, 0, map.width, map.height);

  const maskManager = new MaskManager(k);
  gameState.prepareForLevel(2);
  buildLevel(k, map);

  // ============= BOUNDARY WALLS =============
  const WALL_THICKNESS = TILE_SIZE;
  k.add([k.rect(map.width + WALL_THICKNESS * 2, WALL_THICKNESS), k.pos(-WALL_THICKNESS, -WALL_THICKNESS), k.area(), k.body({ isStatic: true }), k.opacity(0), "boundary"]);
  k.add([k.rect(map.width + WALL_THICKNESS * 2, WALL_THICKNESS), k.pos(-WALL_THICKNESS, map.height), k.area(), k.body({ isStatic: true }), k.opacity(0), "boundary"]);
  k.add([k.rect(WALL_THICKNESS, map.height + WALL_THICKNESS * 2), k.pos(-WALL_THICKNESS, -WALL_THICKNESS), k.area(), k.body({ isStatic: true }), k.opacity(0), "boundary"]);
  k.add([k.rect(WALL_THICKNESS, map.height + WALL_THICKNESS * 2), k.pos(map.width, -WALL_THICKNESS), k.area(), k.body({ isStatic: true }), k.opacity(0), "boundary"]);

  const playerSpawn = getPlayerSpawn(map);

  // ============= SAFE TUTORIAL START =============
  let challengeStarted = false;
  let timeElapsed = 0;
  let levelComplete = false;
  let elevatorOpen = false;
  let currentPhase = 0;

  // ============= PLAYER SETUP =============
  const player = createPlayer(k, playerSpawn.x, playerSpawn.y, maskManager, map.width, map.height);
  maskManager.initPlayerMask(player);
  camera.snapTo(k.vec2(playerSpawn.x, playerSpawn.y));

  // ============= THE COLLECTOR (Main enemy) =============
  const collectorStartPos = { x: TILE_SIZE * 3, y: TILE_SIZE * 3 };
  const collector = k.add([
    k.rect(32, 40, { radius: 4 }),
    k.pos(collectorStartPos.x, collectorStartPos.y),
    k.anchor("center"),
    k.color(100, 100, 100), // Grey when inactive
    k.outline(3, k.rgb(80, 80, 80)),
    k.area({ scale: k.vec2(0.8, 0.8) }),
    k.z(8),
    "collector",
    {
      speed: 90,
      state: "inactive", // inactive, chase, vacuum, enraged
      stunTimer: 0
    }
  ]);

  // Collector face
  collector.onDraw(() => {
    // Eyes
    k.drawCircle({ pos: k.vec2(-6, -8), radius: 4, color: k.rgb(255, 255, 255) });
    k.drawCircle({ pos: k.vec2(6, -8), radius: 4, color: k.rgb(255, 255, 255) });
    // Pupils (follow player direction)
    const toPlayer = player.pos.sub(collector.pos).unit();
    k.drawCircle({ pos: k.vec2(-6 + toPlayer.x * 2, -8 + toPlayer.y * 2), radius: 2, color: k.rgb(200, 0, 0) });
    k.drawCircle({ pos: k.vec2(6 + toPlayer.x * 2, -8 + toPlayer.y * 2), radius: 2, color: k.rgb(200, 0, 0) });
    // Mouth
    if (collector.state === "vacuum") {
      k.drawCircle({ pos: k.vec2(0, 5), radius: 8, color: k.rgb(0, 0, 0) });
    } else if (collector.state === "enraged") {
      k.drawRect({ pos: k.vec2(-8, 3), width: 16, height: 6, color: k.rgb(200, 0, 0) });
    } else {
      k.drawRect({ pos: k.vec2(-6, 5), width: 12, height: 4, color: k.rgb(50, 50, 50) });
    }
    // State text
    if (collector.state === "chase") {
      k.drawText({ text: "💰", pos: k.vec2(0, -25), size: 10, anchor: "center" });
    } else if (collector.state === "vacuum") {
      k.drawText({ text: "🌀", pos: k.vec2(0, -25), size: 12, anchor: "center" });
    } else if (collector.state === "enraged") {
      k.drawText({ text: "😤", pos: k.vec2(0, -25), size: 10, anchor: "center" });
    }
  });

  // ============= VACUUM EFFECT VISUALS =============
  const vacuumRings: GameObj<any>[] = [];
  for (let i = 0; i < 3; i++) {
    const ring = k.add([
      k.circle(30 + i * 25),
      k.pos(collector.pos.x, collector.pos.y),
      k.anchor("center"),
      k.color(100, 50, 150),
      k.opacity(0),
      k.outline(2, k.rgb(150, 100, 200)),
      k.z(3)
    ]);
    vacuumRings.push(ring);
  }

  // ============= UI ELEMENTS =============
  const ui = createGameUI(k);

  // Big timer display
  const timerText = k.add([
    k.text("30", { size: 16 }),
    k.pos(map.width / 2, 15),
    k.anchor("center"),
    k.color(255, 255, 100),
    k.z(100)
  ]);

  // Phase indicator
  const phaseText = k.add([
    k.text("THE COLLECTOR AWAITS...", { size: 8 }),
    k.pos(map.width / 2, 32),
    k.anchor("center"),
    k.color(150, 150, 150),
    k.z(100)
  ]);

  // Tutorial hint
  const hintText = k.add([
    k.text("Use Shield Mask to survive!", { size: 7 }),
    k.pos(map.width / 2, map.height - 20),
    k.anchor("center"),
    k.color(100, 255, 200),
    k.z(100)
  ]);

  // ============= ELEVATOR =============
  const elevatorX = map.width - TILE_SIZE * 3;
  const elevatorY = TILE_SIZE * 2;

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

  // ============= DAMAGE SYSTEM =============
  let playerInvincible = false;
  let invincibilityTimer = 0;
  const INVINCIBILITY_DURATION = 1.5;
  let blinkLoop: { cancel: () => void } | null = null;

  function triggerInvincibility(): void {
    if (playerInvincible) return;
    playerInvincible = true;
    invincibilityTimer = INVINCIBILITY_DURATION;
    gameState.setInvincible(true);
    
    blinkLoop = k.loop(0.1, () => {
      if (player.exists()) {
        player.opacity = player.opacity > 0.5 ? 0.3 : 1.0;
      }
    });
  }

  function damagePlayer(amount: number = 1): boolean {
    if (playerInvincible || gameState.isInvincible()) return false;
    if (gameState.isPlayerShielding()) return false; // Shield blocks all damage!
    
    gameState.damagePlayer(amount);
    camera.shake(8, 0.3);
    player.color = k.rgb(255, 50, 50);
    triggerInvincibility();
    
    if (gameState.isPlayerDead()) {
      k.go("gameover");
      return true;
    }
    return false;
  }

  // ============= PHASE 1: THE CHASE =============
  function updateChasePhase(dt: number): void {
    if (collector.stunTimer > 0) {
      collector.stunTimer -= dt;
      collector.color = k.rgb(150, 150, 150);
      return;
    }
    
    collector.color = k.rgb(139, 69, 19); // Brown - debt collector
    
    // Chase player
    const toPlayer = player.pos.sub(collector.pos).unit();
    collector.pos = collector.pos.add(toPlayer.scale(collector.speed * dt));
    
    // Keep in bounds
    collector.pos.x = k.clamp(collector.pos.x, TILE_SIZE * 2, map.width - TILE_SIZE * 2);
    collector.pos.y = k.clamp(collector.pos.y, TILE_SIZE * 2, map.height - TILE_SIZE * 2);
  }

  // ============= PHASE 2: THE VACUUM =============
  let vacuumPullStrength = 0;
  
  function updateVacuumPhase(dt: number): void {
    collector.color = k.rgb(80, 0, 120); // Purple - vacuum mode
    
    // Collector moves to center
    const centerPos = k.vec2(map.width / 2, map.height / 2);
    const toCenter = centerPos.sub(collector.pos);
    if (toCenter.len() > 5) {
      collector.pos = collector.pos.add(toCenter.unit().scale(50 * dt));
    }
    
    // Vacuum pull effect on player
    vacuumPullStrength = 80; // Pull force
    
    // Update vacuum rings
    vacuumRings.forEach((ring, i) => {
      ring.pos = collector.pos;
      ring.opacity = 0.3 + Math.sin(k.time() * 3 + i) * 0.2;
      ring.radius = 40 + i * 30 + Math.sin(k.time() * 4) * 10;
    });
    
    // If NOT shielding, pull player toward collector
    if (!gameState.isPlayerShielding()) {
      const toCollector = collector.pos.sub(player.pos).unit();
      player.pos = player.pos.add(toCollector.scale(vacuumPullStrength * dt));
      
      // Damage if too close
      if (player.pos.dist(collector.pos) < 30) {
        damagePlayer(1);
      }
    } else {
      // Anchored! Show feedback
      if (Math.floor(k.time() * 4) % 2 === 0) {
        player.color = k.rgb(100, 200, 255);
      }
    }
  }

  // ============= PHASE 3: DEBT NOTES (Homing Projectiles) =============
  let debtNoteTimer = 0;
  const DEBT_NOTE_INTERVAL = 1.2;
  
  function spawnDebtNote(): void {
    const startPos = collector.pos.clone();
    const toPlayer = player.pos.sub(startPos).unit();
    
    const note = k.add([
      k.rect(16, 12, { radius: 2 }),
      k.pos(startPos.x, startPos.y),
      k.anchor("center"),
      k.color(50, 150, 50), // Green money color
      k.outline(2, k.rgb(200, 200, 50)),
      k.area({ scale: k.vec2(0.7, 0.7) }),
      k.z(7),
      "debt_note",
      "reflectable",
      {
        dir: toPlayer,
        speed: 100,
        homingStrength: 2,
        reflected: false
      }
    ]);

    // "$" symbol on note
    note.onDraw(() => {
      k.drawText({
        text: note.reflected ? "💫" : "$",
        pos: k.vec2(0, 0),
        size: note.reflected ? 10 : 8,
        anchor: "center",
        color: note.reflected ? k.rgb(255, 255, 100) : k.rgb(255, 255, 200)
      });
    });

    note.onUpdate(() => {
      if (note.reflected) {
        // Fly toward collector
        const toCollector = collector.pos.sub(note.pos).unit();
        note.dir = toCollector;
        note.pos = note.pos.add(note.dir.scale(150 * k.dt()));
      } else {
        // Home toward player
        const toPlayer = player.pos.sub(note.pos).unit();
        note.dir = note.dir.add(toPlayer.scale(note.homingStrength * k.dt())).unit();
        note.pos = note.pos.add(note.dir.scale(note.speed * k.dt()));
      }
      
      // Out of bounds
      if (note.pos.x < -50 || note.pos.x > map.width + 50 ||
          note.pos.y < -50 || note.pos.y > map.height + 50) {
        note.destroy();
      }
    });
  }

  function updateEnragedPhase(dt: number): void {
    if (collector.stunTimer > 0) {
      collector.stunTimer -= dt;
      collector.color = k.rgb(200, 200, 100); // Stunned
      return;
    }
    
    collector.color = k.rgb(200, 50, 50); // Red - enraged
    
    // Slow chase
    const toPlayer = player.pos.sub(collector.pos).unit();
    collector.pos = collector.pos.add(toPlayer.scale(40 * dt));
    
    // Keep in bounds
    collector.pos.x = k.clamp(collector.pos.x, TILE_SIZE * 2, map.width - TILE_SIZE * 2);
    collector.pos.y = k.clamp(collector.pos.y, TILE_SIZE * 2, map.height - TILE_SIZE * 2);
    
    // Spawn debt notes
    debtNoteTimer += dt;
    if (debtNoteTimer >= DEBT_NOTE_INTERVAL) {
      debtNoteTimer = 0;
      spawnDebtNote();
    }
  }

  // ============= OPEN ELEVATOR =============
  function openElevator(): void {
    elevatorOpen = true;
    
    k.destroyAll("debt_note");
    vacuumRings.forEach(ring => { ring.opacity = 0; });
    
    elevator.color = k.rgb(100, 255, 100);
    elevator.outline.color = k.rgb(50, 255, 50);
    
    k.tween(0, 0.6, 0.5, (val) => { elevatorGlow.opacity = val; });
    
    phaseText.text = "ESCAPED! GO TO EXIT!";
    phaseText.color = k.rgb(100, 255, 100);
    hintText.text = "";
    
    // Collector defeated
    collector.color = k.rgb(100, 100, 100);
    collector.state = "inactive";
  }

  // ============= MAIN UPDATE LOOP =============
  k.onUpdate(() => {
    if (gameState.isPaused() || gameState.isDialogueActive() || levelComplete) return;
    if (!challengeStarted) return; // Wait for tutorial to complete
    
    const dt = k.dt();
    timeElapsed += dt;
    maskManager.update(dt);
    maskManager.updatePlayerMask();
    camera.follow(player, k.mousePos());

    // Invincibility update
    if (playerInvincible) {
      invincibilityTimer -= dt;
      if (invincibilityTimer <= 0) {
        playerInvincible = false;
        gameState.setInvincible(false);
        if (blinkLoop) { blinkLoop.cancel(); blinkLoop = null; }
        if (player.exists()) { player.opacity = 1; player.color = k.rgb(79, 195, 247); }
      }
    }

    // Timer display
    const remaining = Math.max(0, TOTAL_SURVIVAL_TIME - timeElapsed);
    timerText.text = `${Math.ceil(remaining)}`;
    
    if (remaining <= 5) timerText.color = k.rgb(100, 255, 100);
    else if (remaining <= 10) timerText.color = k.rgb(255, 255, 100);
    else if (remaining <= 20) timerText.color = k.rgb(255, 200, 100);

    // Victory check
    if (timeElapsed >= TOTAL_SURVIVAL_TIME && !elevatorOpen) {
      openElevator();
      return;
    }
    if (elevatorOpen) return;

    // ============= PHASE LOGIC =============
    if (timeElapsed < PHASE_1_END) {
      // PHASE 1: The Chase
      if (currentPhase !== 1) {
        currentPhase = 1;
        collector.state = "chase";
        phaseText.text = "PHASE 1: THE CHASE!";
        phaseText.color = k.rgb(255, 150, 100);
        hintText.text = "Run away! Shield blocks contact damage!";
      }
      updateChasePhase(dt);
      
    } else if (timeElapsed < PHASE_2_END) {
      // PHASE 2: The Vacuum
      if (currentPhase !== 2) {
        currentPhase = 2;
        collector.state = "vacuum";
        phaseText.text = "PHASE 2: THE PAYMENT!";
        phaseText.color = k.rgb(150, 50, 200);
        hintText.text = "Hold SHIELD to anchor yourself!";
      }
      updateVacuumPhase(dt);
      
    } else {
      // PHASE 3: The Getaway (Debt Notes)
      if (currentPhase !== 3) {
        currentPhase = 3;
        collector.state = "enraged";
        phaseText.text = "PHASE 3: THE GETAWAY!";
        phaseText.color = k.rgb(255, 50, 50);
        hintText.text = "SHIELD to reflect Debt Notes back!";
        vacuumRings.forEach(ring => { ring.opacity = 0; });
      }
      updateEnragedPhase(dt);
    }

    updateGameUI(k, ui, maskManager, player.pos, camera);
  });

  // ============= COLLISION: Collector Contact =============
  player.onCollide("collector", () => {
    if (collector.state === "vacuum") return; // No contact damage in vacuum phase
    damagePlayer(1);
  });

  // ============= COLLISION: Debt Notes =============
  player.onCollide("debt_note", (note: GameObj<any>) => {
    if (note.reflected) return; // Already reflected
    
    if (gameState.isPlayerShielding()) {
      // Reflect the note!
      note.reflected = true;
      note.color = k.rgb(255, 255, 100);
      note.speed = 150;
      
      camera.shake(4, 0.1);
      
      k.add([
        k.text("REFLECTED!", { size: 8 }),
        k.pos(player.pos.x, player.pos.y - 20),
        k.anchor("center"),
        k.color(100, 255, 100),
        k.z(200),
        k.lifespan(0.5),
        k.move(k.vec2(0, -1), 30)
      ]);
      return;
    }
    
    damagePlayer(1);
    note.destroy();
  });

  // ============= COLLISION: Reflected Notes hit Collector =============
  collector.onCollide("debt_note", (note: GameObj<any>) => {
    if (note.reflected) {
      note.destroy();
      collector.stunTimer = 2.0; // Stun for 2 seconds
      camera.shake(8, 0.2);
      
      k.add([
        k.text("STUNNED!", { size: 10 }),
        k.pos(collector.pos.x, collector.pos.y - 30),
        k.anchor("center"),
        k.color(255, 255, 100),
        k.z(200),
        k.lifespan(0.8),
        k.move(k.vec2(0, -1), 20)
      ]);
    }
  });

  // ============= ELEVATOR COLLISION =============
  player.onCollide("elevator", () => {
    if (!elevatorOpen || levelComplete) return;
    
    levelComplete = true;
    player.pos = k.vec2(elevatorX, elevatorY);
    
    k.tween(1, 0, 0.5, (val) => {
      player.opacity = val;
    }, k.easings.easeInQuad).onEnd(() => {
      showDialogue(k, LEVEL_DIALOGUES[2].outro!, () => {
        k.go("level3");
      });
    });
  });

  // ============= INTRO DIALOGUE & SAFE START =============
  showDialogue(k, LEVEL_DIALOGUES[2].intro, () => {
    gameState.addCollectedMask(MASKS.shield);
    gameState.setCurrentMask(MASKS.shield);
    showAcquiredNotification(k, "SHIELD MASK");
    
    gameState.setDialogueActive(false);
    showMaskDescription(k, 2);
    
    // Safe Tutorial Start: Begin challenge AFTER UI fades
    k.wait(3.5, () => {
      challengeStarted = true;
      
      // Collector awakens
      k.tween(k.rgb(100, 100, 100), k.rgb(139, 69, 19), 0.5, (c) => {
        collector.color = c;
      }, k.easings.easeOutQuad);
    });
  });
}

// ============= HELPER FUNCTIONS =============

function showAcquiredNotification(k: KaboomCtx, maskName: string): void {
  const notification = k.add([
    k.text(`✨ ACQUIRED: ${maskName} ✨`, { size: 16 }),
    k.pos(k.width() / 2, k.height() * 0.25),
    k.anchor("center"),
    k.color(255, 215, 0),
    k.opacity(0),
    k.z(2000),
    k.fixed()
  ]);
  
  k.tween(0, 1, 0.4, (val) => { notification.opacity = val; }, k.easings.easeOutQuad);
  k.wait(2.5, () => {
    k.tween(1, 0, 0.6, (val) => { notification.opacity = val; }, k.easings.easeInQuad)
      .onEnd(() => notification.destroy());
  });
}

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
      speed: 100, // Faster for running away
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
