// Mask Manager - Handles mask abilities and cooldowns
import { KaboomCtx, GameObj } from "kaboom";
import { MaskData } from "../types";
import { gameState } from "../state";
import { MASKS } from "../constants";

// Color tints for each mask ability - UPDATED for v2.0
const MASK_TINTS: Record<string, { r: number; g: number; b: number }> = {
  shield: { r: 255, g: 87, b: 34 },     // Orange - Reflective Guard
  ghost: { r: 156, g: 39, b: 176 },     // Purple - Phase Shift
  frozen: { r: 0, g: 188, b: 212 },     // Cyan - Flash Freeze
  silence: { r: 33, g: 33, b: 33 }      // Dark Grey - Null Zone
};

// Mask sprite names
const MASK_SPRITES: Record<string, string> = {
  silence: "mask-silence",
  ghost: "mask-ghost",
  frozen: "mask-frozen",
  shield: "mask-shield"
};

// Scale factors for 400px SVG assets
const MASK_SVG_SIZE = 400; // Source SVG size

// Target pixel sizes
export const UI_ICON_SIZE = 64;        // UI icons at bottom of screen
export const FACE_MASK_SIZE = 24;      // Mask on player's face
export const CUTSCENE_MASK_SIZE = 80;  // Masks in cutscene

// Calculated scales
export const MASK_SCALE_UI = UI_ICON_SIZE / MASK_SVG_SIZE;         // 0.16
export const MASK_SCALE_PLAYER = FACE_MASK_SIZE / MASK_SVG_SIZE;   // 0.06
export const MASK_SCALE_CUTSCENE = CUTSCENE_MASK_SIZE / MASK_SVG_SIZE; // 0.2

export class MaskManager {
  private k: KaboomCtx;
  private cooldowns: Map<string, number> = new Map();
  private activeEffects: Map<string, boolean> = new Map();
  
  // Screen overlay for color grading
  private screenOverlay: GameObj<any> | null = null;
  
  // Reference to player's mask sprite child
  private playerMaskSprite: GameObj<any> | null = null;
  private currentMaskId: string | null = null;

  constructor(k: KaboomCtx) {
    this.k = k;
    
    // Initialize cooldowns for all masks
    Object.keys(MASKS).forEach(maskId => {
      this.cooldowns.set(maskId, 0);
      this.activeEffects.set(maskId, false);
    });
    
    // Create screen overlay for color grading effects
    this.createScreenOverlay();
  }
  
  // Create the screen-wide color overlay
  private createScreenOverlay(): void {
    this.screenOverlay = this.k.add([
      this.k.rect(this.k.width(), this.k.height()),
      this.k.pos(0, 0),
      this.k.color(0, 0, 0),
      this.k.opacity(0),
      this.k.z(1000),
      this.k.fixed(),
      "screen-overlay"
    ]);
  }
  
  // Initialize player mask sprite (call after player creation)
  initPlayerMask(player: GameObj<any>): void {
    // Create invisible mask sprite on player's face
    this.playerMaskSprite = player.add([
      this.k.sprite("mask-silence"), // Default, will be hidden
      this.k.anchor("center"),
      this.k.pos(0, -2), // Slightly above center (face position)
      this.k.scale(MASK_SCALE_PLAYER, MASK_SCALE_PLAYER),
      this.k.opacity(0), // Hidden until mask equipped
      this.k.z(11), // Above player sprite (player is z(10))
      "player-mask"
    ]);
    
    // Force scale on every frame (SVG sprites can reset scale)
    this.playerMaskSprite.onUpdate(() => {
      if (this.playerMaskSprite) {
        this.playerMaskSprite.scale.x = MASK_SCALE_PLAYER;
        this.playerMaskSprite.scale.y = MASK_SCALE_PLAYER;
      }
    });
  }
  
  // Update the visible mask on player
  updatePlayerMask(): void {
    const mask = gameState.getPlayerState().currentMask;
    
    if (!mask) {
      // No mask equipped - hide sprite
      if (this.playerMaskSprite) {
        this.playerMaskSprite.opacity = 0;
      }
      this.currentMaskId = null;
      return;
    }
    
    // Update mask sprite if changed
    if (this.currentMaskId !== mask.id && this.playerMaskSprite) {
      const spriteName = MASK_SPRITES[mask.id];
      if (spriteName) {
        this.playerMaskSprite.use(this.k.sprite(spriteName));
        // Force scale immediately
        this.playerMaskSprite.scale.x = MASK_SCALE_PLAYER;
        this.playerMaskSprite.scale.y = MASK_SCALE_PLAYER;
        this.playerMaskSprite.opacity = 0.9;
        this.currentMaskId = mask.id;
      }
    }
  }
  
  // Activate screen tint for mask ability
  private activateScreenTint(maskId: string, duration: number): void {
    if (!this.screenOverlay) return;
    
    const tint = MASK_TINTS[maskId];
    if (!tint) return;
    
    this.screenOverlay.color = this.k.rgb(tint.r, tint.g, tint.b);
    
    // Fade in
    this.k.tween(
      0,
      0.2,
      0.15,
      (val) => { if (this.screenOverlay) this.screenOverlay.opacity = val; },
      this.k.easings.easeOutQuad
    );
    
    // Fade out after duration
    this.k.wait(duration - 0.3, () => {
      this.k.tween(
        0.2,
        0,
        0.3,
        (val) => { if (this.screenOverlay) this.screenOverlay.opacity = val; },
        this.k.easings.easeInQuad
      );
    });
  }

  // Get current cooldown remaining for a mask
  getCooldown(maskId: string): number {
    return this.cooldowns.get(maskId) || 0;
  }

  // Check if mask ability can be used
  canUseAbility(maskId: string): boolean {
    return (this.cooldowns.get(maskId) || 0) <= 0;
  }

  // Check if effect is currently active
  isEffectActive(maskId: string): boolean {
    return this.activeEffects.get(maskId) || false;
  }

  // Update cooldowns (call every frame)
  update(dt: number): void {
    this.cooldowns.forEach((cooldown, maskId) => {
      if (cooldown > 0) {
        this.cooldowns.set(maskId, Math.max(0, cooldown - dt));
      }
    });
  }

  // Activate mask ability
  activateAbility(player: GameObj<any>): void {
    const mask = gameState.getPlayerState().currentMask;
    if (!mask) return;
    if (!this.canUseAbility(mask.id)) return;

    // Set cooldown
    this.cooldowns.set(mask.id, mask.cooldown);
    this.activeEffects.set(mask.id, true);

    // Apply effect based on mask type
    switch (mask.id) {
      case "silence":
        this.activateSilence(player, mask);
        break;
      case "ghost":
        this.activateGhost(player, mask);
        break;
      case "frozen":
        this.activateFrozen(mask);
        break;
      case "shield":
        this.activateShield(player, mask);
        break;
    }
  }

  // Mask of Silence - Null Zone (disable enemy abilities)
  private activateSilence(_player: GameObj<any>, mask: MaskData): void {
    gameState.setInvisible(true); // Repurposed: now disables enemy abilities
    
    // Create null zone visual (dark expanding circle)
    const nullZone = this.k.add([
      this.k.circle(10),
      this.k.pos(_player.pos),
      this.k.anchor("center"),
      this.k.color(33, 33, 33),
      this.k.opacity(0.5),
      this.k.z(5),
      "null-zone"
    ]);
    
    // Expand the zone
    this.k.tween(10, 80, 0.3, (val) => {
      if (nullZone.exists()) {
        nullZone.radius = val;
      }
    }, this.k.easings.easeOutQuad);
    
    // Screen tint
    this.activateScreenTint("silence", mask.duration);

    this.showAbilityText("NULL ZONE!");

    // End effect after duration
    this.k.wait(mask.duration, () => {
      gameState.setInvisible(false);
      if (nullZone.exists()) nullZone.destroy();
      this.activeEffects.set(mask.id, false);
    });
  }

  // Ghost Mask - Phase Shift (dash through barriers)
  private activateGhost(player: GameObj<any>, mask: MaskData): void {
    gameState.setEthereal(true);
    
    // Get dash direction from player's facing direction
    const dashDir = player.dir && player.dir.len() > 0 
      ? player.dir.unit() 
      : this.k.vec2(1, 0);
    
    const DASH_DISTANCE = 100;
    const dashTarget = player.pos.add(dashDir.scale(DASH_DISTANCE));
    
    // Phase shift visual - player becomes translucent
    if (player.opacity !== undefined) {
      player.opacity = 0.3;
    }
    
    // Dash tween
    this.k.tween(
      player.pos.clone(),
      dashTarget,
      mask.duration,
      (val) => { player.pos = val; },
      this.k.easings.easeOutQuad
    );
    
    // Ghost trail effect
    for (let i = 0; i < 5; i++) {
      this.k.wait(i * 0.08, () => {
        const trail = this.k.add([
          this.k.circle(8),
          this.k.pos(player.pos),
          this.k.anchor("center"),
          this.k.color(156, 39, 176),
          this.k.opacity(0.5),
          this.k.z(4)
        ]);
        this.k.tween(0.5, 0, 0.3, (val) => {
          if (trail.exists()) trail.opacity = val;
        }).onEnd(() => trail.destroy());
      });
    }
    
    // Screen tint
    this.activateScreenTint("ghost", mask.duration);

    this.showAbilityText("PHASE SHIFT!");

    // End effect after duration
    this.k.wait(mask.duration, () => {
      gameState.setEthereal(false);
      if (player.opacity !== undefined) {
        player.opacity = 1;
      }
      this.activeEffects.set(mask.id, false);
    });
  }

  // Frozen Mask - Flash Freeze (freeze enemies into platforms)
  private activateFrozen(mask: MaskData): void {
    gameState.setTimeFrozen(true);
    
    // Create freeze burst visual
    const burst = this.k.add([
      this.k.circle(20),
      this.k.pos(this.k.width() / 2, this.k.height() / 2),
      this.k.anchor("center"),
      this.k.color(0, 188, 212),
      this.k.opacity(0.6),
      this.k.z(50),
      this.k.fixed()
    ]);
    
    this.k.tween(20, 300, 0.4, (val) => {
      if (burst.exists()) burst.radius = val;
    }, this.k.easings.easeOutQuad);
    
    this.k.tween(0.6, 0, 0.5, (val) => {
      if (burst.exists()) burst.opacity = val;
    }).onEnd(() => burst.destroy());
    
    // Screen tint
    this.activateScreenTint("frozen", mask.duration);

    this.showAbilityText("FLASH FREEZE!");

    // End effect after duration
    this.k.wait(mask.duration, () => {
      gameState.setTimeFrozen(false);
      this.activeEffects.set(mask.id, false);
    });
  }

  // Shield Mask - Reflective Guard (absorb and repel)
  private activateShield(player: GameObj<any>, mask: MaskData): void {
    gameState.setShielding(true);
    
    // Create shield barrier visual
    const shield = player.add([
      this.k.circle(20),
      this.k.anchor("center"),
      this.k.pos(0, 0),
      this.k.color(255, 87, 34),
      this.k.opacity(0.4),
      this.k.outline(3, this.k.rgb(255, 150, 100)),
      this.k.z(12),
      "player-shield"
    ]);
    
    // Pulse effect
    let pulseTime = 0;
    const pulseUpdate = shield.onUpdate(() => {
      pulseTime += this.k.dt() * 4;
      shield.opacity = 0.3 + Math.sin(pulseTime) * 0.2;
    });
    
    // Screen tint
    this.activateScreenTint("shield", mask.duration);

    this.showAbilityText("REFLECTIVE GUARD!");

    // End effect after duration - trigger repel blast
    this.k.wait(mask.duration, () => {
      gameState.setShielding(false);
      pulseUpdate.cancel();
      
      // Repel blast visual
      this.k.tween(20, 60, 0.2, (val) => {
        if (shield.exists()) shield.radius = val;
      }).onEnd(() => {
        if (shield.exists()) shield.destroy();
      });
      
      // Push back enemies
      this.k.get("enemy").forEach(enemy => {
        if (enemy.pos.dist(player.pos) < 80) {
          const pushDir = enemy.pos.sub(player.pos).unit();
          enemy.pos = enemy.pos.add(pushDir.scale(50));
        }
      });
      
      this.activeEffects.set(mask.id, false);
    });
  }

  // Show ability activation text
  private showAbilityText(text: string): void {
    const textObj = this.k.add([
      this.k.text(text, { size: 32 }),
      this.k.pos(this.k.width() / 2, this.k.height() / 2 - 50),
      this.k.anchor("center"),
      this.k.color(255, 255, 100),
      this.k.opacity(1),
      this.k.z(100),
      "ability-text"
    ]);

    // Fade out animation
    this.k.tween(
      1,
      0,
      0.5,
      (val) => { textObj.opacity = val; },
      this.k.easings.easeOutQuad
    ).onEnd(() => {
      textObj.destroy();
    });

    // Move up animation
    this.k.tween(
      textObj.pos.y,
      textObj.pos.y - 50,
      0.5,
      (val) => { textObj.pos.y = val; },
      this.k.easings.easeOutQuad
    );
  }

  // Switch to next collected mask (for boss level)
  switchToNextMask(): void {
    const masks = gameState.getCollectedMasks();
    if (masks.length === 0) return;

    const currentMask = gameState.getPlayerState().currentMask;
    if (!currentMask) {
      gameState.setCurrentMask(masks[0]);
      return;
    }

    const currentIndex = masks.findIndex(m => m.id === currentMask.id);
    const nextIndex = (currentIndex + 1) % masks.length;
    gameState.setCurrentMask(masks[nextIndex]);
  }

  // Switch to specific mask by index
  switchToMaskByIndex(index: number): void {
    const masks = gameState.getCollectedMasks();
    if (index >= 0 && index < masks.length) {
      gameState.setCurrentMask(masks[index]);
    }
  }

  // Set mask by index (alias for switchToMaskByIndex)
  setMask(index: number): void {
    this.switchToMaskByIndex(index);
  }

  // Cycle to next mask
  cycleMask(): void {
    const masks = gameState.getCollectedMasks();
    if (masks.length === 0) return;
    
    const currentMask = gameState.getPlayerState().currentMask;
    let currentIndex = currentMask ? masks.findIndex(m => m.id === currentMask.id) : -1;
    const nextIndex = (currentIndex + 1) % masks.length;
    gameState.setCurrentMask(masks[nextIndex]);
  }

  // Get cooldown percentage (0-1) for UI
  getCooldownPercent(maskId: string): number {
    const mask = MASKS[maskId];
    if (!mask) return 0;
    
    const remaining = this.cooldowns.get(maskId) || 0;
    return remaining / mask.cooldown;
  }

  // Reset all cooldowns
  reset(): void {
    this.cooldowns.forEach((_, maskId) => {
      this.cooldowns.set(maskId, 0);
      this.activeEffects.set(maskId, false);
    });
    
    gameState.setInvisible(false);
    gameState.setEthereal(false);
    gameState.setShielding(false);
    gameState.setTimeFrozen(false);
  }
}
