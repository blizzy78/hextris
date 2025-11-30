// KeyboardControlsDisplay component - shows game controls

interface ControlBinding {
  keys: string[]
  action: string
}

const CONTROLS: ControlBinding[] = [
  { keys: ['←', '→'], action: 'Move' },
  { keys: ['↓'], action: 'Soft drop' },
  { keys: ['↑'], action: 'Rotate' },
  { keys: ['Space'], action: 'Hard drop' },
]

export function KeyboardControlsDisplay() {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-sm text-gray-400 font-medium">Controls</div>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
        {CONTROLS.map((control) => (
          <div key={control.action} className="flex items-center gap-1.5 text-xs">
            <div className="flex gap-0.5">
              {control.keys.map((key) => (
                <kbd
                  key={key}
                  className="px-1.5 py-0.5 bg-gray-700 text-gray-200 rounded border border-gray-600 font-mono text-xs min-w-6 text-center"
                >
                  {key}
                </kbd>
              ))}
            </div>
            <span className="text-gray-400">{control.action}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
