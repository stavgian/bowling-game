import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { BowlingError, FrameView } from './bowling-game';
import { BowlingGameService } from './bowling-game.service';

const TOTAL_FRAMES = 10;
const MAX_PINS = 10;
const EMPTY_FRAME: FrameView = { rolls: [], cumulative: null };

/**
 * Minimal bowling game UI component.
 *
 * Responsibilities:
 * - Render the scoreboard (frame-by-frame roll marks + cumulative scores)
 * - Provide a pin-selector button grid with contextual validation
 * - Show a dynamic status message guiding the user
 *
 * Design decisions:
 * - OnPush change detection → performance (only reacts to signal changes)
 * - No FormsModule → simpler, no two-way binding overhead
 * - Validation logic delegated to helpers → Single Responsibility Principle
 * - Status message extracted → easier to test and understand
 */
@Component({
  selector: 'app-bowling-game',
  standalone: true,
  imports: [],
  templateUrl: './bowling-game.component.html',
  styleUrl: './bowling-game.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BowlingGameComponent {
  private readonly service = inject(BowlingGameService);

  readonly errorMessage = signal<string | null>(null);

  readonly frames = this.service.frames;
  readonly score = this.service.score;
  readonly isComplete = this.service.isComplete;

  /** Always 10 slots so the scoreboard renders a stable grid. */
  readonly frameSlots = computed<readonly FrameView[]>(() => {
    const played = this.frames();
    return Array.from({ length: TOTAL_FRAMES }, (_, i) => played[i] ?? EMPTY_FRAME);
  });

  /** 1-based index of the frame the next roll will land in (capped at 10). */
  readonly currentFrame = computed(() => {
    const played = this.frames();
    if (played.length === 0) return 1;
    const lastIndex = played.length;
    const last = played[lastIndex - 1];
    const isFinalFrame = lastIndex === TOTAL_FRAMES;
    const lastIsFull = isFinalFrame
      ? this.isComplete()
      : this.isFrameFull(last);
    return Math.min(lastIsFull ? lastIndex + 1 : lastIndex, TOTAL_FRAMES);
  });

  /** Buttons 0-10 for pin selection. */
  readonly pinButtons = Array.from({ length: MAX_PINS + 1 }, (_, i) => i);

  /** Status message describing the current game state. */
  readonly statusMessage = computed(() => this.buildStatusMessage());

  /**
   * Check if a given pin count is a valid next roll.
   * Invalid buttons are disabled in the UI to prevent user error.
   */
  isPinButtonEnabled(pins: number): boolean {
    if (this.isComplete()) return false;

    const played = this.frames();
    if (played.length === 0) return true;

    const frameIndex = this.currentFrame() - 1;
    const frameData = played[frameIndex];
    if (!frameData) return true;

    const isFinalFrame = frameIndex === TOTAL_FRAMES - 1;
    return isFinalFrame
      ? this.isValidFrame10Roll(frameData, pins)
      : this.isValidNormalFrameRoll(frameData, pins);
  }

  selectPin(pins: number): void {
    try {
      this.service.roll(pins);
      this.errorMessage.set(null);
    } catch (e) {
      if (e instanceof BowlingError) {
        this.errorMessage.set(e.message);
      } else {
        this.errorMessage.set('Unexpected error.');
      }
    }
  }

  reset(): void {
    this.service.reset();
    this.errorMessage.set(null);
  }

  /**
   * Bowling-scoresheet mark for a single roll within a frame slot:
   * `X` = strike, `/` = spare, `-` = miss, otherwise the digit itself.
   */
  rollMark(frame: FrameView, rollIndex: number): string {
    const pins = frame.rolls[rollIndex];
    if (pins === undefined) return '';
    if (pins === MAX_PINS) return 'X';
    if (rollIndex > 0) {
      const prev = frame.rolls[rollIndex - 1];
      if (prev !== MAX_PINS && prev + pins === MAX_PINS) return '/';
    }
    return pins === 0 ? '-' : String(pins);
  }

  // ---------------------------------------------------------------------------
  // Helpers (extracted to keep public methods readable)
  // ---------------------------------------------------------------------------

  private isFrameFull(frame: FrameView): boolean {
    const firstRoll = frame.rolls[0];
    return firstRoll === MAX_PINS || frame.rolls.length === 2;
  }

  private isValidNormalFrameRoll(frame: FrameView, pins: number): boolean {
    if (frame.rolls.length === 0) return true;
    const first = frame.rolls[0];
    if (first === MAX_PINS) return true; // Already in next frame
    if (frame.rolls.length === 1) return first + pins <= MAX_PINS;
    return true; // Frame complete, in next frame
  }

  private isValidFrame10Roll(frame: FrameView, pins: number): boolean {
    const rollCount = frame.rolls.length;
    if (rollCount === 0) return true;

    const [a, b] = frame.rolls;
    if (rollCount === 1) {
      return a === MAX_PINS ? true : a + pins <= MAX_PINS;
    }

    if (rollCount === 2) {
      if (a !== MAX_PINS && a + b !== MAX_PINS) return false; // No third roll
      if (a === MAX_PINS && b === MAX_PINS) return true; // Both strikes
      if (a === MAX_PINS) return b + pins <= MAX_PINS; // Strike then partial
      return true; // Spare → fresh rack
    }

    return false;
  }

  private buildStatusMessage(): string {
    if (this.isComplete()) {
      return `🎉 Game complete! Final score: ${this.score()}`;
    }

    const frame = this.currentFrame();
    const played = this.frames();
    const frameData = played[frame - 1];

    if (frame === TOTAL_FRAMES) {
      return this.buildFrame10Status(frameData);
    }

    return this.buildNormalFrameStatus(frame, frameData);
  }

  private buildFrame10Status(frameData: FrameView | undefined): string {
    if (!frameData || frameData.rolls.length === 0) {
      return `🎳 Frame 10 — First roll (strike = 2 bonus rolls!)`;
    }

    const [first, second] = frameData.rolls;
    const rollCount = frameData.rolls.length;

    if (rollCount === 1) {
      return first === MAX_PINS
        ? `🎯 Frame 10 — Strike! Bonus roll #1 of 2`
        : `🎳 Frame 10 — Second roll (${MAX_PINS - first} pins standing)`;
    }

    if (rollCount === 2) {
      if (first === MAX_PINS) return `🎯 Frame 10 — Strike! Bonus roll #2 of 2`;
      if (first + second === MAX_PINS) return `✨ Frame 10 — Spare! One bonus roll`;
      return `🎳 Frame 10 — Complete`;
    }

    return `🎳 Frame 10 — Final roll`;
  }

  private buildNormalFrameStatus(frame: number, frameData: FrameView | undefined): string {
    if (!frameData || frameData.rolls.length === 0) {
      return `🎳 Frame ${frame} — First roll (strike ends frame!)`;
    }

    const first = frameData.rolls[0];
    if (first === MAX_PINS) {
      return `🎳 Frame ${frame} — First roll (strike ends frame!)`;
    }

    if (frameData.rolls.length === 1) {
      const standing = MAX_PINS - first;
      return `🎳 Frame ${frame} — Second roll (${standing} pin${standing === 1 ? '' : 's'} standing)`;
    }

    return `🎳 Frame ${frame} — Ready to roll`;
  }
}

