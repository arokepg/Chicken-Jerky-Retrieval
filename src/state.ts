// Global Game State Manager
import { GameState, PlayerState, MaskData } from "./types";
import { INITIAL_GAME_STATE, INITIAL_PLAYER_STATE, MASKS } from "./constants";

class GameStateManager {
  private state: GameState;

  constructor() {
    this.state = this.deepCopy(INITIAL_GAME_STATE);
  }

  private deepCopy<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }

  // Getters
  getState(): GameState {
    return this.state;
  }

  getPlayerState(): PlayerState {
    return this.state.player;
  }

  getCurrentLevel(): number {
    return this.state.currentLevel;
  }

  isPaused(): boolean {
    return this.state.isPaused;
  }

  isDialogueActive(): boolean {
    return this.state.isDialogueActive;
  }

  isTimeFrozen(): boolean {
    return this.state.timeFrozen;
  }

  // Setters
  setCurrentLevel(level: number): void {
    this.state.currentLevel = level;
  }

  setPaused(paused: boolean): void {
    this.state.isPaused = paused;
  }

  setDialogueActive(active: boolean): void {
    this.state.isDialogueActive = active;
  }

  setTimeFrozen(frozen: boolean): void {
    this.state.timeFrozen = frozen;
  }

  // Player state modifiers
  setPlayerHealth(health: number): void {
    this.state.player.health = Math.max(0, Math.min(health, this.state.player.maxHealth));
  }

  damagePlayer(amount: number = 1): void {
    if (!this.state.player.isInvincible && !this.state.player.isEthereal) {
      this.state.player.health = Math.max(0, this.state.player.health - amount);
    }
  }

  healPlayer(amount: number = 1): void {
    this.state.player.health = Math.min(
      this.state.player.maxHealth,
      this.state.player.health + amount
    );
  }

  isPlayerDead(): boolean {
    return this.state.player.health <= 0;
  }

  // Mask management
  setCurrentMask(mask: MaskData | null): void {
    this.state.player.currentMask = mask;
  }

  addCollectedMask(mask: MaskData): void {
    if (!this.state.player.collectedMasks.find(m => m.id === mask.id)) {
      this.state.player.collectedMasks.push(mask);
    }
  }

  getCollectedMasks(): MaskData[] {
    return this.state.player.collectedMasks;
  }

  hasMask(maskId: string): boolean {
    return this.state.player.collectedMasks.some(m => m.id === maskId);
  }

  // Status effects
  setInvisible(invisible: boolean): void {
    this.state.player.isInvisible = invisible;
  }

  setEthereal(ethereal: boolean): void {
    this.state.player.isEthereal = ethereal;
  }

  setShielding(shielding: boolean): void {
    this.state.player.isShielding = shielding;
  }

  setInvincible(invincible: boolean): void {
    this.state.player.isInvincible = invincible;
  }

  isInvincible(): boolean {
    return this.state.player.isInvincible;
  }

  isPlayerInvisible(): boolean {
    return this.state.player.isInvisible;
  }

  isPlayerEthereal(): boolean {
    return this.state.player.isEthereal;
  }

  isPlayerShielding(): boolean {
    return this.state.player.isShielding;
  }

  // Reset functions
  resetPlayerState(): void {
    // Keep collected masks but reset everything else
    const masks = this.state.player.collectedMasks;
    this.state.player = this.deepCopy(INITIAL_PLAYER_STATE);
    this.state.player.collectedMasks = masks;
  }

  resetGameState(): void {
    this.state = this.deepCopy(INITIAL_GAME_STATE);
  }

  // Level progression
  nextLevel(): void {
    this.state.currentLevel++;
    this.resetPlayerState();
    
    // Award mask for previous level
    const maskForLevel: Record<number, string> = {
      1: 'silence',
      2: 'ghost',
      3: 'frozen',
      4: 'shield'
    };
    
    const prevLevel = this.state.currentLevel - 1;
    if (maskForLevel[prevLevel]) {
      this.addCollectedMask(MASKS[maskForLevel[prevLevel]]);
    }
  }

  // Prepare for level (set appropriate mask)
  prepareForLevel(level: number): void {
    this.state.currentLevel = level;
    this.state.player.health = 3; // All levels use 3 HP
    this.state.player.maxHealth = 3;
    
    // Set mask based on level
    const maskForLevel: Record<number, string> = {
      1: 'silence',
      2: 'ghost',
      3: 'frozen',
      4: 'shield'
    };

    // For levels 1-4, use the mask from previous level (if any)
    if (level === 1) {
      this.state.player.currentMask = null;
    } else if (level <= 4) {
      // Use the mask earned from the previous level
      const prevMaskId = maskForLevel[level - 1];
      if (prevMaskId && this.hasMask(prevMaskId)) {
        this.state.player.currentMask = MASKS[prevMaskId];
      }
    } else if (level === 5) {
      // Boss level - can use all masks
      if (this.state.player.collectedMasks.length > 0) {
        this.state.player.currentMask = this.state.player.collectedMasks[0];
      }
    }
  }
}

// Export singleton instance
export const gameState = new GameStateManager();
