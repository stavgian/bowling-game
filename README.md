# Bowling Game

**Single-player bowling scorekeeper** for the "Bowling-Game – Senior" coding challenge.  
Built with **Angular 22** + **TypeScript** + **Vitest**.

---

## Quick Start

```bash
npm install
npm start       # dev server → http://localhost:4200
npm test        # unit tests
npm run build   # production build
```

---

## Architecture

Three layers, each with a single responsibility:

```
BowlingGameComponent  →  BowlingGameService  →  BowlingGame
     (UI layer)           (app layer)          (domain layer)
```

- **`BowlingGame`** – Pure TypeScript, no Angular. Owns all scoring rules.
- **`BowlingGameService`** – Holds reactive signals, delegates mutations to the domain.
- **`BowlingGameComponent`** – Renders the scoreboard and pin-selector UI.

---

## Design Decisions

### 1. Pure domain class

`BowlingGame` has zero Angular imports. This means:
- It can be unit-tested without `TestBed`
- It could be reused in a Node.js API or a different framework
- Business rules are isolated from framework concerns

### 2. Explicit signal synchronisation

Angular signals work best with immutable data. `BowlingGame` is intentionally mutable (plain class). The solution is to call `syncState()` after every mutation to push fresh values into the signals:

```typescript
roll(pins: number): void {
  this.currentPlayer().game.roll(pins); // in-place mutation
  this.syncState();                     // push to signals
}
```

*Alternative considered: immutable domain (returning new instances). Rejected because it couples the domain to an immutability pattern that belongs at the application layer.*

### 3. Two-level validation

| Level | Where | What it does |
|-------|-------|-------------|
| Domain | `BowlingGame.roll()` | Throws `BowlingError` – the source of truth |
| UI | `isPinButtonEnabled()` | Disables invalid buttons before the user clicks |

**Why both?** Defense in depth. The domain is the guardrail; the UI just makes it friendly.

### 4. DRY via extraction

`frames()` used to repeat strike/spare logic for both normal frames and frame 10. Extracted into:
- `buildStrikeFrame()` – reusable for normal frames
- `buildTwoRollFrame()` – reusable for normal frames
- `buildFinalFrameView()` – frame 10 special case

### 5. Multiplayer-ready shape (Open/Closed Principle)

The service holds `players: Player[]` + `currentIndex`, even though only one player exists today. Adding multiplayer later means *adding* code (new methods, a player-tabs component), not *modifying* `BowlingGame` or the scoreboard.

---

## SOLID Principles

| Principle | How it's applied |
|-----------|-----------------|
| **S**ingle Responsibility | Each class has one reason to change |
| **O**pen/Closed | `Player[]` shape lets multiplayer extend without modification |
| **D**ependency Inversion | Component depends on the service interface, not its internals |

---

## Testing

**18 specs total** – all pass.

| Suite | Count | Focus |
|-------|-------|-------|
| Domain (`bowling-game.spec.ts`) | 16 | Scoring rules + validation |
| App smoke (`app.spec.ts`) | 2 | Angular wiring |

**Key test cases:**
- Gutter game → 0
- All ones → 20
- Single spare with bonus → correct look-ahead
- Single strike with bonus → correct look-ahead
- All spares (5/5 × 10 + bonus 5) → 150
- Perfect game (12 strikes) → 300
- Frame 10: spare with bonus roll
- Frame 10: strike with two bonus rolls
- Frame 9 strike whose look-ahead crosses into frame 10 → flat-roll sequence
- Invalid inputs: negative, > 10, frame sum > 10, roll after game complete

---

## Performance

- **`OnPush` change detection** – component only re-renders when a signal changes
- **`computed()`** – derived state is memoized and lazy
- **Pure functions in templates** (`rollMark`) – no side effects, safe for change detection

---

## What Was Hard?

### Frame 10 edge cases
Frame 10 breaks the "2 rolls per frame" rule. A strike resets the rack, so `strike + 7 + 6 = 23` is valid but `7 + 6 = 13` is not (the second roll can only knock down what's left).  
**Solution:** Separate `buildFinalFrameView()` and `isValidFrame10Roll()` methods with explicit comments.

### Reactivity with a mutable domain object
Angular's signal graph re-evaluates when a signal changes reference. Mutating a field inside an object doesn't change its reference, so `computed(() => game.score())` never re-runs.  
**Solution:** Explicit `syncState()` call documented with the reasoning in the code.

### UI validation operating on partial state
The domain validates a roll *after* the fact. The UI needs to disable buttons *before* the roll. This means the component has to replicate some of the domain logic on top of the current `FrameView`.  
**Solution:** Extracted `isValidNormalFrameRoll()` and `isValidFrame10Roll()` on the component, taking a `FrameView` as input.

---

## Interview Q&A

**Q: Why not put scoring logic in the service?**  
A: Separation of concerns. The domain class is pure TypeScript – it could run in Node.js, be extracted to a shared library, or be ported to another framework without changes.

**Q: Why `Player[]` when there's only one player?**  
A: Open/Closed principle. Adding multiplayer later is additive: new service methods + a player-tabs component. `BowlingGame` and the scoreboard are untouched.

**Q: Why not NgRx?**  
A: YAGNI. The state is small and local; Angular signals handle it cleanly. NgRx would be over-engineering for this scope.

**Q: What would you do next?**  
A: See `NEXT-STEPS.md`.

---

## File Structure

```
src/app/bowling/
├── bowling-game.ts              # Domain – pure TypeScript
├── bowling-game.spec.ts         # Domain tests (16 specs)
├── bowling-game.service.ts      # Application layer – signals + state
├── bowling-game.component.ts    # UI logic
├── bowling-game.component.html  # Template
└── bowling-game.component.css   # Styles
```

Files are co-located by **feature** (not by type like `/services`, `/components`). This scales better as the feature grows.

