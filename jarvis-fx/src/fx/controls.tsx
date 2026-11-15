import { createContext, useContext, type ReactNode } from 'react'
import { useControls, useCreateStore, LevaPanel } from 'leva'

/**
 * Per-stage Leva store: effects call `useFxControls({...schema})`.
 * In the stage the panel is visible and values are live; in gallery cards the
 * panel is never rendered, so effects simply get the schema defaults.
 */
type LevaStore = ReturnType<typeof useCreateStore>
const Ctx = createContext<LevaStore | null>(null)

export function FxControlsProvider({ children, store }: { children: ReactNode; store: LevaStore }) {
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export function useFxControlsStore() {
  return useCreateStore()
}

// Leva's schema typing is very generic; keep the public helper loose but typed by inference.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useFxControls<S extends Record<string, any>>(schema: S) {
  const store = useContext(Ctx)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return useControls(schema as any, { store: store ?? undefined }) as any as {
    [K in keyof S]: S[K] extends { value: infer V } ? V : S[K]
  }
}

export function FxLevaPanel({ store }: { store: LevaStore }) {
  return (
    <LevaPanel
      store={store}
      fill
      flat
      titleBar={false}
      theme={{
        colors: {
          elevation1: 'hsl(var(--jx-hue) 60% 6%)',
          elevation2: 'hsl(var(--jx-hue) 60% 9%)',
          elevation3: 'hsl(var(--jx-hue) 50% 16%)',
          accent1: 'hsl(var(--jx-hue) 100% 45%)',
          accent2: 'hsl(var(--jx-hue) 100% 55%)',
          accent3: 'hsl(var(--jx-hue) 100% 65%)',
          highlight1: 'hsl(var(--jx-hue) 25% 55%)',
          highlight2: 'hsl(var(--jx-hue) 50% 80%)',
          highlight3: '#fff',
          vivid1: '#ffb000',
        },
        fonts: { mono: 'JetBrains Mono, monospace', sans: 'Chakra Petch, sans-serif' },
        radii: { xs: '0px', sm: '0px', lg: '0px' },
      }}
    />
  )
}
