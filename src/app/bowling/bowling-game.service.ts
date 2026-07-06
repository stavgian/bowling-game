import { Injectable, computed, signal } from '@angular/core';
import { BowlingGame, FrameView } from './bowling-game';

/**
 * A player owns exactly one {@link BowlingGame}. The service holds a list of
 * players (initialized with a single anonymous one) so that future
 * multiplayer support is a purely additive change – no domain rewrite needed.
 *
 * Design decision: Why Player[]? Open/Closed principle – the system is
 * "closed" to modification (domain logic unchanged) but "open" to extension
 * (add more players, turn rotation, etc.).
 */
export interface Player {
  readonly id: string;
  readonly name: string;
  readonly game: BowlingGame;
}

/**
 * Thin Angular wrapper around {@link BowlingGame}. Contains no scoring logic –
 * it merely exposes reactive views over the current player's game state and
 * forwards mutating calls to the domain object.
 *
 * Why explicit signals instead of computed(() => game.score())? Because
 * BowlingGame is a mutable class and Angular can't detect in-place mutations.
 * We explicitly sync after each mutation to trigger reactivity.
 */
@Injectable({ providedIn: 'root' })
export class BowlingGameService {
  private readonly _players = signal<Player[]>([this.createPlayer('Player 1')]);
  private readonly _currentIndex = signal(0);

  readonly players = this._players.asReadonly();
  readonly currentIndex = this._currentIndex.asReadonly();
  readonly currentPlayer = computed(() => this._players()[this._currentIndex()]);

  // Derived game state as signals (updated explicitly after mutations).
  private readonly _frameScores = signal<number[]>([]);
  private readonly _frames = signal<FrameView[]>([]);
  private readonly _score = signal<number>(0);
  private readonly _isComplete = signal<boolean>(false);
  private readonly _rolls = signal<readonly number[]>([]);

  readonly frameScores = this._frameScores.asReadonly();
  readonly frames = this._frames.asReadonly();
  readonly score = this._score.asReadonly();
  readonly isComplete = this._isComplete.asReadonly();
  readonly rolls = this._rolls.asReadonly();

  constructor() {
    this.syncState();
  }

  /** Register a roll for the current player. Rethrows any {@link BowlingError}. */
  roll(pins: number): void {
    this.currentPlayer().game.roll(pins);
    this.syncState();
  }

  /** Start a new game, keeping the current roster of players. */
  reset(): void {
    this._players.set(this._players().map((p) => this.createPlayer(p.name)));
    this._currentIndex.set(0);
    this.syncState();
  }

  /**
   * Pull fresh values from the domain and update all derived signals.
   * Why not just use computed()? Because BowlingGame mutates in place;
   * Angular can't detect the mutation unless we explicitly notify it.
   */
  private syncState(): void {
    const game = this.currentPlayer().game;
    this._frameScores.set(game.frameScores());
    this._frames.set(game.frames());
    this._score.set(game.score());
    this._isComplete.set(game.isComplete());
    this._rolls.set([...game.rolls]);
  }

  private createPlayer(name: string): Player {
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `p-${Math.random().toString(36).slice(2)}`;
    return { id, name, game: new BowlingGame() };
  }
}

