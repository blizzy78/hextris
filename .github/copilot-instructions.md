# React useEffect Best Practices

## When NOT to Use useEffect

### 1. Transforming Data for Rendering
Calculate during render instead of using effects.

```tsx
// ❌ BAD - Unnecessary effect and state
const [fullName, setFullName] = useState('')
useEffect(() => {
  setFullName(firstName + ' ' + lastName)
}, [firstName, lastName])

// ✅ GOOD - Calculate during render
const fullName = firstName + ' ' + lastName
```

### 2. Caching Expensive Calculations
Use `useMemo` instead of effects.

```tsx
// ❌ BAD - Effect for derived state
const [filtered, setFiltered] = useState([])
useEffect(() => {
  setFiltered(expensiveFilter(items))
}, [items])

// ✅ GOOD - Use useMemo
const filtered = useMemo(() => expensiveFilter(items), [items])
```

### 3. Resetting State When Props Change
Use the `key` prop instead of effects.

```tsx
// ❌ BAD - Effect to reset state
useEffect(() => {
  setComment('')
}, [userId])

// ✅ GOOD - Use key prop to reset component
<Profile userId={userId} key={userId} />
```

### 4. Sharing Logic Between Event Handlers
Extract shared logic to a function instead of effects.

```tsx
// ❌ BAD - Logic in effect
useEffect(() => {
  if (product.isInCart) showNotification()
}, [product])

// ✅ GOOD - Shared function
function buyProduct() {
  addToCart(product)
  showNotification()
}
```

### 5. Handling User Events
Put event-specific logic in event handlers, not effects.

```tsx
// ❌ BAD - Effect runs on mount and every change
useEffect(() => {
  if (jsonToSubmit) post('/api', jsonToSubmit)
}, [jsonToSubmit])

// ✅ GOOD - Handle in event handler
function handleSubmit(e) {
  e.preventDefault()
  post('/api', data)
}
```

### 6. Chains of State Updates
Calculate all state in a single event handler or during render.

```tsx
// ❌ BAD - Multiple cascading effects
useEffect(() => {
  if (card?.gold) setGoldCount(c => c + 1)
}, [card])
useEffect(() => {
  if (goldCount > 3) setRound(r => r + 1)
}, [goldCount])

// ✅ GOOD - Single update in handler
function handleCard(nextCard) {
  setCard(nextCard)
  if (nextCard.gold && goldCount === 3) {
    setRound(round + 1)
    setGoldCount(0)
  }
}
```

### 7. Notifying Parent Components
Call parent callbacks in event handlers, not effects.

```tsx
// ❌ BAD - Delayed notification via effect
useEffect(() => { onChange(isOn) }, [isOn])

// ✅ GOOD - Immediate notification in handler
function handleToggle(nextIsOn) {
  setIsOn(nextIsOn)
  onChange(nextIsOn)
}
```

## When TO Use useEffect

### 1. Synchronizing with External Systems
Network requests, browser APIs, third-party libraries.

```tsx
// ✅ Analytics on component mount
useEffect(() => {
  post('/analytics', { event: 'page_view' })
}, [])
```

### 2. Fetching Data
When data needs to stay synchronized with props/state.

```tsx
// ✅ Fetch when query changes
useEffect(() => {
  let ignore = false
  fetch(`/api/search?q=${query}`)
    .then(res => res.json())
    .then(data => { if (!ignore) setResults(data) })
  return () => { ignore = true }
}, [query])
```

### 3. Subscribing to External Stores
Event listeners, subscriptions (prefer `useSyncExternalStore` when available).

```tsx
// ✅ Subscribe to browser API
useEffect(() => {
  const handler = () => setOnline(navigator.onLine)
  window.addEventListener('online', handler)
  return () => window.removeEventListener('online', handler)
}, [])
```

## Key Principles

- **User interaction** → Event handler
- **Component appears on screen** → useEffect
- **Can be calculated from state/props** → Render-time calculation
- **Expensive calculation** → useMemo
- **Always implement cleanup** for subscriptions/timers
- **Handle race conditions** in async operations with ignore flags

## Reference

Based on React documentation: https://react.dev/learn/you-might-not-need-an-effect

---

# React useEffectEvent Best Practices

`useEffectEvent` extracts non-reactive logic from Effects into reusable functions that always access the latest props and state without triggering Effect re-runs.

## When to Use useEffectEvent

### 1. Callbacks Inside Effects
When an Effect calls a callback that needs latest values but shouldn't trigger re-runs.

```tsx
// ❌ BAD - Manual ref pattern for latest callback
const callbackRef = useRef(callback)
useEffect(() => {
  callbackRef.current = callback
}, [callback])
useEffect(() => {
  const interval = setInterval(() => callbackRef.current(), 1000)
  return () => clearInterval(interval)
}, [])

// ✅ GOOD - useEffectEvent handles this automatically
const onTick = useEffectEvent(() => {
  callback()
})
useEffect(() => {
  const interval = setInterval(onTick, 1000)
  return () => clearInterval(interval)
}, [])
```

### 2. Event Listeners with Non-Reactive Dependencies
When an Effect subscribes to events but callbacks shouldn't cause re-subscription.

```tsx
// ❌ BAD - controls in deps causes listener churn
useEffect(() => {
  const handler = (e) => {
    if (e.key === 'ArrowLeft') controls.onMoveLeft()
  }
  window.addEventListener('keydown', handler)
  return () => window.removeEventListener('keydown', handler)
}, [controls, enabled]) // Effect re-runs when controls change

// ✅ GOOD - Effect only re-runs when enabled changes
const onMoveLeft = useEffectEvent(() => controls.onMoveLeft())
useEffect(() => {
  if (!enabled) return
  const handler = (e) => {
    if (e.key === 'ArrowLeft') onMoveLeft()
  }
  window.addEventListener('keydown', handler)
  return () => window.removeEventListener('keydown', handler)
}, [enabled])
```

### 3. Reading Latest State in External Synchronization
When synchronizing with external systems but reading values that shouldn't be reactive.

```tsx
// ❌ BAD - theme in deps reconnects on theme change
useEffect(() => {
  const connection = createConnection(roomId)
  connection.on('connected', () => {
    showNotification('Connected!', theme)
  })
  connection.connect()
  return () => connection.disconnect()
}, [roomId, theme]) // Reconnects when theme changes!

// ✅ GOOD - Only reconnect when roomId changes
const onConnected = useEffectEvent(() => {
  showNotification('Connected!', theme)
})
useEffect(() => {
  const connection = createConnection(roomId)
  connection.on('connected', onConnected)
  connection.connect()
  return () => connection.disconnect()
}, [roomId])
```

## When NOT to Use useEffectEvent

### 1. As a Dependency Shortcut
Don't use to avoid specifying legitimate dependencies.

```tsx
// ❌ BAD - Hiding a real dependency
const fetchData = useEffectEvent(() => {
  fetch(`/api/${query}`) // query SHOULD trigger re-fetch
})
useEffect(() => {
  fetchData()
}, []) // Missing query dependency!

// ✅ GOOD - query is a real dependency
useEffect(() => {
  fetch(`/api/${query}`)
}, [query])
```

### 2. Outside of Effects
Effect Events should only be called within Effects.

```tsx
// ❌ BAD - Called directly in event handler
const onLog = useEffectEvent(() => log(value))
function handleClick() {
  onLog() // Wrong! Should use regular function
}

// ✅ GOOD - Regular function for event handlers
function handleClick() {
  log(value)
}
```

### 3. Passed to Other Components
Don't pass Effect Events as props or to other hooks.

```tsx
// ❌ BAD - Passing to child component
const onUpdate = useEffectEvent(() => updateValue(latest))
return <Child onUpdate={onUpdate} />

// ✅ GOOD - Use useCallback for component props
const onUpdate = useCallback(() => updateValue(value), [value])
return <Child onUpdate={onUpdate} />
```

## Key Principles

- **Callback in Effect needs latest values** → useEffectEvent
- **Value should trigger Effect re-run** → Regular dependency
- **Manual ref + sync Effect pattern** → Replace with useEffectEvent
- **Only call within Effects** → Never in event handlers or passed to children
- **Reduces Effect re-runs** by making callbacks non-reactive

## Reference

React documentation: https://react.dev/reference/react/useEffectEvent

---

# Zustand State Management Best Practices

## When to Use Zustand

### 1. Complex State with Multiple Actions
When state has many update functions and becomes unwieldy with useState/useReducer.

```tsx
// ❌ BAD - Complex useState with many callbacks
const [grid, setGrid] = useState(new Map())
const [score, setScore] = useState(0)
const [level, setLevel] = useState(1)
const updateScore = useCallback((points) => {
  setScore(s => s + points)
}, [])
const clearLine = useCallback((row) => {
  setGrid(g => /* complex logic */)
  updateScore(100)
}, [updateScore])

// ✅ GOOD - Single Zustand store
const useGameStore = create<GameStore>((set) => ({
  grid: new Map(),
  score: 0,
  level: 1,
  updateScore: (points) => set((state) => ({ score: state.score + points })),
  clearLine: (row) => set((state) => {
    // complex logic with access to all state
    return { grid: newGrid, score: state.score + 100 }
  })
}))
```

### 2. State Shared Across Multiple Components
When lifting state up creates prop drilling or context complexity.

```tsx
// ✅ Global store accessible anywhere
const useGameStore = create<GameStore>((set) => ({
  score: 0,
  updateScore: (points) => set((state) => ({ score: state.score + points }))
}))

// Any component can access directly
function ScoreDisplay() {
  const score = useGameStore((state) => state.score)
  return <div>Score: {score}</div>
}

function GameBoard() {
  const updateScore = useGameStore((state) => state.updateScore)
  // Use updateScore directly
}
```

### 3. Persistent State (localStorage)
Use Zustand's persist middleware instead of manual localStorage.

```tsx
// ✅ Automatic persistence
import { persist } from 'zustand/middleware'

const useHighScoreStore = create<HighScoreStore>()(
  persist(
    (set) => ({
      scores: {},
      setHighScore: (mode, score) =>
        set((state) => ({ scores: { ...state.scores, [mode]: score } }))
    }),
    {
      name: 'game-highscores',
      skipHydration: false
    }
  )
)
```

### 4. Non-Reactive External Access
When you need to read state outside React components.

```tsx
// ✅ Use subscribe or getState
const useGameLoopStore = create<GameLoopStore>((set, get) => ({
  elapsed: 0,
  updateElapsed: (delta) => set({ elapsed: get().elapsed + delta })
}))

// In requestAnimationFrame (outside React)
function gameLoop() {
  const elapsed = useGameLoopStore.getState().elapsed
  // or subscribe for changes
  useGameLoopStore.subscribe(
    (state) => state.elapsed,
    (elapsed) => console.log('Time:', elapsed)
  )
}
```

## Zustand Patterns

### Global Store Pattern (Recommended)
Single store instance, shared across all components.

```tsx
// ✅ GOOD - Global store
interface GameStore {
  gameMode: GameMode | undefined
  grid: Map<string, CellState>
  initGame: (mode: GameMode) => void
  resetGame: () => void
}

export const useGameStore = create<GameStore>((set) => ({
  gameMode: undefined,
  grid: new Map(),
  initGame: (mode) => set({ gameMode: mode, grid: generateGrid(mode) }),
  resetGame: () => set({ grid: new Map(), gameMode: undefined })
}))

// Usage in component
function Game() {
  const initGame = useGameStore((state) => state.initGame)
  useEffect(() => { initGame(selectedMode) }, [selectedMode])
}
```

### Avoid Store Factory Pattern
Don't create store instances per component/mode.

```tsx
// ❌ BAD - Factory creates multiple store instances
const createGameStore = (mode: GameMode) => create<GameStore>(/* ... */)

// ✅ GOOD - Single store with dynamic initialization
const useGameStore = create<GameStore>((set) => ({
  gameMode: undefined,
  initGame: (mode) => set({ gameMode: mode })
}))
```

### Selective Subscriptions
Only subscribe to state you need to avoid unnecessary re-renders.

```tsx
// ❌ BAD - Subscribes to entire store
const state = useGameStore()

// ✅ GOOD - Subscribes only to score
const score = useGameStore((state) => state.score)

// ✅ GOOD - Subscribes to multiple specific fields
const { score, level } = useGameStore((state) => ({
  score: state.score,
  level: state.level
}))
```

### Immer Middleware for Complex Updates
Use immer middleware for deeply nested state updates.

```tsx
import { immer } from 'zustand/middleware/immer'

const useStore = create<Store>()(
  immer((set) => ({
    grid: new Map(),
    updateCell: (key, value) => set((state) => {
      state.grid.set(key, value) // Direct mutation with immer
    })
  }))
)
```

### Multiple Stores for Separation of Concerns
Use separate stores for distinct domains.

```tsx
// ✅ Separate stores for different concerns
const useGameStore = create<GameStore>(/* game state */)
const useHighScoreStore = create<HighScoreStore>(/* persistent scores */)
const useAnimationStore = create<AnimationStore>(/* animation state */)

// Components use only what they need
function ScoreDisplay() {
  const score = useGameStore((state) => state.score)
  const highScore = useHighScoreStore((state) => state.scores[mode])
  return <div>{score} / {highScore}</div>
}
```

## Key Principles

- **Complex state with actions** → Zustand store
- **Simple component state** → useState
- **Shared state across components** → Zustand store
- **Persistent state** → Zustand with persist middleware
- **External access (non-React)** → Zustand with getState/subscribe
- **Global store pattern** preferred over factory pattern
- **Selective subscriptions** to minimize re-renders
- **Multiple stores** for separation of concerns

## Reference

Zustand documentation: https://zustand.docs.pmnd.rs/

---

# Development Commands

## Never Run Dev Server

**⚠️ NEVER run `pnpm dev` or `pnpm preview`** — these commands start blocking servers that hang the terminal indefinitely. AI agents cannot interact with blocking processes.

```bash
# ❌ NEVER run these - they block forever
pnpm dev
pnpm preview

# ✅ Use these for validation
pnpm build        # Lint + TypeScript check + Vite build
pnpm lint         # ESLint only
```
