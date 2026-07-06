import { BowlingError, BowlingGame } from './bowling-game';

/**
 * Convenience helper: play a whole sequence of rolls.
 * Kept local to the tests to avoid polluting the domain API.
 */
function playAll(game: BowlingGame, rolls: number[]): void {
  for (const pins of rolls) game.roll(pins);
}

describe('BowlingGame – scoring', () => {
  let game: BowlingGame;

  beforeEach(() => {
    game = new BowlingGame();
  });

  it('scores a gutter game (all zeros) as 0', () => {
    playAll(game, Array(20).fill(0));
    expect(game.score()).toBe(0);
    expect(game.isComplete()).toBe(true);
  });

  it('scores all ones as 20', () => {
    playAll(game, Array(20).fill(1));
    expect(game.score()).toBe(20);
  });

  it('applies the spare bonus (one spare then a known roll)', () => {
    playAll(game, [5, 5, 3]);
    // Frame 1: 10 + 3 = 13, Frame 2 partial (3 + ?): only frame 1 is settled.
    expect(game.frameScores()).toEqual([13]);
    // Fill the rest with zeros for a complete score.
    playAll(game, [0, ...Array(16).fill(0)]);
    expect(game.score()).toBe(16); // 13 (spare frame) + 3 (frame 2)
  });

  it('applies the strike bonus (one strike then two known rolls)', () => {
    playAll(game, [10, 4, 3]);
    // Frame 1: 10 + 4 + 3 = 17, Frame 2: 4 + 3 = 7 → cumulative 24
    expect(game.frameScores()).toEqual([17, 24]);
    playAll(game, Array(16).fill(0));
    expect(game.score()).toBe(24);
  });

  it('scores all spares (5/5) with a final bonus of 5 as 150', () => {
    const rolls = [...Array(10).fill([5, 5]).flat(), 5];
    playAll(game, rolls);
    expect(game.score()).toBe(150);
    expect(game.isComplete()).toBe(true);
  });

  it('scores a perfect game (12 strikes) as 300', () => {
    playAll(game, Array(12).fill(10));
    expect(game.score()).toBe(300);
    expect(game.isComplete()).toBe(true);
  });

  it('handles a spare in frame 10 with its bonus roll', () => {
    // Nine open zero frames, then 5 / 5 / 7 in the tenth.
    playAll(game, [...Array(18).fill(0), 5, 5, 7]);
    expect(game.score()).toBe(17);
    expect(game.isComplete()).toBe(true);
  });

  it('handles a strike in frame 10 with two bonus rolls', () => {
    playAll(game, [...Array(18).fill(0), 10, 4, 3]);
    expect(game.score()).toBe(17);
    expect(game.isComplete()).toBe(true);
  });

  it('looks ahead across the frame-9/10 boundary (strike in 9, strike opening 10)', () => {
    // Frames 1-8: gutter. Frame 9: strike. Frame 10: strike, 4, 5.
    // Frame 9 bonus should use the next TWO rolls in the flat sequence
    // (10 from frame 10, then 4), not just "next frame's first roll" naively.
    // Frame 9  = 10 + 10 + 4 = 24
    // Frame 10 = 10 + 4 + 5 = 19
    // Total    = 43
    playAll(game, [...Array(16).fill(0), 10, 10, 4, 5]);
    expect(game.score()).toBe(43);
    expect(game.frameScores().slice(-2)).toEqual([24, 43]);
    expect(game.isComplete()).toBe(true);
  });
});

describe('BowlingGame – validation', () => {
  let game: BowlingGame;

  beforeEach(() => {
    game = new BowlingGame();
  });

  it('rejects a negative roll with INVALID_PINS', () => {
    expect(() => game.roll(-1)).toThrow(BowlingError);
    try {
      game.roll(-1);
    } catch (e) {
      expect((e as BowlingError).code).toBe('INVALID_PINS');
    }
  });

  it('rejects a roll greater than 10 with INVALID_PINS', () => {
    try {
      game.roll(11);
      throw new Error('expected to throw');
    } catch (e) {
      expect(e).toBeInstanceOf(BowlingError);
      expect((e as BowlingError).code).toBe('INVALID_PINS');
    }
  });

  it('rejects a non-integer roll with INVALID_PINS', () => {
    try {
      game.roll(3.5);
      throw new Error('expected to throw');
    } catch (e) {
      expect((e as BowlingError).code).toBe('INVALID_PINS');
    }
  });

  it('rejects a frame whose two rolls would sum to more than 10', () => {
    game.roll(6);
    try {
      game.roll(6);
      throw new Error('expected to throw');
    } catch (e) {
      expect(e).toBeInstanceOf(BowlingError);
      expect((e as BowlingError).code).toBe('FRAME_SUM_EXCEEDED');
    }
  });

  it('rejects any roll attempted after the game is complete', () => {
    for (let i = 0; i < 12; i++) game.roll(10); // perfect game
    expect(game.isComplete()).toBe(true);
    try {
      game.roll(0);
      throw new Error('expected to throw');
    } catch (e) {
      expect(e).toBeInstanceOf(BowlingError);
      expect((e as BowlingError).code).toBe('GAME_COMPLETE');
    }
  });

  it('does not accept a bonus roll in frame 10 when no strike or spare occurred', () => {
    // Nine gutter frames, then 3 + 4 in the tenth (open frame → no bonus roll).
    playAll(game, [...Array(18).fill(0), 3, 4]);
    expect(game.isComplete()).toBe(true);
    try {
      game.roll(5);
      throw new Error('expected to throw');
    } catch (e) {
      expect((e as BowlingError).code).toBe('GAME_COMPLETE');
    }
  });

  it('rejects an invalid second bonus roll after a frame-10 strike', () => {
    // Nine gutter frames, then strike + 6 in the tenth: last roll must be <= 4.
    playAll(game, [...Array(18).fill(0), 10, 6]);
    try {
      game.roll(5); // 6 + 5 > 10 on the same rack
      throw new Error('expected to throw');
    } catch (e) {
      expect((e as BowlingError).code).toBe('FRAME_SUM_EXCEEDED');
    }
  });
});

