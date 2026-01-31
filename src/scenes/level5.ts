// Level 5: THE FACE STEALER - 5-Phase Mask-Counter Boss Fight
// Player must equip correct mask to counter each phase
import { KaboomCtx, GameObj } from "kaboom";
import { MaskManager, MASK_SCALE_UI } from "../mechanics/MaskManager.ts";
import { setupPauseSystem } from "../mechanics/PauseSystem.ts";
import { gameState } from "../state.ts";
import { LEVEL_DIALOGUES, MASKS } from "../constants.ts";
import { showDialogue } from "./dialogue.ts";
import { CameraController } from "../camera.ts";
import { createGameUI, updateGameUI, showMaskDescription } from "../ui.ts";
import { LEVEL_5_MAP, getPlayerSpawn } from "../maps.ts";
import { TILE_SIZE } from "../loader.ts";

// ============= BOSS FIGHT CONSTANTS =============
const BOSS_MAX_HP = 100;
const DPS_WINDOW_DURATION = 3; // Seconds of vulnerability after correct counter
const PHASE_5_CYCLE_TIME = 10; // Seconds between form changes in desperation

// Boss phase types - which mask counters which phase
type BossPhase = "intro" | "wrath" | "phantom" | "overclock" | "arcane" | "desperation" | "defeated";

// Phase -> Required mask mapping
const PHASE_COUNTER_MASK: Record<string, string> = {
  wrath: "shield",     // Red aura - use Shield to reflect beam
  phantom: "ghost",    // Grey aura - use Ghost to dodge shockwaves
  overclock: "frozen", // Blue aura - use Freeze to stun speedy boss
  arcane: "silence"    // Black aura - use Silence to interrupt spell
};

// Phase colors for boss aura
const PHASE_COLORS: Record<string, [number, number, number]> = {
  wrath: [255, 50, 50],      // Red
  phantom: [150, 150, 150],  // Grey
  overclock: [50, 150, 255], // Blue
  arcane: [30, 30, 30]       // Black
};

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
  maskManager.initPlayerMask(player);
  camera.snapTo(k.vec2(playerSpawn.x, playerSpawn.y));

  // ============= BOSS STATE =============
  let bossPhase: BossPhase = "intro";
  let bossHP = BOSS_MAX_HP;
  let isDPSWindow = false;
  let dpsWindowTimer = 0;
  let phaseAttackTimer = 0;
  let desperationFormTimer = 0;
  let currentDesperationForm = 0;
  const desperationForms: BossPhase[] = ["wrath", "phantom", "overclock", "arcane"];

  // ============= CREATE BOSS: The Face Stealer =============
  const boss = k.add([
    k.sprite("boss"),
    k.pos(bossSpawnPos.x, bossSpawnPos.y),
    k.anchor("center"),
    k.area({ scale: k.vec2(0.8, 0.8) }),
    k.color(200, 50, 100),
    k.opacity(1),
    k.scale(1.5),
    k.z(9),
    "boss"
  ]);

  // Boss aura effect
  const bossAura = k.add([
    k.circle(40),
    k.pos(boss.pos),
    k.anchor("center"),
    k.color(255, 50, 50),
    k.opacity(0.3),
    k.z(8),
    "boss-aura"
  ]);

  // ============= UI SETUP =============
  const ui = createGameUI(k);
  
  // Boss HP Bar
  const HP_BAR_WIDTH = 280;
  const HP_BAR_HEIGHT = 18;
  const HP_BAR_Y = 55;
  
  k.add([
    k.rect(HP_BAR_WIDTH + 6, HP_BAR_HEIGHT + 6),
    k.pos(k.width() / 2, HP_BAR_Y),
    k.anchor("center"),
    k.color(20, 20, 20),
    k.outline(2, k.rgb(100, 100, 100)),
    k.z(300),
    k.fixed()
  ]);

  const hpBar = k.add([
    k.rect(HP_BAR_WIDTH, HP_BAR_HEIGHT),
    k.pos(k.width() / 2 - HP_BAR_WIDTH / 2, HP_BAR_Y - HP_BAR_HEIGHT / 2),
    k.color(255, 50, 50),
    k.z(301),
    k.fixed()
  ]);

  k.add([
    k.text("THE FACE STEALER", { size: 10 }),
    k.pos(k.width() / 2, HP_BAR_Y),
    k.anchor("center"),
    k.color(255, 255, 255),
    k.z(302),
    k.fixed()
  ]);

  const phaseText = k.add([
    k.text("PREPARE YOURSELF!", { size: 9 }),
    k.pos(k.width() / 2, HP_BAR_Y + 20),
    k.anchor("center"),
    k.color(255, 200, 100),
    k.z(302),
    k.fixed()
  ]);

  // Required mask indicator
  const maskHintText = k.add([
    k.text("", { size: 8 }),
    k.pos(k.width() / 2, HP_BAR_Y + 35),
    k.anchor("center"),
    k.color(200, 200, 255),
    k.z(302),
    k.fixed()
  ]);

  // Mask selection UI at bottom
  const maskUIContainer = k.add([
    k.pos(k.width() / 2, k.height() - 45),
    k.anchor("center"),
    k.z(400),
    k.fixed()
  ]);

  const maskIcons: GameObj<any>[] = [];
  const MASK_SPACING = 74;
  const masks = [
    { id: "shield", key: "1", sprite: "mask-shield", color: k.rgb(255, 87, 34) },
    { id: "ghost", key: "2", sprite: "mask-ghost", color: k.rgb(156, 39, 176) },
    { id: "frozen", key: "3", sprite: "mask-frozen", color: k.rgb(0, 188, 212) },
    { id: "silence", key: "4", sprite: "mask-silence", color: k.rgb(33, 33, 33) }
  ];

  masks.forEach((mask, i) => {
    const xPos = (i - 1.5) * MASK_SPACING;
    maskUIContainer.add([
      k.text(`[${mask.key}]`, { size: 10 }),
      k.pos(xPos, -40),
      k.anchor("center"),
      k.color(200, 200, 200),
      k.z(401)
    ]);
    const icon = maskUIContainer.add([
      k.sprite(mask.sprite),
      k.pos(xPos, 0),
      k.anchor("center"),
      k.scale(MASK_SCALE_UI),
      k.outline(0, mask.color),
      k.z(401),
      { maskId: mask.id }
    ]);
    maskIcons.push(icon);
  });

  // ============= ATTACK PATTERNS =============
  
  // Phase 1: WRATH - Room-spanning energy beams
  function fireEnergyBeam(): void {
    const beamY = boss.pos.y + 30;
    
    // Warning line
    const warning = k.add([
      k.rect(map.width, 4),
      k.pos(0, beamY),
      k.color(255, 100, 100),
      k.opacity(0.5),
      k.z(7)
    ]);
    
    k.wait(0.8, () => {
      if (warning.exists()) warning.destroy();
      
      // Fire beam
      const beam = k.add([
        k.rect(map.width, 30),
        k.pos(0, beamY - 15),
        k.color(255, 50, 50),
        k.opacity(0.8),
        k.area(),
        k.z(8),
        "energy-beam"
      ]);
      
      k.wait(0.5, () => {
        if (beam.exists()) beam.destroy();
      });
    });
  }

  // Phase 2: PHANTOM - Spectral shockwaves
  function fireShockwave(): void {
    const wave = k.add([
      k.circle(10),
      k.pos(boss.pos),
      k.anchor("center"),
      k.color(150, 150, 150),
      k.opacity(0.6),
      k.outline(3, k.rgb(200, 200, 200)),
      k.area(),
      k.z(7),
      "shockwave",
      { radius: 10 }
    ]);

    wave.onUpdate(() => {
      wave.radius += 150 * k.dt();
      wave.opacity -= 0.3 * k.dt();
      if (wave.radius > 200) {
        wave.destroy();
      }
    });
  }

  // Phase 3: OVERCLOCK - Hyper-speed dashes
  function hyperDash(): void {
    const dashTarget = player.pos.clone();
    
    // Blur trail
    for (let i = 0; i < 5; i++) {
      k.wait(i * 0.05, () => {
        const trail = k.add([
          k.sprite("boss"),
          k.pos(boss.pos),
          k.anchor("center"),
          k.color(50, 150, 255),
          k.opacity(0.4),
          k.scale(1.5),
          k.z(8)
        ]);
        k.tween(0.4, 0, 0.3, (v) => { trail.opacity = v; }).onEnd(() => trail.destroy());
      });
    }
    
    k.tween(boss.pos.clone(), dashTarget, 0.15, (v) => { boss.pos = v; }, k.easings.linear);
  }

  // Phase 4: ARCANE - World End spell charge
  let arcaneChargeActive = false;
  let arcaneChargeTimer = 0;
  const ARCANE_CHARGE_TIME = 5;

  function startArcaneCharge(): void {
    arcaneChargeActive = true;
    arcaneChargeTimer = 0;
    
    // Move boss to center
    k.tween(boss.pos.clone(), k.vec2(map.width / 2, map.height / 3), 0.5, (v) => { boss.pos = v; });
    
    // Charging visual
    k.add([
      k.text("WORLD END CHARGING...", { size: 10 }),
      k.pos(boss.pos.x, boss.pos.y - 50),
      k.anchor("center"),
      k.color(100, 0, 100),
      k.z(100),
      "arcane-warning"
    ]);
  }

  // ============= PHASE MANAGEMENT =============
  function setPhase(newPhase: BossPhase): void {
    bossPhase = newPhase;
    phaseAttackTimer = 0;
    
    const color = PHASE_COLORS[newPhase] || [200, 50, 100];
    boss.color = k.rgb(color[0], color[1], color[2]);
    bossAura.color = k.rgb(color[0], color[1], color[2]);
    
    switch (newPhase) {
      case "wrath":
        phaseText.text = "WRATH MODE - Shield to Reflect!";
        phaseText.color = k.rgb(255, 100, 100);
        maskHintText.text = "Use [1] SHIELD MASK!";
        maskHintText.color = k.rgb(255, 87, 34);
        break;
      case "phantom":
        phaseText.text = "PHANTOM MODE - Ghost to Dodge!";
        phaseText.color = k.rgb(150, 150, 150);
        maskHintText.text = "Use [2] GHOST MASK!";
        maskHintText.color = k.rgb(156, 39, 176);
        break;
      case "overclock":
        phaseText.text = "OVERCLOCK MODE - Freeze to Stun!";
        phaseText.color = k.rgb(50, 150, 255);
        maskHintText.text = "Use [3] FREEZE MASK!";
        maskHintText.color = k.rgb(0, 188, 212);
        break;
      case "arcane":
        phaseText.text = "ARCANE MODE - Silence to Interrupt!";
        phaseText.color = k.rgb(100, 50, 150);
        maskHintText.text = "Use [4] SILENCE MASK!";
        maskHintText.color = k.rgb(100, 100, 100);
        startArcaneCharge();
        break;
      case "desperation":
        phaseText.text = "DESPERATION - Quick Swap Masks!";
        phaseText.color = k.rgb(255, 50, 50);
        maskHintText.text = "Watch the aura color!";
        desperationFormTimer = 0;
        currentDesperationForm = 0;
        break;
      case "defeated":
        phaseText.text = "DEFEATED!";
        phaseText.color = k.rgb(100, 255, 100);
        maskHintText.text = "";
        break;
    }
  }

  function checkPhaseTransition(): void {
    if (bossPhase === "defeated") return;
    
    if (bossHP <= 0) {
      triggerDefeat();
      return;
    }
    
    // Phase transitions based on HP
    if (bossHP <= 25 && bossPhase !== "desperation") {
      setPhase("desperation");
    } else if (bossHP <= 50 && bossHP > 25 && bossPhase !== "arcane" && bossPhase !== "desperation") {
      setPhase("arcane");
    } else if (bossHP <= 75 && bossHP > 50 && bossPhase !== "overclock" && bossPhase !== "arcane" && bossPhase !== "desperation") {
      setPhase("overclock");
    }
  }

  // ============= DPS WINDOW =============
  function triggerDPSWindow(reason: string): void {
    isDPSWindow = true;
    dpsWindowTimer = DPS_WINDOW_DURATION;
    
    boss.color = k.rgb(255, 255, 100);
    bossAura.opacity = 0.6;
    
    k.add([
      k.text(reason, { size: 12 }),
      k.pos(boss.pos.x, boss.pos.y - 60),
      k.anchor("center"),
      k.color(255, 255, 100),
      k.z(100),
      { life: 1.5 }
    ]).onUpdate(function(this: GameObj<any>) {
      this.pos.y -= 20 * k.dt();
      this.life -= k.dt();
      if (this.life <= 0) this.destroy();
    });
    
    // Player can now damage boss
    k.add([
      k.text("ATTACK NOW!", { size: 14 }),
      k.pos(k.width() / 2, k.height() / 2),
      k.anchor("center"),
      k.color(255, 255, 0),
      k.opacity(1),
      k.z(500),
      k.fixed()
    ]).onUpdate(function(this: GameObj<any>) {
      this.opacity -= k.dt();
      if (this.opacity <= 0) this.destroy();
    });
    
    camera.shake(10, 0.5);
  }

  function damageBoss(amount: number): void {
    if (!isDPSWindow) return;
    
    bossHP = Math.max(0, bossHP - amount);
    camera.shake(5, 0.2);
    
    // Flash boss white
    boss.color = k.rgb(255, 255, 255);
    k.wait(0.1, () => {
      if (bossPhase !== "defeated") {
        const color = PHASE_COLORS[bossPhase] || [200, 50, 100];
        if (!isDPSWindow) boss.color = k.rgb(color[0], color[1], color[2]);
      }
    });
    
    checkPhaseTransition();
  }

  // ============= CORRECT COUNTER CHECK =============
  function checkMaskCounter(): void {
    const currentMask = gameState.getPlayerState().currentMask;
    if (!currentMask) return;
    
    const requiredMask = bossPhase === "desperation" 
      ? PHASE_COUNTER_MASK[desperationForms[currentDesperationForm]]
      : PHASE_COUNTER_MASK[bossPhase];
    
    if (currentMask.id === requiredMask) {
      // Correct counter!
      let reason = "";
      switch (bossPhase === "desperation" ? desperationForms[currentDesperationForm] : bossPhase) {
        case "wrath": reason = "BEAM REFLECTED!"; break;
        case "phantom": reason = "PHASED THROUGH!"; break;
        case "overclock": reason = "FROZEN SOLID!"; break;
        case "arcane": reason = "SPELL INTERRUPTED!"; break;
      }
      
      if (bossPhase === "arcane") {
        arcaneChargeActive = false;
        k.destroyAll("arcane-warning");
      }
      
      triggerDPSWindow(reason);
    }
  }

  // ============= DEFEAT =============
  function triggerDefeat(): void {
    bossPhase = "defeated";
    isDPSWindow = false;
    
    k.destroyAll("energy-beam");
    k.destroyAll("shockwave");
    k.destroyAll("arcane-warning");
    
    boss.color = k.rgb(100, 100, 100);
    boss.opacity = 0.6;
    bossAura.opacity = 0;
    
    phaseText.text = "DEFEATED!";
    phaseText.color = k.rgb(100, 255, 100);
    maskHintText.text = "";
    hpBar.width = 0;
    
    camera.shake(20, 1);
    
    // Award Silence Mask
    gameState.addCollectedMask(MASKS.silence);
    
    k.wait(2, () => {
      showDialogue(k, LEVEL_DIALOGUES[5].outro!, () => {
        k.go("outro");
      });
    });
  }

  // ============= MAIN UPDATE LOOP =============
  k.onUpdate(() => {
    if (gameState.isPaused() || gameState.isDialogueActive()) return;
    if (bossPhase === "defeated") return;

    const dt = k.dt();
    maskManager.update(dt);
    maskManager.updatePlayerMask();
    camera.follow(player, k.mousePos());
    
    // Update boss aura position
    bossAura.pos = boss.pos;
    bossAura.radius = 40 + Math.sin(k.time() * 3) * 5;

    if (bossPhase === "intro") {
      updateGameUI(k, ui, maskManager, boss.pos, camera);
      return;
    }

    // Update HP bar
    hpBar.width = HP_BAR_WIDTH * (bossHP / BOSS_MAX_HP);

    // DPS window countdown
    if (isDPSWindow) {
      dpsWindowTimer -= dt;
      if (dpsWindowTimer <= 0) {
        isDPSWindow = false;
        const color = PHASE_COLORS[bossPhase] || [200, 50, 100];
        boss.color = k.rgb(color[0], color[1], color[2]);
        bossAura.opacity = 0.3;
      }
    }

    // Phase-specific attacks
    if (!isDPSWindow) {
      phaseAttackTimer += dt;
      
      switch (bossPhase) {
        case "wrath":
          if (phaseAttackTimer >= 2.5) {
            phaseAttackTimer = 0;
            fireEnergyBeam();
          }
          break;
        case "phantom":
          if (phaseAttackTimer >= 1.5) {
            phaseAttackTimer = 0;
            fireShockwave();
          }
          boss.opacity = 0.3 + Math.sin(k.time() * 2) * 0.2;
          break;
        case "overclock":
          if (phaseAttackTimer >= 1.0) {
            phaseAttackTimer = 0;
            hyperDash();
          }
          break;
        case "arcane":
          if (arcaneChargeActive) {
            arcaneChargeTimer += dt;
            if (arcaneChargeTimer >= ARCANE_CHARGE_TIME) {
              // Instant kill if not interrupted
              gameState.damagePlayer(99);
              if (gameState.isPlayerDead()) {
                k.go("gameover");
              }
            }
          }
          break;
        case "desperation":
          desperationFormTimer += dt;
          if (desperationFormTimer >= PHASE_5_CYCLE_TIME) {
            desperationFormTimer = 0;
            currentDesperationForm = (currentDesperationForm + 1) % desperationForms.length;
            
            const form = desperationForms[currentDesperationForm];
            const color = PHASE_COLORS[form];
            boss.color = k.rgb(color[0], color[1], color[2]);
            bossAura.color = k.rgb(color[0], color[1], color[2]);
            
            const maskName = PHASE_COUNTER_MASK[form].toUpperCase();
            maskHintText.text = `Aura changed! Use ${maskName}!`;
          }
          
          // Random attacks based on current form
          if (phaseAttackTimer >= 1.5) {
            phaseAttackTimer = 0;
            const form = desperationForms[currentDesperationForm];
            switch (form) {
              case "wrath": fireEnergyBeam(); break;
              case "phantom": fireShockwave(); break;
              case "overclock": hyperDash(); break;
              case "arcane": 
                if (!arcaneChargeActive) startArcaneCharge();
                break;
            }
          }
          break;
      }
    }

    // Check for counter when player activates ability
    if (maskManager.isEffectActive("shield") || 
        maskManager.isEffectActive("ghost") || 
        maskManager.isEffectActive("frozen") || 
        maskManager.isEffectActive("silence")) {
      checkMaskCounter();
    }

    // Update mask selection UI
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
  
  player.onCollide("energy-beam", () => {
    if (gameState.isPlayerShielding()) {
      // Reflected! This triggers the counter
      return;
    }
    if (gameState.isPlayerEthereal()) return;
    if (gameState.isInvincible()) return;
    
    gameState.damagePlayer(1);
    camera.shake(10, 0.3);
    gameState.setInvincible(true);
    k.wait(1, () => { gameState.setInvincible(false); });
    
    if (gameState.isPlayerDead()) k.go("gameover");
  });

  player.onCollide("shockwave", () => {
    if (gameState.isPlayerEthereal()) return; // Ghost phase dodges
    if (gameState.isInvincible()) return;
    
    gameState.damagePlayer(1);
    camera.shake(8, 0.2);
    gameState.setInvincible(true);
    k.wait(1, () => { gameState.setInvincible(false); });
    
    if (gameState.isPlayerDead()) k.go("gameover");
  });

  player.onCollide("boss", () => {
    if (isDPSWindow) {
      // Attack the boss!
      damageBoss(10);
      return;
    }
    
    if (gameState.isPlayerEthereal()) return;
    if (gameState.isInvincible()) return;
    if (gameState.isTimeFrozen()) return; // Freeze stuns boss

    gameState.damagePlayer(1);
    camera.shake(10, 0.3);
    
    const knockDir = player.pos.sub(boss.pos).unit();
    player.pos = player.pos.add(knockDir.scale(40));
    player.pos.x = k.clamp(player.pos.x, TILE_SIZE * 1.5, map.width - TILE_SIZE * 1.5);
    player.pos.y = k.clamp(player.pos.y, TILE_SIZE * 1.5, map.height - TILE_SIZE * 1.5);

    gameState.setInvincible(true);
    k.wait(1, () => { gameState.setInvincible(false); });

    if (gameState.isPlayerDead()) k.go("gameover");
  });

  // Start fight after intro dialogue
  showDialogue(k, LEVEL_DIALOGUES[5].intro, () => {
    gameState.setDialogueActive(false);
    showMaskDescription(k, 5);
    
    k.wait(3.5, () => {
      setPhase("wrath"); // Start with Phase 1
    });
  });
}

// ============= BUILD LEVEL =============
function buildLevel(k: KaboomCtx, map: typeof LEVEL_5_MAP): void {
  const mapWidth = map.tiles[0].length * TILE_SIZE;
  const mapHeight = map.tiles.length * TILE_SIZE;

  // Dark background
  k.add([
    k.rect(mapWidth, mapHeight),
    k.pos(0, 0),
    k.color(30, 20, 40),
    k.z(-2)
  ]);

  // Central carpet
  const carpetWidth = TILE_SIZE * 8;
  k.add([
    k.rect(carpetWidth, mapHeight - TILE_SIZE * 4),
    k.pos(mapWidth / 2 - carpetWidth / 2, TILE_SIZE * 2),
    k.color(100, 20, 30),
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
    }
  }

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
      speed: 120,
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

    // Visual feedback based on state
    if (gameState.isPlayerShielding()) {
      player.color = k.rgb(255, 87, 34);
    } else if (gameState.isPlayerEthereal()) {
      player.color = k.rgb(156, 39, 176);
      player.opacity = 0.4;
    } else if (gameState.isTimeFrozen()) {
      player.color = k.rgb(0, 188, 212);
    } else if (gameState.isPlayerInvisible()) {
      player.color = k.rgb(33, 33, 33);
      player.opacity = 0.6;
    } else {
      player.color = k.rgb(79, 195, 247);
      player.opacity = 1;
    }
  });

  k.onKeyPress("space", () => {
    if (gameState.isPaused() || gameState.isDialogueActive()) return;
    maskManager.activateAbility(player);
  });

  // Mask quick-swap keys
  k.onKeyPress("1", () => maskManager.setMask(0));
  k.onKeyPress("2", () => maskManager.setMask(1));
  k.onKeyPress("3", () => maskManager.setMask(2));
  k.onKeyPress("4", () => maskManager.setMask(3));
  k.onKeyPress("tab", () => maskManager.cycleMask());

  return player;
}
