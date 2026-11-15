import { useCallback, useEffect, useId, useRef, type ReactNode } from 'react'
import Particles, { ParticlesProvider } from '@tsparticles/react'
import type { Container, ISourceOptions } from '@tsparticles/engine'
import { BgHud, type BgHudStat } from '../bg-kit/BgHud'
import { jxParticlesInit } from './engine'

/**
 * <ParticlesProvider> + <Particles> host with pause/play wiring and the shared HUD overlay.
 * `options` must be memoised by the caller: @tsparticles/react reloads the container on identity change.
 */
export function ParticlesFx({
  options,
  paused,
  stage,
  background,
  code,
  hint,
  stats,
  label,
  children,
}: {
  options: ISourceOptions
  paused: boolean
  stage: boolean
  background: string
  code: string
  hint?: ReactNode
  stats?: BgHudStat[]
  label: string
  children?: ReactNode
}) {
  const id = `jx-particles-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const container = useRef<Container | undefined>(undefined)
  const pausedRef = useRef(paused)

  useEffect(() => {
    pausedRef.current = paused
    const c = container.current
    if (!c || c.destroyed) return
    if (paused) c.pause()
    else c.play()
  }, [paused])

  useEffect(() => () => void (container.current = undefined), [])

  const onLoaded = useCallback(async (c?: Container) => {
    container.current = c
    if (c && pausedRef.current) c.pause()
  }, [])

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background }} role="img" aria-label={label}>
      <ParticlesProvider init={jxParticlesInit}>
        <Particles id={id} options={options} particlesLoaded={onLoaded} className="absolute inset-0" />
      </ParticlesProvider>
      {children}
      <BgHud code={code} stage={stage} paused={paused} hint={hint} stats={stats} />
    </div>
  )
}
