# AGENTS.md

Hexagonal Tetris. React 19, Vite, Zustand, TanStack Router.

## Commands

**⚠️ NEVER run `pnpm dev` or `pnpm preview`** — blocking servers hang indefinitely.

```bash
pnpm build              # Lint + TypeScript + Vite build
pnpm lint               # ESLint only
pnpm test               # Run tests
pnpm test:watch         # Watch mode
pnpm generate-routes    # TanStack Router generation
```

## Architecture

```
src/
├── game/        # Pure logic (no React)
├── stores/      # Zustand state
├── hooks/       # React bridges
├── components/  # UI (rendering only)
└── routes/      # TanStack Router (imports from components/)
```

**Strict separation**: Pure logic in `game/`, state in `stores/`, orchestration in hooks, rendering in components. Routes import page components, never contain logic.

## Style

See `.github/copilot-instructions.md` for full patterns:
- No `useEffect` for derived state or event handling
- Use `useEffectEvent` for non-reactive callbacks in Effects
- Global Zustand stores (not factories)
- Selective store subscriptions
- Pure functions in `game/` (state in, state out)
- Event-driven updates (not effects)

Examples:
- Pure logic: `src/game/movement.ts`, `src/game/scoring.ts`
- Store pattern: `src/stores/gameStore.ts`
- Controller hook: `src/hooks/useGameController.ts`
- Component: `src/components/GamePage.tsx`

## Hexagonal Grid

Axial coordinates `(q, r)` primary. Functions in `src/game/hexMath.ts`:
- `axialToPixel` — Screen positioning (flat-top)
- `axialToCube` / `cubeToAxial` — Rotation math
- `axialToKey` / `keyToAxial` — Map serialization

Grid: `Map<string, CellState>` with `"q,r"` keys
Field: 11 columns × 20 rows, spawn at `(5, -2)`

## Game Systems

### Pieces (`src/game/pieces.ts`)

10 tetrahex pieces in `PIECE_METADATA`:
- `I_PIECE`, `S_PIECE`, `Z_PIECE`, `L_PIECE`, `J_PIECE`
- `T_PIECE`, `P_PIECE`, `U_PIECE`, `O_PIECE`, `Y_PIECE`

Metadata: `shape`, `color`, `name`, `hasCenter`, `rotationStates`
- Symmetric (I/S/Z/O): 3 rotation states
- Asymmetric: 6 rotation states
- U_PIECE: `hasCenter: false` (orbits empty center)

Rotation via cube math with wall kicks.

### Movement (`src/game/movement.ts`)

Functions: `moveLeft`, `moveRight`, `moveDown`, `hardDrop`

Lock delay (500ms): enables tucking under overhangs
- Triggers when piece can't move down
- Left/right become diagonal down-left/down-right
- Any movement resets timer
- Cancel if piece can move down again
- Hard drop bypasses entirely

State: `isLocking`, `lockStartTime` in `gameStore.ts`

### Lines (`src/game/lineDetection.ts`)

Two clearable directions:
- `diagonalRight` — constant `r`
- `diagonalLeft` — constant `q+r`

Animation sequence:
1. Blink (200ms)
2. Clear delay (150ms)
3. Bomb explosions if present (200ms + 150ms)
4. Gravity frames (100ms each)
5. Stage delay for cascades (100ms)

### Special Cells (`src/game/specialCells.ts`)

| Type | Effect | Spawn |
|------|--------|-------|
| Bomb | Clear adjacent on line clear | 5% + 0.5%/level (max 15%), cap 3 |
| Multiplier | 2× line score | 3% + 0.4%/level (max 12%), cap 3 |
| Frozen | Two clears needed | Fixed 2.5%, cap 1 |

Special pieces: Bomb (2% base, max 8%), Multiplier (1.5% base, max 6%)
Spawn timing: After gravity cycles

### Scoring (`src/game/scoring.ts`)

- Lock: `10 × level`
- Line clear: `100 × lines × combo × level × cascade × special`
- Combos: 1/3/5/8 (single/double/triple/quad+)
- Cascades: 1/1.5/2/2.5/3 (initial/1st/2nd/3rd/4th+)
- Special: 2× if multiplier cell in line
- Level: +1 per 10 lines (max 20)
- Speed: 1000ms at L1, -50ms/level (min 100ms)

### Controls (`src/hooks/useKeyboard.ts`)

- Arrow Left/Right: Move (50ms debounce), diagonal during lock delay
- Arrow Down: Soft drop (50ms debounce)
- Arrow Up: Rotate (50ms debounce)
- Space: Hard drop (300ms debounce)
- Any key: Start game (idle only)

## State Management

Three stores:
1. `gameStore.ts` — Game state (grid, piece, score, level, lock delay)
2. `highScoreStore.ts` — Persistent via localStorage (`hextris-highscores`)
3. `gameLoopStore.ts` — Timing (elapsed tracking)

Pattern:
```typescript
// Global store
export const useGameStore = create<GameStore>((set, get) => ({ /* ... */ }))

// Selective subscription
const score = useGameStore((state) => state.score)
```

## Flow

1. `useGameLoop` → requestAnimationFrame → `onDrop` at speed interval
2. `handleDrop` → move down or lock
3. Lock → update grid → detect lines → animate → spawn next
4. Spawn fail → game over → check high score

## Key Files

| Path | Purpose |
|------|---------|
| `src/game/types.ts` | All types |
| `src/game/hexMath.ts` | Coordinate system |
| `src/game/pieces.ts` | Piece data + rotation |
| `src/game/movement.ts` | Movement + wall kicks |
| `src/game/collision.ts` | Collision detection |
| `src/game/lineDetection.ts` | Line clearing + gravity |
| `src/game/scoring.ts` | Score calculation |
| `src/game/specialCells.ts` | Special cell logic |
| `src/stores/gameStore.ts` | Main state |
| `src/stores/highScoreStore.ts` | Persistent high score |
| `src/hooks/useGameController.ts` | Game orchestration |
| `src/hooks/useGameLoop.ts` | Auto-drop + lock delay |
| `src/hooks/useKeyboard.ts` | Input handling |
| `src/components/GamePage.tsx` | Main page |

## Conventions

- Path alias: `@/` → `src/`
- Types in `types.ts` (not co-located)
- Pure functions in `game/`
- Selective store subscriptions
- No `useEffect` for derived state
- Route files: imports only, no logic

## Dependencies

- [Zustand v5](https://zustand.docs.pmnd.rs/)
- [TanStack Router](https://tanstack.com/router)
- [Tailwind CSS v4](https://tailwindcss.com/docs)
- [Vite](https://vite.dev/)

## Boundaries

Never:
- Run `pnpm dev` or `pnpm preview`
- Put logic in route files
- Use `useEffect` for derived state
- Create store factories (use global stores)

Always:
- Pure functions in `game/`
- Orchestration in hooks
- Rendering in components
- Follow `.github/copilot-instructions.md`

## Adding Features

New piece: Add to `PIECE_METADATA` in `src/game/pieces.ts` with `shape`, `color`, `name`, `hasCenter`, `rotationStates`.
