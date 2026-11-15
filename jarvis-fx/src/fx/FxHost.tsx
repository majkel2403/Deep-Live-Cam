import { Suspense, useEffect, useState } from 'react'
import { ErrorBoundary } from '@/hud'
import { useAccent, useQuality, useReducedMotion } from '@/lib/store'
import { lazyFx } from './registry'
import { FxControlsProvider, useFxControlsStore } from './controls'

function Loading() {
  return (
    <div className="absolute inset-0 grid place-items-center">
      <span className="jx-label text-jx-accent jx-caret">Ładowanie modułu</span>
    </div>
  )
}

/** Mounts one effect with the shared props, Suspense and an error boundary. */
export function FxHost({ id, stage, paused = false, store }: { id: string; stage: boolean; paused?: boolean; store?: ReturnType<typeof useFxControlsStore> }) {
  const Comp = lazyFx(id)
  const ownStore = useFxControlsStore()
  const { hue, hex, hex2 } = useAccent()
  const quality = useQuality()
  const reducedMotion = useReducedMotion()
  const [hidden, setHidden] = useState(typeof document !== 'undefined' && document.hidden)

  useEffect(() => {
    const on = () => setHidden(document.hidden)
    document.addEventListener('visibilitychange', on)
    return () => document.removeEventListener('visibilitychange', on)
  }, [])

  if (!Comp) return <div className="jx-label p-4 text-jx-danger">Nieznany efekt: {id}</div>
  return (
    <ErrorBoundary label={id}>
      <FxControlsProvider store={store ?? ownStore}>
        <Suspense fallback={<Loading />}>
          <div className="absolute inset-0 overflow-hidden" data-fx={id}>
            <Comp accent={hex} accent2={hex2} hue={hue} quality={stage ? quality : 'low'} reducedMotion={reducedMotion} stage={stage} paused={paused || hidden} />
          </div>
        </Suspense>
      </FxControlsProvider>
    </ErrorBoundary>
  )
}
