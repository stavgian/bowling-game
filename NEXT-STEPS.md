# Next Steps

What I'd tackle next, in rough priority order.

---

## Multiplayer

The service already holds `players: Player[]` and `currentIndex`, so the additive work is:

1. Add `addPlayer(name: string)`, `removePlayer(id: string)` to `BowlingGameService`
2. Add a player-tabs strip above the scoreboard (new component, no changes to existing ones)
3. **Turn rotation** in the service: after each complete frame, advance `currentIndex`;
   game ends when every player's `game.isComplete()` is `true`
4. `BowlingGame.rolls` already exposes the flat roll sequence, so serialising each player's
   game state for persistence is a one-liner

---

## Persistence

`BowlingGame` exposes `rolls: readonly number[]`. A complete save state is:

```typescript
{ players: [{ id, name, rolls }], currentIndex }
```

Deserialise by replaying rolls into a fresh `BowlingGame`. Start with `localStorage`;
swap to `IndexedDB` or a backend later without changing the domain.

---

## Undo / Roll History View

- Add `undo(): void` to `BowlingGame` (pop the last roll from `_rolls`)
- Show a roll-history row below the scoreboard with traditional marks (X, /, –, digit)
- Good candidate for a separate `RollHistoryComponent`

---

## Better Input UX

The current pin-pad is functional. Polish ideas:
- Animate the pins visually (knocked-down vs standing) to give tactile feedback
- Show a pin diagram that greys out fallen pins on the second roll
- Keyboard shortcut: pressing 0–9 selects that pin count; Enter/Space rolls

---

## Accessibility

- ARIA roles on the scoreboard (`role="grid"`, `role="row"`, `role="gridcell"`)
- Announce roll results to screen readers via a live region (`aria-live="polite"`)
- Ensure colour contrast meets WCAG AA for disabled buttons
- Focus management after reset (move focus to first enabled pin button)

---

## E2E Tests

Unit tests cover the domain well. Add Playwright E2E tests for:
- Full game via the UI (click through all rolls)
- Spare + bonus flow
- Frame 10 edge cases through the UI
- Invalid state cannot be reached via the UI (all invalid buttons disabled)
- Reset flow

---

## Internationalisation (i18n)

The challenge spec is in German, so i18n is a realistic next step:
- Wire `@angular/localize`
- Extract the status message strings into translation units
- Add `de` and `en` locales as a starting point

---

## CI / Pre-commit

- GitHub Actions workflow: install → build → test on every pull request
- Pre-commit hook: `ng lint` + `ng test --watch=false`
- Branch protection: require green CI before merge

