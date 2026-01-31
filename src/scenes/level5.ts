// Level 5: THE FACE STEALER - Bullet Hell Survival Boss Fight
// Win Condition: SURVIVE 90 SECONDS
// Boss is invulnerable - player must use correct masks to survive impossible patterns
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

// ============= SURVIVAL BOSS CONSTANTS =============
const TOTAL_FIGHT_DURATION = 90; // seconds

// Phase time windows (countdown from 90)
const PHASE_2_START = 70; // 70s - 50s = Ghost phase
const PHASE_3_START = 50; // 50s - 30s = Freeze phase
const PHASE_4_START = 30; // 30s - 10s = Silence phase
const PHASE_5_START = 10; // 10s - 0s = System Failure

type BossPhase = "intro" | "shield" | "ghost" | "freeze" | "silence" | "system_failure" | "defeated";

// Phase visual configs
const PHASE_CONFIG: Record<string, { color: [number, number, number]; name: string; hint: string }> = {
  shield: { color: [255, 87, 34], name: "THE IRON CURTAIN", hint: "Hold SHIELD [1] to block lasers!" },
  ghost: { color: [156, 39, 176], name: "SPECTRAL GRID", hint: "Use GHOST [2] dash through walls!" },
  freeze: { color: [0, 188, 212], name: "HYPOTHERMIA", hint: "Use FREEZE [3] to slow projectiles!" },
  silence: { color: [80, 40, 120], name: "VOID SCREAMS", hint: "Use SILENCE [4] to delete homing orbs!" },
  system_failure: { color: [255, 50, 50], name: "SYSTEM FAILURE", hint: "QUICK-SWAP MASKS!" }
};

export function level5Scene(k: KaboomCtx): void {
  const map = LEVEL_5_MAP;
  
  setupPauseSystem(k);
  
  const camera = new CameraController(k, {
    zoom: 2.0,
    lerpSpeed: 0.1,
    lookAheadDistance: 20
  });
  camera.setBounds(0, 0, map.width, map.height);

  const maskManager = new MaskManager(k);
  gameState.prepareForLevel(5);
  buildLevel(k, map);

  const playerSpawn = getPlayerSpawn(map);
  const bossSpawnPos = { x: map.width / 2, y: TILE_SIZE * 4 };

  const player = createPlayer(k, playerSpawn.x, playerSpawn.y, maskManager);
  maskManager.initPlayerMask(player);
  camera.snapTo(k.vec2(playerSpawn.x, playerSpawn.y));

  // ============= BOSS STATE =============
  let bossPhase: BossPhase = "intro";
  let survivalTimer = TOTAL_FIGHT_DURATION;
  let fightStarted = false;
  let phaseAttackTimer = 0;

  // ============= CREATE BOSS: The Face Stealer =============
  const boss = k.add([
    k.sprite("boss"),
    k.pos(bossSpawnPos.x, bossSpawnPos.y),
    k.anchor("center"),
    k.area({ scale: k.vec2(0.6, 0.6) }),
    k.color(200, 50, 100),
    k.opacity(1),
    k.scale(2.0),
    k.z(9),
    "boss"
  ]);

  // Boss aura effect
  const bossAura = k.add([
    k.circle(50),
    k.pos(boss.pos),
    k.anchor("center"),
    k.color(255, 50, 50),
    k.opacity(0.4),
    k.z(8),
    "boss-aura"
  ]);

  // ============= UI SETUP =============
  const ui = createGameUI(k);
  
  // Survival Timer Display (large, prominent)
  const timerBg = k.add([
    k.rect(140, 50),
    k.pos(k.width() / 2, 40),
    k.anchor("center"),
    k.color(20, 20, 20),
    k.outline(3, k.rgb(255, 100, 100)),
    k.z(300),
    k.fixed()
  ]);

  const timerText = k.add([
    k.text("90.0", { size: 24 }),
    k.pos(k.width() / 2, 40),
    k.anchor("center"),
    k.color(255, 255, 255),
    k.z(301),
    k.fixed()
  ]);

  // Phase name display
  const phaseText = k.add([
    k.text("PREPARE YOURSELF", { size: 11 }),
    k.pos(k.width() / 2, 75),
    k.anchor("center"),
    k.color(255, 200, 100),
    k.z(302),
    k.fixed()
  ]);

  // Mask hint display
  const maskHintText = k.add([
    k.text("", { size: 9 }),
    k.pos(k.width() / 2, 92),
    k.anchor("center"),
    k.color(200, 200, 255),
    k.z(302),
    k.fixed()
  ]);

  // Boss name
  k.add([
    k.text("THE FACE STEALER", { size: 10 }),
    k.pos(k.width() / 2, 15),
    k.anchor("center"),
    k.color(255, 100, 100),
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

  // ============= PHASE 1: IRON CURTAIN (Shield) =============
  // Wide horizontal lasers + slow bullet walls
  
  function fireFullScreenLaser(): void {
    // Pick random Y positions for 2-3 lasers
    const numLasers = k.rand() > 0.5 ? 3 : 2;
    const laserYs: number[] = [];
    
    for (let i = 0; i < numLasers; i++) {
      laserYs.push(TILE_SIZE * 3 + k.rand(0, map.height - TILE_SIZE * 6));
    }
    
    // Warning indicators
    laserYs.forEach(yPos => {
      const warning = k.add([
        k.rect(map.width, 6),
        k.pos(0, yPos - 3),
        k.color(255, 100, 100),
        k.opacity(0.6),
        k.z(7),
        "laser-warning"
      ]);
      
      // Flash warning
      warning.onUpdate(() => {
        warning.opacity = 0.3 + Math.sin(k.time() * 20) * 0.3;
      });
    });
    
    k.wait(0.8, () => {
      k.destroyAll("laser-warning");
      
      // Fire actual lasers
      laserYs.forEach(yPos => {
        const laser = k.add([
          k.rect(map.width, 24),
          k.pos(0, yPos - 12),
          k.color(255, 50, 50),
          k.opacity(0.9),
          k.area(),
          k.z(8),
          "laser-beam"
        ]);
        
        k.wait(0.6, () => {
          if (laser.exists()) laser.destroy();
        });
      });
    });
  }

  function fireSlowBulletWall(): void {
    // Slow-moving bullet wall from left or right
    const fromLeft = k.rand() > 0.5;
    const bulletCount = 8;
    const spacing = (map.height - TILE_SIZE * 4) / bulletCount;
    
    for (let i = 0; i < bulletCount; i++) {
      const bullet = k.add([
        k.circle(8),
        k.pos(fromLeft ? -10 : map.width + 10, TILE_SIZE * 2 + spacing * i + spacing / 2),
        k.anchor("center"),
        k.color(255, 150, 50),
        k.opacity(0.8),
        k.area({ scale: k.vec2(0.8, 0.8) }),
        k.z(7),
        "slow-bullet",
        { vel: fromLeft ? 40 : -40 }
      ]);
      
      bullet.onUpdate(() => {
        bullet.pos.x += bullet.vel * k.dt();
        if (bullet.pos.x < -20 || bullet.pos.x > map.width + 20) {
          bullet.destroy();
        }
      });
    }
  }

  // ============= PHASE 2: SPECTRAL GRID (Ghost) =============
  // Solid wall barriers with no gaps - must phase through
  
  function fireSkullWall(): void {
    const fromTop = k.rand() > 0.5;
    const wallY = fromTop ? -TILE_SIZE : map.height + TILE_SIZE;
    const speed = 80;
    
    // Create solid wall of "skulls"
    const wallSegments: GameObj<any>[] = [];
    const segmentWidth = TILE_SIZE;
    const numSegments = Math.ceil(map.width / segmentWidth);
    
    for (let i = 0; i < numSegments; i++) {
      const skull = k.add([
        k.rect(segmentWidth - 2, TILE_SIZE * 0.8),
        k.pos(i * segmentWidth + segmentWidth / 2, wallY),
        k.anchor("center"),
        k.color(180, 180, 200),
        k.opacity(0.7),
        k.area(),
        k.z(7),
        "skull-wall",
        { dir: fromTop ? 1 : -1, speed: speed }
      ]);
      wallSegments.push(skull);
    }
    
    // Move wall
    wallSegments.forEach(seg => {
      seg.onUpdate(() => {
        seg.pos.y += seg.dir * seg.speed * k.dt();
        if ((seg.dir > 0 && seg.pos.y > map.height + TILE_SIZE * 2) ||
            (seg.dir < 0 && seg.pos.y < -TILE_SIZE * 2)) {
          seg.destroy();
        }
      });
    });
  }

  function fireHorizontalSkullWall(): void {
    const fromLeft = k.rand() > 0.5;
    const wallX = fromLeft ? -TILE_SIZE : map.width + TILE_SIZE;
    const speed = 90;
    
    const wallSegments: GameObj<any>[] = [];
    const segmentHeight = TILE_SIZE;
    const numSegments = Math.ceil(map.height / segmentHeight);
    
    for (let i = 0; i < numSegments; i++) {
      const skull = k.add([
        k.rect(TILE_SIZE * 0.8, segmentHeight - 2),
        k.pos(wallX, i * segmentHeight + segmentHeight / 2),
        k.anchor("center"),
        k.color(180, 180, 200),
        k.opacity(0.7),
        k.area(),
        k.z(7),
        "skull-wall",
        { dir: fromLeft ? 1 : -1, speed: speed }
      ]);
      wallSegments.push(skull);
    }
    
    wallSegments.forEach(seg => {
      seg.onUpdate(() => {
        seg.pos.x += seg.dir * seg.speed * k.dt();
        if ((seg.dir > 0 && seg.pos.x > map.width + TILE_SIZE * 2) ||
            (seg.dir < 0 && seg.pos.x < -TILE_SIZE * 2)) {
          seg.destroy();
        }
      });
    });
  }

  // ============= PHASE 3: HYPOTHERMIA (Freeze) =============
  // High-speed ice spiral patterns - too fast unless frozen
  
  let spiralAngle = 0;
  let spiralActive = false;
  
  function startIceSpiral(): void {
    spiralActive = true;
    spiralAngle = 0;
  }
  
  function updateIceSpiral(): void {
    if (!spiralActive) return;
    
    // Spawn ice shards in spiral pattern from boss
    const numArms = 4;
    const baseSpeed = gameState.isTimeFrozen() ? 40 : 180; // Much slower when frozen
    
    for (let arm = 0; arm < numArms; arm++) {
      const angle = spiralAngle + (arm * Math.PI * 2 / numArms);
      const shard = k.add([
        k.rect(6, 12),
        k.pos(boss.pos.x, boss.pos.y),
        k.anchor("center"),
        k.color(100, 200, 255),
        k.opacity(0.9),
        k.rotate(k.rad2deg(angle)),
        k.area({ scale: k.vec2(0.7, 0.7) }),
        k.z(7),
        "ice-shard",
        { 
          vel: k.vec2(Math.cos(angle), Math.sin(angle)).scale(baseSpeed),
          frozen: gameState.isTimeFrozen()
        }
      ]);
      
      shard.onUpdate(() => {
        // Update speed based on freeze state
        const currentSpeed = gameState.isTimeFrozen() ? 40 : 180;
        const dir = shard.vel.unit();
        shard.vel = dir.scale(currentSpeed);
        
        shard.pos = shard.pos.add(shard.vel.scale(k.dt()));
        
        // Color change when frozen
        if (gameState.isTimeFrozen()) {
          shard.color = k.rgb(200, 230, 255);
          shard.opacity = 0.6;
        }
        
        if (shard.pos.x < -20 || shard.pos.x > map.width + 20 ||
            shard.pos.y < -20 || shard.pos.y > map.height + 20) {
          shard.destroy();
        }
      });
    }
    
    spiralAngle += 0.15;
  }

  // ============= PHASE 4: VOID SCREAMS (Silence) =============
  // Homing purple orbs that spawn on player
  
  function spawnHomingOrb(): void {
    // Spawn near player position
    const offset = k.vec2(k.rand(-30, 30), k.rand(-30, 30));
    const spawnPos = player.pos.add(offset);
    
    const orb = k.add([
      k.circle(10),
      k.pos(spawnPos),
      k.anchor("center"),
      k.color(150, 50, 200),
      k.opacity(0.9),
      k.outline(2, k.rgb(200, 100, 255)),
      k.area({ scale: k.vec2(0.8, 0.8) }),
      k.z(7),
      "homing-orb",
      { 
        speed: 60,
        lifetime: 6,
        age: 0
      }
    ]);
    
    orb.onUpdate(() => {
      orb.age += k.dt();
      
      // Check if in silence zone
      if (gameState.isPlayerInvisible()) { // Silence mask makes player "invisible" to orbs
        // Orb gets deleted when entering player's null zone radius
        const distToPlayer = orb.pos.dist(player.pos);
        if (distToPlayer < 50) { // Null zone radius
          // Destroy with visual effect
          for (let i = 0; i < 5; i++) {
            const particle = k.add([
              k.circle(4),
              k.pos(orb.pos),
              k.anchor("center"),
              k.color(200, 100, 255),
              k.opacity(1),
              k.z(8)
            ]);
            const pAngle = k.rand(0, Math.PI * 2);
            const pSpeed = k.rand(30, 60);
            particle.onUpdate(() => {
              particle.pos.x += Math.cos(pAngle) * pSpeed * k.dt();
              particle.pos.y += Math.sin(pAngle) * pSpeed * k.dt();
              particle.opacity -= 2 * k.dt();
              if (particle.opacity <= 0) particle.destroy();
            });
          }
          orb.destroy();
          return;
        }
      }
      
      // Home towards player
      const dir = player.pos.sub(orb.pos).unit();
      orb.pos = orb.pos.add(dir.scale(orb.speed * k.dt()));
      
      // Pulsing effect
      orb.opacity = 0.7 + Math.sin(k.time() * 5) * 0.3;
      
      if (orb.age > orb.lifetime) {
        orb.destroy();
      }
    });
  }

  // ============= PHASE 5: SYSTEM FAILURE =============
  // All mechanics overlap - quick swapping required
  
  let systemFailureTimer = 0;
  const SYSTEM_FAILURE_ATTACK_INTERVAL = 1.2;
  
  function systemFailureAttack(): void {
    const attackType = Math.floor(k.rand(0, 4));
    
    switch (attackType) {
      case 0: // Lasers
        fireFullScreenLaser();
        flashPhaseHint("SHIELD!", [255, 87, 34]);
        break;
      case 1: // Walls
        if (k.rand() > 0.5) fireSkullWall();
        else fireHorizontalSkullWall();
        flashPhaseHint("GHOST!", [156, 39, 176]);
        break;
      case 2: // Spirals
        startIceSpiral();
        k.wait(1.5, () => { spiralActive = false; });
        flashPhaseHint("FREEZE!", [0, 188, 212]);
        break;
      case 3: // Homing
        for (let i = 0; i < 3; i++) {
          k.wait(i * 0.3, () => spawnHomingOrb());
        }
        flashPhaseHint("SILENCE!", [150, 50, 200]);
        break;
    }
  }
  
  function flashPhaseHint(text: string, color: [number, number, number]): void {
    const flash = k.add([
      k.text(text, { size: 16 }),
      k.pos(k.width() / 2, k.height() / 2 - 30),
      k.anchor("center"),
      k.color(color[0], color[1], color[2]),
      k.opacity(1),
      k.z(500),
      k.fixed()
    ]);
    
    k.tween(1, 0, 0.8, (v) => { flash.opacity = v; }).onEnd(() => flash.destroy());
  }

  // ============= PHASE MANAGEMENT =============
  function setPhase(newPhase: BossPhase): void {
    bossPhase = newPhase;
    phaseAttackTimer = 0;
    spiralActive = false;
    
    const config = PHASE_CONFIG[newPhase];
    if (config) {
      boss.color = k.rgb(config.color[0], config.color[1], config.color[2]);
      bossAura.color = k.rgb(config.color[0], config.color[1], config.color[2]);
      phaseText.text = config.name;
      phaseText.color = k.rgb(config.color[0], config.color[1], config.color[2]);
      maskHintText.text = config.hint;
    }
    
    // Screen flash on phase change
    const flash = k.add([
      k.rect(k.width(), k.height()),
      k.pos(0, 0),
      k.color(255, 255, 255),
      k.opacity(0.5),
      k.z(1000),
      k.fixed()
    ]);
    k.tween(0.5, 0, 0.3, (v) => { flash.opacity = v; }).onEnd(() => flash.destroy());
    
    camera.shake(8, 0.3);
  }

  function checkPhaseTransition(): void {
    if (bossPhase === "defeated") return;
    
    if (survivalTimer <= 0) {
      triggerVictory();
      return;
    }
    
    // Phase transitions based on time
    if (survivalTimer > PHASE_2_START && bossPhase !== "shield") {
      setPhase("shield");
    } else if (survivalTimer <= PHASE_2_START && survivalTimer > PHASE_3_START && bossPhase !== "ghost") {
      setPhase("ghost");
    } else if (survivalTimer <= PHASE_3_START && survivalTimer > PHASE_4_START && bossPhase !== "freeze") {
      setPhase("freeze");
    } else if (survivalTimer <= PHASE_4_START && survivalTimer > PHASE_5_START && bossPhase !== "silence") {
      setPhase("silence");
    } else if (survivalTimer <= PHASE_5_START && bossPhase !== "system_failure") {
      setPhase("system_failure");
      // Timer turns red
      timerText.color = k.rgb(255, 50, 50);
      timerBg.outline.color = k.rgb(255, 50, 50);
    }
  }

  // ============= VICTORY =============
  function triggerVictory(): void {
    bossPhase = "defeated";
    spiralActive = false;
    
    // Clear all projectiles
    k.destroyAll("laser-beam");
    k.destroyAll("laser-warning");
    k.destroyAll("slow-bullet");
    k.destroyAll("skull-wall");
    k.destroyAll("ice-shard");
    k.destroyAll("homing-orb");
    
    // Boss explodes
    boss.color = k.rgb(255, 255, 255);
    camera.shake(25, 1.5);
    
    // Explosion particles
    for (let i = 0; i < 30; i++) {
      k.wait(i * 0.05, () => {
        const particle = k.add([
          k.circle(k.rand(5, 15)),
          k.pos(boss.pos.add(k.vec2(k.rand(-30, 30), k.rand(-30, 30)))),
          k.anchor("center"),
          k.color(k.rand(200, 255), k.rand(50, 150), k.rand(50, 100)),
          k.opacity(1),
          k.z(20)
        ]);
        
        const pAngle = k.rand(0, Math.PI * 2);
        const pSpeed = k.rand(50, 150);
        particle.onUpdate(() => {
          particle.pos.x += Math.cos(pAngle) * pSpeed * k.dt();
          particle.pos.y += Math.sin(pAngle) * pSpeed * k.dt();
          particle.opacity -= 1.5 * k.dt();
          if (particle.opacity <= 0) particle.destroy();
        });
      });
    }
    
    // Boss fades
    k.tween(1, 0, 1.5, (v) => { 
      boss.opacity = v;
      bossAura.opacity = v * 0.4;
    });
    
    phaseText.text = "SYSTEM OVERLOAD!";
    phaseText.color = k.rgb(100, 255, 100);
    maskHintText.text = "BOSS DESTROYED!";
    timerText.text = "VICTORY!";
    timerText.color = k.rgb(100, 255, 100);
    
    // Award Silence Mask (earned through boss defeat)
    gameState.addCollectedMask(MASKS.silence);
    showAcquiredNotification(k, "SILENCE MASK");
    
    k.wait(3, () => {
      showDialogue(k, LEVEL_DIALOGUES[5].outro!, () => {
        k.go("outro");
      });
    });
  }
  
  // Show ACQUIRED notification
  function showAcquiredNotification(kaboom: KaboomCtx, maskName: string): void {
    const notification = kaboom.add([
      kaboom.text(`✨ ACQUIRED: ${maskName} ✨`, { size: 16 }),
      kaboom.pos(kaboom.width() / 2, kaboom.height() * 0.35),
      kaboom.anchor("center"),
      kaboom.color(255, 215, 0),
      kaboom.opacity(0),
      kaboom.z(2000),
      kaboom.fixed()
    ]);
    
    kaboom.tween(0, 1, 0.4, (val) => { notification.opacity = val; }, kaboom.easings.easeOutQuad);
    kaboom.wait(2.5, () => {
      kaboom.tween(1, 0, 0.6, (val) => { notification.opacity = val; }, kaboom.easings.easeInQuad)
        .onEnd(() => notification.destroy());
    });
  }

  // ============= NULL ZONE VISUAL (Silence) =============
  let nullZoneVisual: GameObj<any> | null = null;
  
  function updateNullZoneVisual(): void {
    if (gameState.isPlayerInvisible()) {
      if (!nullZoneVisual) {
        nullZoneVisual = k.add([
          k.circle(50),
          k.pos(player.pos),
          k.anchor("center"),
          k.color(150, 50, 200),
          k.opacity(0.2),
          k.outline(2, k.rgb(200, 100, 255)),
          k.z(5)
        ]);
      }
      nullZoneVisual.pos = player.pos;
      nullZoneVisual.opacity = 0.15 + Math.sin(k.time() * 4) * 0.1;
    } else {
      if (nullZoneVisual) {
        nullZoneVisual.destroy();
        nullZoneVisual = null;
      }
    }
  }

  // ============= MAIN UPDATE LOOP =============
  k.onUpdate(() => {
    if (gameState.isPaused() || gameState.isDialogueActive()) return;
    if (bossPhase === "defeated") return;

    const dt = k.dt();
    maskManager.update(dt);
    maskManager.updatePlayerMask();
    camera.follow(player, k.mousePos());
    
    // Update boss aura position and pulsing
    bossAura.pos = boss.pos;
    bossAura.radius = 50 + Math.sin(k.time() * 3) * 8;
    
    // Boss floats
    boss.pos.y = bossSpawnPos.y + Math.sin(k.time() * 1.5) * 10;

    if (bossPhase === "intro") {
      updateGameUI(k, ui, maskManager, boss.pos, camera);
      return;
    }

    // Update survival timer
    if (fightStarted) {
      survivalTimer -= dt;
      survivalTimer = Math.max(0, survivalTimer);
      
      // Update timer display
      timerText.text = survivalTimer.toFixed(1);
      
      // Flash timer in system failure
      if (bossPhase === "system_failure") {
        // Timer flashes red
        timerBg.color = k.rgb(40 + Math.sin(k.time() * 8) * 20, 20, 20);
      }
      
      checkPhaseTransition();
    }

    // Phase-specific attacks
    phaseAttackTimer += dt;
    
    switch (bossPhase) {
      case "shield":
        // Lasers every 2.5s + bullet walls every 3s
        if (phaseAttackTimer >= 2.5) {
          phaseAttackTimer = 0;
          if (k.rand() > 0.4) {
            fireFullScreenLaser();
          } else {
            fireSlowBulletWall();
          }
        }
        break;
        
      case "ghost":
        // Skull walls every 2s
        if (phaseAttackTimer >= 2.0) {
          phaseAttackTimer = 0;
          if (k.rand() > 0.5) {
            fireSkullWall();
          } else {
            fireHorizontalSkullWall();
          }
        }
        break;
        
      case "freeze":
        // Continuous ice spirals
        if (!spiralActive && phaseAttackTimer >= 0.5) {
          startIceSpiral();
        }
        if (spiralActive && phaseAttackTimer >= 0.08) {
          phaseAttackTimer = 0;
          updateIceSpiral();
        }
        break;
        
      case "silence":
        // Homing orbs every 0.8s
        if (phaseAttackTimer >= 0.8) {
          phaseAttackTimer = 0;
          spawnHomingOrb();
        }
        break;
        
      case "system_failure":
        // Random attacks every 1.2s
        systemFailureTimer += dt;
        if (systemFailureTimer >= SYSTEM_FAILURE_ATTACK_INTERVAL) {
          systemFailureTimer = 0;
          systemFailureAttack();
        }
        break;
    }

    // Update null zone visual
    updateNullZoneVisual();

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
  
  player.onCollide("laser-beam", () => {
    // Shield blocks lasers
    if (gameState.isPlayerShielding()) return;
    if (gameState.isPlayerEthereal()) return;
    if (gameState.isInvincible()) return;
    
    gameState.damagePlayer(1);
    camera.shake(12, 0.3);
    gameState.setInvincible(true);
    k.wait(1.5, () => { gameState.setInvincible(false); });
    
    if (gameState.isPlayerDead()) k.go("gameover");
  });

  player.onCollide("slow-bullet", (bullet: GameObj<any>) => {
    if (gameState.isPlayerShielding()) {
      bullet.destroy();
      return;
    }
    if (gameState.isPlayerEthereal()) return;
    if (gameState.isInvincible()) return;
    
    gameState.damagePlayer(1);
    camera.shake(8, 0.2);
    bullet.destroy();
    gameState.setInvincible(true);
    k.wait(1, () => { gameState.setInvincible(false); });
    
    if (gameState.isPlayerDead()) k.go("gameover");
  });

  player.onCollide("skull-wall", () => {
    // Ghost phases through
    if (gameState.isPlayerEthereal()) return;
    if (gameState.isInvincible()) return;
    
    gameState.damagePlayer(1);
    camera.shake(10, 0.3);
    gameState.setInvincible(true);
    k.wait(1.5, () => { gameState.setInvincible(false); });
    
    if (gameState.isPlayerDead()) k.go("gameover");
  });

  player.onCollide("ice-shard", (shard: GameObj<any>) => {
    if (gameState.isPlayerEthereal()) return;
    if (gameState.isPlayerShielding()) {
      shard.destroy();
      return;
    }
    if (gameState.isInvincible()) return;
    
    gameState.damagePlayer(1);
    camera.shake(6, 0.2);
    shard.destroy();
    gameState.setInvincible(true);
    k.wait(1, () => { gameState.setInvincible(false); });
    
    if (gameState.isPlayerDead()) k.go("gameover");
  });

  player.onCollide("homing-orb", (orb: GameObj<any>) => {
    // Silence deletes orbs in null zone (handled in update)
    if (gameState.isPlayerEthereal()) return;
    if (gameState.isInvincible()) return;
    
    gameState.damagePlayer(1);
    camera.shake(8, 0.3);
    orb.destroy();
    gameState.setInvincible(true);
    k.wait(1, () => { gameState.setInvincible(false); });
    
    if (gameState.isPlayerDead()) k.go("gameover");
  });

  player.onCollide("boss", () => {
    if (gameState.isPlayerEthereal()) return;
    if (gameState.isInvincible()) return;

    gameState.damagePlayer(1);
    camera.shake(10, 0.3);
    
    const knockDir = player.pos.sub(boss.pos).unit();
    player.pos = player.pos.add(knockDir.scale(50));
    player.pos.x = k.clamp(player.pos.x, TILE_SIZE * 1.5, map.width - TILE_SIZE * 1.5);
    player.pos.y = k.clamp(player.pos.y, TILE_SIZE * 1.5, map.height - TILE_SIZE * 1.5);

    gameState.setInvincible(true);
    k.wait(1.5, () => { gameState.setInvincible(false); });

    if (gameState.isPlayerDead()) k.go("gameover");
  });

  // ============= START FIGHT =============
  showDialogue(k, LEVEL_DIALOGUES[5].intro, () => {
    gameState.setDialogueActive(false);
    showMaskDescription(k, 5);
    
    k.wait(3.5, () => {
      fightStarted = true;
      setPhase("shield"); // Start with Phase 1: Iron Curtain
    });
  });
}

// ============= BUILD LEVEL =============
function buildLevel(k: KaboomCtx, map: typeof LEVEL_5_MAP): void {
  const mapWidth = map.tiles[0].length * TILE_SIZE;
  const mapHeight = map.tiles.length * TILE_SIZE;

  // Dark ominous background
  k.add([
    k.rect(mapWidth, mapHeight),
    k.pos(0, 0),
    k.color(20, 15, 30),
    k.z(-2)
  ]);

  // Pulsing arcane circle in center
  const arcaneCircle = k.add([
    k.circle(80),
    k.pos(mapWidth / 2, mapHeight / 2),
    k.anchor("center"),
    k.color(100, 50, 80),
    k.opacity(0.15),
    k.z(-1)
  ]);
  
  arcaneCircle.onUpdate(() => {
    arcaneCircle.radius = 80 + Math.sin(k.time() * 2) * 20;
    arcaneCircle.opacity = 0.1 + Math.sin(k.time() * 3) * 0.05;
  });

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
  // Player state machine
  let currentState: "idle" | "run" = "idle";
  let currentDirection: "down" | "up" | "right" | "left" = "down";
  let lastDirection: "down" | "up" | "right" | "left" = "down";

  const player = k.add([
    k.sprite("vu-idle"),
    k.pos(x, y),
    k.anchor("center"),
    k.area({ scale: k.vec2(0.8, 0.8) }),
    k.body(),
    k.opacity(1),
    k.z(10),
    "player",
    {
      speed: 130, // Slightly faster for bullet hell dodging
      dir: k.vec2(0, 0)
    }
  ]);

  try { player.play("idle-down"); } catch {}

  // Mask overlay (Paper Doll system)
  const maskOverlay = k.add([
    k.sprite("mask-shield"),
    k.pos(x, y - 4),
    k.anchor("center"),
    k.scale(0.35),
    k.opacity(0),
    k.z(11),
    "mask-overlay"
  ]);

  function getDirection(dir: { x: number; y: number }): "down" | "up" | "right" | "left" {
    if (Math.abs(dir.x) > Math.abs(dir.y)) return dir.x > 0 ? "right" : "left";
    else if (dir.y !== 0) return dir.y > 0 ? "down" : "up";
    return lastDirection;
  }

  player.onUpdate(() => {
    if (gameState.isPaused() || gameState.isDialogueActive()) return;

    const dir = k.vec2(0, 0);
    if (k.isKeyDown("left") || k.isKeyDown("a")) dir.x -= 1;
    if (k.isKeyDown("right") || k.isKeyDown("d")) dir.x += 1;
    if (k.isKeyDown("up") || k.isKeyDown("w")) dir.y -= 1;
    if (k.isKeyDown("down") || k.isKeyDown("s")) dir.y += 1;

    const isMoving = dir.len() > 0;
    const newState = isMoving ? "run" : "idle";

    if (isMoving) {
      currentDirection = getDirection(dir);
      lastDirection = currentDirection;
      player.dir = dir.unit();
      player.move(player.dir.scale(player.speed));
    }

    if (newState !== currentState) {
      currentState = newState;
      const spriteName = newState === "run" ? "vu-run" : "vu-idle";
      const animName = `${newState === "run" ? "run" : "idle"}-${currentDirection}`;
      try { player.use(k.sprite(spriteName)); player.play(animName); } catch {}
    }

    // Mask overlay update
    maskOverlay.pos.x = player.pos.x;
    maskOverlay.pos.y = player.pos.y - 4 + (currentState === "run" ? Math.sin(k.time() * 15) * 0.5 : 0);
    const currentMask = gameState.getPlayerState().currentMask;
    if (currentMask) {
      maskOverlay.opacity = 0.9;
      const maskSprites: Record<string, string> = { shield: "mask-shield", ghost: "mask-ghost", frozen: "mask-frozen", silence: "mask-silence" };
      try { maskOverlay.use(k.sprite(maskSprites[currentMask.id] || "mask-shield")); maskOverlay.scale = k.vec2(0.35, 0.35); } catch {}
    } else {
      maskOverlay.opacity = 0;
    }

    const margin = TILE_SIZE * 1.5;
    player.pos.x = k.clamp(player.pos.x, margin, LEVEL_5_MAP.width - margin);
    player.pos.y = k.clamp(player.pos.y, margin, LEVEL_5_MAP.height - margin);

    // Visual feedback based on state (opacity only - sprite handles visuals)
    if (gameState.isPlayerShielding()) {
      player.opacity = 1;
    } else if (gameState.isPlayerEthereal()) {
      player.opacity = 0.4;
    } else if (gameState.isTimeFrozen()) {
      player.opacity = 1;
    } else if (gameState.isPlayerInvisible()) {
      player.opacity = 0.7;
    } else {
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
