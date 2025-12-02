# AGENTS.md

Hexagonal Tetris game built with React 19, Vite, Zustand, and TanStack Router.

## Architecture Overview

```
src/
├── game/           # Pure game logic (no React)
├── stores/         # Zustand state stores
├── hooks/          # React hooks
├── components/     # React UI components
└── routes/         # TanStack Router pages
```

### Core Layers

**Game Logic (`src/game/`)** — Pure TypeScript functions, no side effects. Handles hexagonal math, collision detection, line clearing, piece rotation, movement, scoring, and special cells. All functions take state as input, return new state.

**State Stores (`src/stores/`)** — Zustand stores manage all game state. Three stores with distinct responsibilities:
- `gameStore.ts` — Core game state (grid, current piece, score, level, status, lock delay state)
- `highScoreStore.ts` — Persistent high score via Zustand persist middleware (localStorage key: `hextris-highscores`)
- `gameLoopStore.ts` — Game timing state (elapsed time tracking for external use)

**Hooks (`src/hooks/`)** — React bridges:
- `useGameController.ts` — Game orchestration (movement, input, game loop, line clearing, special cells, lock delay, high score)
- `useGameLoop.ts` — requestAnimationFrame loop for auto-drop timing and lock delay expiration
- `useKeyboard.ts` — Keyboard input with debouncing (uses `useEffectEvent` for non-reactive callbacks)

**Routes (`src/routes/`)** — Route definition only. No components, no logic. Routes import page components from `components/`.

**Components (`src/components/`)** — Pure rendering, minimal logic:
- `GamePage.tsx` — Main game page layout, composes other components, consumes `useGameController`
- `GameBoard.tsx` — Main grid display with ghost piece preview
- `HexGrid.tsx` / `HexCell.tsx` — Hexagonal cell rendering with special cell glow effects
- `NextPiece.tsx` — Next piece preview display
- `ScoreDisplay.tsx` — Score/level/lines UI
- `GameOverModal.tsx` — Game over overlay with restart and high score display
- `PieceShowcase.tsx` — All piece shapes display (shown on idle screen)
- `SpecialBlockShowcase.tsx` — Special block types display with pulsing animations

### Hexagonal Coordinate System

Uses **axial coordinates** (q, r) as primary system. Key conversions in `hexMath.ts`:
- `axialToPixel` — Position hexes on screen (flat-top orientation)
- `axialToCube` / `cubeToAxial` — For rotation math (constraint: x + y + z = 0)
- `axialToKey` / `keyToAxial` — String serialization for Map keys

Grid cells stored in `Map<string, CellState>` with keys in `"q,r"` format.

**Field dimensions**: 11 columns × 20 rows rectangular grid. Spawn position at top center (q=5, r=-2).

### Piece System

10 tetrahex pieces defined in `pieces.ts`. Each piece has metadata in `PIECE_METADATA`:
- `shape: PieceShape` — Offsets from origin (center at 0,0)
- `hasCenter: boolean` — Whether origin cell is filled (U_PIECE has false, orbits around center)
- `rotationStates: number` — 3 for symmetric pieces (I, S, Z, O), 6 for asymmetric
- `color: string` — Piece color
- `name: string` — Display name

Piece types: `I_PIECE`, `S_PIECE`, `Z_PIECE`, `L_PIECE`, `J_PIECE`, `T_PIECE`, `P_PIECE`, `U_PIECE`, `O_PIECE`, `Y_PIECE`

Rotation uses cube coordinate math: convert to cube, cycle coordinates, convert back. Wall kicks attempt neighbor offsets when rotation would cause collision.

### Line Detection

Two clearable directions in `lineDetection.ts`:
- `diagonalRight` — Constant r value
- `diagonalLeft` — Constant q+r value

After clearing, gravity is applied in discrete animation frames. Line clear animation sequence:
1. Blink effect (cells turn white, 200ms)
2. Clear delay (150ms)
3. Bomb explosions (if any bombs in cleared lines): blink + clear (200ms + 150ms)
4. Gravity frames (100ms each)
5. Stage delay between multi-stage clears (100ms)

### Special Cells System

Defined in `specialCells.ts`. Three special cell types with visual effects in `renderConstants.ts`:

| Type | Color | Effect | Spawn Rate |
|------|-------|--------|------------|
| Bomb | Red (#ff4444) | Clears all adjacent filled cells when cleared | 5% base + 0.5%/level (max 15%) |
| Multiplier | Gold (#ffd700) | 2× score for lines containing it | 3% base + 0.4%/level (max 12%) |
| Frozen | Ice Blue (#88ddff) | Requires two clears to remove | Fixed 2.5% |

**Maximum counts on field**: Bomb: 3, Multiplier: 3, Frozen: 1

**Special Pieces**: Entire pieces can spawn as bomb (2% base, max 8%) or multiplier (1.5% base, max 6%). All cells inherit the special type when locked.

**Spawn timing**: Special cells spawn on existing locked cells after each gravity cycle (after piece lock or cascade clear).

### Lock Delay & Tucking

Lock delay (500ms) allows player to slide pieces under overhangs before locking:
- When piece lands (can't move down), lock delay starts
- During lock delay, left/right movement uses diagonal down-left/down-right instead of horizontal
- Any successful movement resets the lock delay timer
- If piece can move down again (via rotation/movement), lock delay cancels
- Hard drop bypasses lock delay entirely

State tracked in `gameStore.ts`: `isLocking`, `lockStartTime`

### Scoring System

Defined in `scoring.ts`:
- **Lock points**: 10 × level (awarded when piece locks)
- **Line clear**: 100 × lines × combo multiplier × level × cascade multiplier × special multiplier
- **Combo multipliers**: 1 (single), 3 (double), 5 (triple), 8 (quad+)
- **Cascade multipliers**: 1 (initial), 1.5 (1st cascade), 2 (2nd), 2.5 (3rd), 3 (4th+)
- **Special multiplier**: 2× if any multiplier cell in cleared line
- **Level progression**: Level up every 10 lines, max level 20
- **Speed**: 1000ms at level 1, decreases 50ms per level, minimum 100ms

### Controls

Keyboard input handled in `useKeyboard.ts` with debouncing:
- **Arrow Left/Right** — Move horizontally (50ms debounce), diagonal during lock delay
- **Arrow Down** — Soft drop (50ms debounce)
- **Arrow Up** — Rotate clockwise (50ms debounce)
- **Space** — Hard drop (300ms debounce)
- **Any key** — Start game (when idle)

## Development Workflow

**⚠️ NEVER run `pnpm dev` or `pnpm preview`** — these commands start blocking servers that will hang the terminal indefinitely. Use `pnpm build` and `pnpm lint` for validation.

```bash
pnpm build        # Lint + TypeScript check + Vite build
pnpm lint         # ESLint
```

Route generation:
```bash
pnpm generate-routes   # One-time route generation
pnpm watch-routes      # Watch mode for routes
```

## Code Patterns

### State Management

Follow global store pattern, not factory pattern:

```typescript
// ✅ Single global store
export const useGameStore = create<GameStore>((set, get) => ({
  score: 0,
  updateScore: (points) => set((state) => ({ score: state.score + points }))
}))

// Use selective subscriptions
const score = useGameStore((state) => state.score)
```

### Derived State

Calculate during render, not in effects:

```typescript
// ✅ Derived during render
const cells = useMemo(() => {
  const result = []
  for (const [key, cellState] of grid) {
    if (cellState.filled) result.push({ coord: keyToAxial(key), color: cellState.color })
  }
  return result
}, [grid])
```

### Pure Game Functions

Game logic functions take state, return new state:

```typescript
// ✅ Pure function pattern
export function moveDown(piece: Piece, grid: GridState, fieldShape: FieldShape): Piece | null {
  const newPiece = { ...piece, position: { q: piece.position.q, r: piece.position.r + 1 } }
  return isValidPiecePosition(newPiece, grid, fieldShape).valid ? newPiece : null
}
```

### Event-Driven Updates

Handle in event handlers, not effects:

```typescript
// ✅ Score update in event handler
function handleDrop() {
  lockPiece(currentPiece)
  const points = calculateLockScore(level)
  updateScore(points)  // Immediate, not via effect
}
```

## Key Files

| File | Purpose |
|------|---------|
| `src/game/types.ts` | All type definitions |
| `src/game/hexMath.ts` | Coordinate conversions |
| `src/game/pieces.ts` | Piece shapes, metadata, and rotation |
| `src/game/collision.ts` | Collision detection |
| `src/game/movement.ts` | Piece movement (left/right/down/hardDrop) and wall kicks |
| `src/game/lineDetection.ts` | Line clearing and gravity logic |
| `src/game/scoring.ts` | Score calculation and level progression |
| `src/game/specialCells.ts` | Special cell spawning, effects, and constants |
| `src/game/renderConstants.ts` | Visual constants (colors, sizes, glow effects) |
| `src/game/gameModes.ts` | Field shape and spawn position constants |
| `src/stores/gameStore.ts` | Main game state |
| `src/stores/highScoreStore.ts` | Persistent high score with localStorage |
| `src/hooks/useGameController.ts` | Game orchestration, input handling, game loop |
| `src/hooks/useKeyboard.ts` | Keyboard input with debouncing |
| `src/hooks/useGameLoop.ts` | requestAnimationFrame-based auto-drop and lock delay |
| `src/components/GamePage.tsx` | Main game page component |
| `src/routes/index.tsx` | Route definition (imports GamePage) |

## Integration Points

**Game Loop Flow**:
1. `useGameLoop` runs requestAnimationFrame, calls `onDrop` when speed interval elapsed
2. `handleDrop` in `useGameController` moves piece down or locks if blocked
3. On lock: update grid, detect lines, animate clears, spawn next piece
4. On spawn failure: game over, update high score if applicable

**Store Communication**:
- `useGameController` reads from all three stores
- `gameStore.startGame()` resets `gameLoopStore.elapsed` via direct `getState()` call
- `highScoreStore` persists automatically via Zustand persist middleware

## External Dependencies

- [Zustand v5](https://zustand.docs.pmnd.rs/) — State management
- [TanStack Router](https://tanstack.com/router) — File-based routing
- [Tailwind CSS v4](https://tailwindcss.com/docs) — Styling
- [Vite](https://vite.dev/) — Build tooling

## Conventions

- Path alias `@/` maps to `src/`
- Types in `types.ts`, not co-located
- Game logic pure, stores handle side effects
- Components subscribe selectively to stores
- No useEffect for derived state or event handling
- Use `useEffectEvent` for callbacks inside Effects that need latest values without triggering re-runs
- **Route files must be simple** — rendering and layout only, no business logic. Extract orchestration to controller hooks (`useGameController`), game logic to `game/`, state to stores. Page components go in `components/`, routes only import and render them
- See `.github/copilot-instructions.md` for React/Zustand patterns

## Adding New Features

**New piece type**: Add to `PIECE_METADATA` in `pieces.ts`, include shape offsets, color, name, hasCenter, and rotationStates.
