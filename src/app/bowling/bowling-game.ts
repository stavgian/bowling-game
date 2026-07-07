/**
 * Pure, framework-agnostic bowling game for a single player.
 *
 * Design decisions:
 * - No Angular dependencies → can be unit-tested in isolation, reused in Node.js
 * - Immutable public API (rolls is readonly) → predictable state
 * - Validation at the boundary (roll method) → fail fast
 * - Frame scoring computed on-demand → no stale state
 *
 * @see https://en.wikipedia.org/wiki/Ten-pin_bowling#Scoring
 */

export type BowlingErrorCode =
  | 'INVALID_PINS'
  | 'FRAME_SUM_EXCEEDED'
  | 'GAME_COMPLETE';

export class BowlingError extends Error {
  constructor(
    readonly code: BowlingErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'BowlingError';
  }
}

const MAX_PINS = 10;
const TOTAL_FRAMES = 10;

/**
 * Snapshot of a single frame as it should appear on a scoresheet.
 * Separates the concept of "rolls in the frame" from "cumulative score"
 * so the UI can show partial frames before bonuses are settled.
 */
export interface FrameView {
  readonly rolls: readonly number[];
  /** Null while strike/spare bonuses are still pending. */
  readonly cumulative: number | null;
}

export class BowlingGame {
  private readonly _rolls: number[] = [];

  /** Flat, ordered sequence of every roll played so far. Useful for persistence. */
  get rolls(): readonly number[] {
    return this._rolls;
  }

  /**
   * Register a roll.
   * @throws {BowlingError} INVALID_PINS – value is not an integer in [0, 10].
   * @throws {BowlingError} FRAME_SUM_EXCEEDED – violates rack constraints.
   * @throws {BowlingError} GAME_COMPLETE – no more rolls are accepted.
   */
  roll(pins: number): void {
    if (!Number.isInteger(pins) || pins < 0 || pins > MAX_PINS) {
      throw new BowlingError(
        'INVALID_PINS',
        `A roll must be an integer between 0 and ${MAX_PINS}, got ${pins}.`,
      );
    }
    if (this.isComplete()) {
      throw new BowlingError(
        'GAME_COMPLETE',
        'Cannot roll: the game is already complete.',
      );
    }
    if (!this.isValidNextRoll(pins)) {
      throw new BowlingError(
        'FRAME_SUM_EXCEEDED',
        `Invalid pin count ${pins} for the current frame (rack has fewer pins standing).`,
      );
    }
    this._rolls.push(pins);
  }

  /** True once all 10 frames (including any frame-10 bonus rolls) are settled. */
  isComplete(): boolean {
    const scores = this.frameScores();
    return scores.length === TOTAL_FRAMES;
  }

  /**
   * Cumulative per-frame scores. Length is 0..10; a frame is only
   * included once its bonuses (if any) are known.
   */
  frameScores(): number[] {
    const out: number[] = [];
    for (const f of this.frames()) {
      if (f.cumulative === null) break;
      out.push(f.cumulative);
    }
    return out;
  }

  /** Total score of the frames that have been fully settled so far. */
  score(): number {
    const scores = this.frameScores();
    return scores.length === 0 ? 0 : scores.at(-1)!;
  }

  /**
   * Per-frame view for UI rendering: the individual rolls played in each
   * frame plus its cumulative score (or null if bonuses are still pending).
   *
   * Why separate from frameScores()? The UI needs to show partial frames
   * (e.g., "X" with no score yet) while bonuses are outstanding.
   */
  frames(): FrameView[] {
    const out: FrameView[] = [];
    let cursor = 0;
    let running = 0;

    for (let frameIndex = 0; frameIndex < TOTAL_FRAMES; frameIndex++) {
      if (cursor >= this._rolls.length) break;

      const isLastFrame = frameIndex === TOTAL_FRAMES - 1;
      if (isLastFrame) {
        const view = this.buildFinalFrameView(cursor, running);
        if (view) out.push(view);
      } else {
        const prevCursor = cursor;
        const result = this.buildNormalFrameView(cursor, running);
        if (result) {
          out.push(result.view);
          cursor = result.nextCursor;
          running = result.nextRunning;
        }
        if (cursor === prevCursor) break; // Frame still awaiting its next roll — nothing more to show.
      }
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // Frame construction helpers (extracted to reduce cognitive complexity)
  // ---------------------------------------------------------------------------

  /**
   * Build a FrameView for frames 1-9.
   * Returns null if the frame hasn't started yet.
   */
  private buildNormalFrameView(
    cursor: number,
    running: number,
  ): { view: FrameView; nextCursor: number; nextRunning: number } | null {
    const first = this._rolls[cursor];
    if (first === undefined) return null;

    if (first === MAX_PINS) {
      return this.buildStrikeFrame(cursor, running);
    }
    return this.buildTwoRollFrame(cursor, running);
  }

  private buildStrikeFrame(
    cursor: number,
    running: number,
  ): { view: FrameView; nextCursor: number; nextRunning: number } {
    const bonus1 = this._rolls[cursor + 1];
    const bonus2 = this._rolls[cursor + 2];
    const settled = bonus1 !== undefined && bonus2 !== undefined;
    const cumulative = settled ? running + MAX_PINS + bonus1 + bonus2 : null;
    return {
      view: { rolls: [MAX_PINS], cumulative },
      nextCursor: cursor + 1,
      nextRunning: cumulative ?? running,
    };
  }

  private buildTwoRollFrame(
    cursor: number,
    running: number,
  ): { view: FrameView; nextCursor: number; nextRunning: number } | null {
    const first = this._rolls[cursor];
    const second = this._rolls[cursor + 1];
    if (second === undefined) {
      return { view: { rolls: [first], cumulative: null }, nextCursor: cursor, nextRunning: running };
    }

    const sum = first + second;
    if (sum === MAX_PINS) {
      const bonus = this._rolls[cursor + 2];
      const settled = bonus !== undefined;
      const cumulative = settled ? running + MAX_PINS + bonus : null;
      return {
        view: { rolls: [first, second], cumulative },
        nextCursor: cursor + 2,
        nextRunning: cumulative ?? running,
      };
    }

    const cumulative = running + sum;
    return {
      view: { rolls: [first, second], cumulative },
      nextCursor: cursor + 2,
      nextRunning: cumulative,
    };
  }

  /**
   * Frame 10 is special: 2 or 3 rolls, no cascading bonuses.
   * The bonus rolls count directly toward the score, not as look-ahead.
   */
  private buildFinalFrameView(cursor: number, running: number): FrameView | null {
    const a = this._rolls[cursor];
    const b = this._rolls[cursor + 1];
    if (a === undefined) return null;
    if (b === undefined) return { rolls: [a], cumulative: null };

    const needsThird = a === MAX_PINS || a + b === MAX_PINS;
    if (needsThird) {
      const c = this._rolls[cursor + 2];
      if (c === undefined) return { rolls: [a, b], cumulative: null };
      return { rolls: [a, b, c], cumulative: running + a + b + c };
    }
    return { rolls: [a, b], cumulative: running + a + b };
  }

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  /**
   * Check whether adding `pins` would leave the frame in a legal state.
   * Core constraint: can't knock down more pins than are standing.
   *
   * Why separate from roll()? Enables UI to disable invalid buttons
   * before the user clicks them.
   */
  private isValidNextRoll(pins: number): boolean {
    let cursor = 0;

    // Walk through frames 1-9
    for (let frame = 0; frame < TOTAL_FRAMES - 1; frame++) {
      const first = this._rolls[cursor];
      if (first === undefined) return true; // First roll of this frame
      if (first === MAX_PINS) {
        cursor += 1;
        continue;
      }
      const second = this._rolls[cursor + 1];
      if (second === undefined) return first + pins <= MAX_PINS;
      cursor += 2;
    }

    // Frame 10
    return this.isValidFrame10Roll(this._rolls.slice(cursor), pins);
  }

  /**
   * Frame 10 validation is subtle: the rack resets after a strike.
   * Extract to keep isValidNextRoll readable.
   */
  private isValidFrame10Roll(tenthFrameRolls: number[], pins: number): boolean {
    if (tenthFrameRolls.length === 0) return true;
    if (tenthFrameRolls.length === 1) {
      const [a] = tenthFrameRolls;
      return a === MAX_PINS ? true : a + pins <= MAX_PINS;
    }
    if (tenthFrameRolls.length === 2) {
      const [a, b] = tenthFrameRolls;
      if (a !== MAX_PINS && a + b !== MAX_PINS) return false; // No third roll
      if (a === MAX_PINS && b === MAX_PINS) return true; // Both strikes → fresh rack
      if (a === MAX_PINS) return b + pins <= MAX_PINS; // Strike then partial
      return true; // Spare → fresh rack
    }
    return false;
  }
}

