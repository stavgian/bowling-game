import { BowlingGame } from './src/app/bowling/bowling-game';

console.log('=== Bowling Game Simulation: Mixed Game ===\n');

const game = new BowlingGame();

// Game plan:
// Frame 1: 7, 2 (open) → 9
// Frame 2: 10 (strike) → pending until frame 3
// Frame 3: 5, 5 (spare) → pending until frame 4
// Frame 4: 3, 4 (open) → 7
// Frame 5: 10 (strike) → pending
// Frame 6: 10 (strike) → pending
// Frame 7: 4, 5 (open) → 9
// Frame 8: 0, 0 (gutter) → 0
// Frame 9: 8, 1 (open) → 9
// Frame 10: 10, 5, 3 (strike + bonus) → 18

const rolls = [
  7, 2,    // Frame 1: 9
  10,      // Frame 2: strike
  5, 5,    // Frame 3: spare
  3, 4,    // Frame 4: 7
  10,      // Frame 5: strike
  10,      // Frame 6: strike
  4, 5,    // Frame 7: 9
  0, 0,    // Frame 8: 0
  8, 1,    // Frame 9: 9
  10, 5, 3 // Frame 10: strike + 2 bonus
];

let rollNumber = 0;
for (const pins of rolls) {
  rollNumber++;
  game.roll(pins);

  const frames = game.frames();
  const score = game.score();

  console.log(`\nAfter roll #${rollNumber} (${pins} pins):`);
  console.log(`  Total score: ${score}`);
  console.log(`  Frames with settled scores:`);

  frames.forEach((frame, i) => {
    const rollMarks = frame.rolls.map((r, ri) => {
      if (r === 10) return 'X';
      if (ri > 0 && frame.rolls[ri - 1] !== 10 && frame.rolls[ri - 1] + r === 10) return '/';
      return r === 0 ? '-' : String(r);
    }).join(' ');

    const cumulative = frame.cumulative !== null ? frame.cumulative : 'pending';
    console.log(`    Frame ${i + 1}: [${rollMarks}] → ${cumulative}`);
  });
}

console.log('\n=== Final Score ===');
console.log(`Total: ${game.score()}`);
console.log(`Complete: ${game.isComplete()}`);

// Expected calculation:
// Frame 1: 7+2 = 9         → cumulative 9
// Frame 2: 10+5+5 = 20     → cumulative 29
// Frame 3: 10+3 = 13       → cumulative 42
// Frame 4: 3+4 = 7         → cumulative 49
// Frame 5: 10+10+4 = 24    → cumulative 73
// Frame 6: 10+4+5 = 19     → cumulative 92
// Frame 7: 4+5 = 9         → cumulative 101
// Frame 8: 0+0 = 0         → cumulative 101
// Frame 9: 8+1 = 9         → cumulative 110
// Frame 10: 10+5+3 = 18    → cumulative 128

console.log('\nExpected final score: 128');

