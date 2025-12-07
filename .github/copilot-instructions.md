# React Patterns

## useEffect — When NOT to Use

- **Derived state** → Calculate during render
- **Expensive calculation** → `useMemo`
- **Reset on prop change** → `key` prop
- **Shared event logic** → Extract function
- **User events** → Event handlers
- **Cascading updates** → Single handler
- **Notify parent** → Call in event

```tsx
// ❌ Derived state in effect
const [fullName, setFullName] = useState('')
useEffect(() => setFullName(firstName + ' ' + lastName), [firstName, lastName])

// ✅ Calculate during render
const fullName = firstName + ' ' + lastName

// ❌ Cascading effects
useEffect(() => { if (card?.gold) setGoldCount(c => c + 1) }, [card])
useEffect(() => { if (goldCount > 3) setRound(r => r + 1) }, [goldCount])

// ✅ Single update in handler
function handleCard(nextCard) {
  setCard(nextCard)
  if (nextCard.gold && goldCount === 3) {
    setRound(round + 1)
    setGoldCount(0)
  }
}
```

## useEffect — When to Use

- External system sync (network, browser APIs, third-party libs)
- Data fetching (always include cleanup for race conditions)
- Subscriptions (prefer `useSyncExternalStore`)

```tsx
// ✅ Fetch with race condition handling
useEffect(() => {
  let ignore = false
  fetch(`/api/search?q=${query}`)
    .then(res => res.json())
    .then(data => { if (!ignore) setResults(data) })
  return () => { ignore = true }
}, [query])
```

**Rule**: User interaction → handler, component display → effect, can calculate → render

Ref: [react.dev/learn/you-might-not-need-an-effect](https://react.dev/learn/you-might-not-need-an-effect)

---

## useEffectEvent — Latest Values Without Re-runs

**Status**: Stable in React 19.2 (October 2025)

Extracts non-reactive logic from Effects. Always accesses latest props/state without triggering Effect re-runs.

### When to Use

- **Callbacks in Effects** needing latest values without causing re-runs
- **Event listeners** where callback shouldn't re-subscribe
- **External sync** reading values that shouldn't be reactive

```tsx
// ❌ Manual ref pattern
const callbackRef = useRef(callback)
useEffect(() => { callbackRef.current = callback }, [callback])
useEffect(() => {
  const interval = setInterval(() => callbackRef.current(), 1000)
  return () => clearInterval(interval)
}, [])

// ✅ useEffectEvent
const onTick = useEffectEvent(() => callback())
useEffect(() => {
  const interval = setInterval(onTick, 1000)
  return () => clearInterval(interval)
}, [])

// ✅ Event listeners
const onMoveLeft = useEffectEvent(() => controls.onMoveLeft())
useEffect(() => {
  if (!enabled) return
  const handler = (e) => { if (e.key === 'ArrowLeft') onMoveLeft() }
  window.addEventListener('keydown', handler)
  return () => window.removeEventListener('keydown', handler)
}, [enabled]) // Only re-subscribes when enabled changes
```

### When NOT to Use

- **Hiding dependencies** → Real dependencies must be in array
- **Outside Effects** → Use regular functions in event handlers
- **Props to children** → Use `useCallback` instead

**Rule**: Effect Event for latest non-reactive values, regular dependency for reactive values

Ref: [react.dev/reference/react/useEffectEvent](https://react.dev/reference/react/useEffectEvent)

---

## Zustand — State Management

### When to Use

- Complex state with multiple actions
- State shared across components
- Persistent state (use persist middleware)
- External non-React access (getState/subscribe)

```tsx
// ✅ Global store
const useGameStore = create<GameStore>((set) => ({
  grid: new Map(),
  score: 0,
  level: 1,
  updateScore: (points) => set((state) => ({ score: state.score + points })),
  clearLine: (row) => set((state) => ({
    grid: newGrid,
    score: state.score + 100
  }))
}))

// ✅ Selective subscription
const score = useGameStore((state) => state.score)

// ✅ Persist middleware
const useHighScoreStore = create<HighScoreStore>()(
  persist(
    (set) => ({ scores: {}, setHighScore: (mode, score) => set(/* ... */) }),
    { name: 'game-highscores', skipHydration: false }
  )
)

// ✅ External access
function gameLoop() {
  const elapsed = useGameLoopStore.getState().elapsed
}
```

### Patterns

- **Global store** (not factory pattern)
- **Selective subscriptions** (not entire store)
- **Multiple stores** for separation of concerns
- **Immer middleware** for nested updates

```tsx
// ❌ Factory pattern
const createGameStore = (mode: GameMode) => create<GameStore>(/* ... */)

// ✅ Global with dynamic init
const useGameStore = create<GameStore>((set) => ({
  gameMode: undefined,
  initGame: (mode) => set({ gameMode: mode })
}))
```

**Rule**: Complex shared state → Zustand, simple component state → useState

Ref: [zustand.docs.pmnd.rs](https://zustand.docs.pmnd.rs/)

---

## Commands

**⚠️ NEVER run `pnpm dev` or `pnpm preview`** — blocking servers hang forever

```bash
pnpm build        # Lint + TypeScript + Vite build
pnpm lint         # ESLint only
```
