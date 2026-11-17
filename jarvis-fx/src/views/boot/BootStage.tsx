/**
 * The J.A.R.V.I.S boot choreography, shared by the start-up overlay (BootSequence) and the
 * inline replay in BootView. One GSAP timeline (useGSAP) drives everything; timings come from
 * ./layers.ts. Plugins (all free since GSAP 3.13): DrawSVG, MorphSVG, SplitText, ScrambleText.
 * Also: ARWES Decipher status lines, PowerGlitch flash, synced UI bleeps.
 */
import { useEffect, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type Ref } from 'react'
import gsap from 'gsap'
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin'
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin'
import { SplitText } from 'gsap/SplitText'
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin'
import { useGSAP } from '@gsap/react'
import { useGlitch } from 'react-powerglitch'
import { Decipher } from '@/hud'
import { playBleep, type BleepName } from '@/lib/sound'
import { useQuality, useReducedMotion } from '@/lib/store'
import { FX } from '@/fx/registry'
import { BOOT_LAYER, BOOT_MAIN_END } from './layers'
import { buildBootLog } from './bootLog'
import { CORE_SHAPES } from './geometry'
import { Reactor } from './reactor'
import './boot.css'

gsap.registerPlugin(useGSAP, DrawSVGPlugin, MorphSVGPlugin, SplitText, ScrambleTextPlugin)

export interface BootStageApi {
  /** jump to a time (seconds at 1×) and pause */
  seek: (t: number) => void
  play: () => void
  pause: () => void
  skip: () => void
}

export interface BootStageProps {
  mode: 'overlay' | 'inline'
  onDone?: () => void
  /** timeline time in seconds (1× scale), every frame — write to the DOM, don't setState */
  onProgress?: (t: number) => void
  onPausedChange?: (paused: boolean) => void
  speed?: number
  /** force the reduced-motion variant (defaults to the user/OS setting) */
  reduced?: boolean
  apiRef?: Ref<BootStageApi>
}

const SUBTITLE = 'JUST A RATHER VERY INTELLIGENT SYSTEM'
const SCRAMBLE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<>/\\[]#'

export function BootStage({ mode, onDone, onProgress, onPausedChange, speed = 1, reduced: reducedProp, apiRef }: BootStageProps) {
  const reducedPref = useReducedMotion()
  const reduced = reducedProp ?? reducedPref
  const quality = useQuality()
  const gid = 'jxb' + useId().replace(/[^a-zA-Z0-9]/g, '')
  const overlay = mode === 'overlay'

  const root = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const subRef = useRef<HTMLParagraphElement>(null)
  const tlRef = useRef<gsap.core.Timeline | null>(null)
  const skipRef = useRef<() => void>(() => undefined)
  const reportRef = useRef<() => void>(() => undefined)
  const seekRef = useRef<(t: number) => void>(() => undefined)
  const doneRef = useRef(false)
  const cb = useRef({ onDone, onProgress, onPausedChange })
  useLayoutEffect(() => {
    cb.current = { onDone, onProgress, onPausedChange }
  })

  const [statusOn, setStatusOn] = useState(false)
  const [flash, setFlash] = useState(0)
  const log = useMemo(() => buildBootLog(), [])
  const status = useMemo(
    () => [
      { text: 'Rdzeń interfejsu: online', accent: false },
      { text: `Moduły FX: ${FX.length} w rejestrze`, accent: false },
      { text: 'Witaj z powrotem.', accent: true },
    ],
    [],
  )

  const done = () => {
    if (doneRef.current) return
    doneRef.current = true
    cb.current.onDone?.()
  }

  useGSAP(
    (_ctx, contextSafe) => {
      const el = root.current
      if (!el || !contextSafe) return
      const all = <T extends Element>(s: string) => Array.from(el.querySelectorAll<T>(s))
      const one = <T extends Element>(s: string) => el.querySelector<T>(s)!
      const sfx = (n: BleepName) => playBleep(n)
      const L = BOOT_LAYER

      const reactor = one<HTMLDivElement>('.jxb-reactor')
      const rings = all<SVGCircleElement>('[data-ring]')
      const arcs = all<SVGPathElement>('[data-arc]')
      const ticks = all<SVGLineElement>('[data-tick]')
      const coils = all<SVGElement>('[data-coil]')
      const cross = all<SVGLineElement>('[data-cross]')
      const tri = one<SVGPathElement>('[data-tri]')
      const core = one<SVGPathElement>('[data-core]')
      const glow = one<SVGCircleElement>('[data-glow]')
      const halo = one<SVGCircleElement>('[data-halo]')
      const lines = all<HTMLDivElement>('[data-log]')
      const tags = all<HTMLSpanElement>('[data-log-tag]')
      const bar = one<HTMLDivElement>('[data-bar]')
      const pct = one<HTMLSpanElement>('[data-pct]')
      const tc = one<HTMLSpanElement>('[data-tc]')
      const title = titleRef.current!
      const sub = subRef.current!
      const tag = one<HTMLParagraphElement>('[data-tagline]')
      const rule = all<HTMLDivElement>('[data-rule]')
      const chrome = all<HTMLElement>('[data-chrome]')

      const tl = gsap.timeline({ paused: true, defaults: { ease: 'power2.out' } })
      tlRef.current = tl

      // ── power ────────────────────────────────────────────────────────────────────────────
      tl.call(() => sfx('boot'), [], L.power.at)
      tl.fromTo(one('.jxb-bg'), { opacity: 0 }, { opacity: 1, duration: 0.5 }, L.power.at)
      tl.fromTo(one('.jxb-grid'), { opacity: 0, scale: 1.08 }, { opacity: 1, scale: 1, duration: 0.7 }, L.power.at)
      tl.fromTo(one('.jxb-scan'), { top: '0%', opacity: 1 }, { top: '100%', opacity: 0.2, duration: 0.65, ease: 'power1.in' }, L.power.at + 0.05)
      tl.set(one('.jxb-scan'), { opacity: 0 }, L.power.at + 0.72)
      tl.fromTo(chrome, { opacity: 0 }, { opacity: 1, duration: 0.3, stagger: 0.04 }, L.power.at + 0.15)
      tl.fromTo(rule, { scaleX: 0 }, { scaleX: 1, duration: 0.6, ease: 'power3.out' }, L.power.at + 0.2)

      // ── reactor: DrawSVG ─────────────────────────────────────────────────────────────────
      const R = L.reactor.at
      tl.fromTo(rings, { drawSVG: '50% 50%' }, { drawSVG: '0% 100%', duration: 0.9, stagger: 0.12, ease: 'power3.inOut' }, R)
      tl.fromTo(cross, { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.35, stagger: 0.06 }, R + 0.1)
      tl.fromTo(ticks, { opacity: 0 }, { opacity: 1, duration: 0.12, stagger: { each: 0.008 } }, R + 0.25)
      tl.fromTo(arcs, { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.7, stagger: 0.07, ease: 'power2.inOut' }, R + 0.45)
      tl.fromTo(coils, { opacity: 0, scale: 0.3, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: 0.3, stagger: 0.035, ease: 'back.out(2)' }, R + 0.9)
      tl.fromTo(halo, { opacity: 0 }, { opacity: 1, duration: 0.8 }, R + 1.1)

      // ── core: DrawSVG + MorphSVG ─────────────────────────────────────────────────────────
      const C = L.core.at
      tl.fromTo(tri, { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.45, ease: 'power2.inOut' }, C)
      tl.fromTo(core, { opacity: 0 }, { opacity: 1, duration: 0.25 }, C + 0.35)
      tl.to(core, { morphSVG: CORE_SHAPES.hexagon, duration: 0.42, ease: 'power2.inOut' }, C + 0.6)
      tl.to(core, { morphSVG: CORE_SHAPES.circle, duration: 0.5, ease: 'back.out(1.7)' }, C + 1.05)
      tl.to(tri, { opacity: 0.35, duration: 0.4 }, C + 1.05)
      tl.fromTo(glow, { opacity: 0, scale: 0.2, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: 0.8, ease: 'expo.out' }, C + 0.7)

      // ── boot log + progress ─────────────────────────────────────────────────────────────
      const G = L.log.at
      const step = (L.log.dur - 0.2) / Math.max(1, lines.length)
      lines.forEach((line, i) => {
        const t = G + i * step
        tl.fromTo(line, { opacity: 0, x: -10 }, { opacity: 1, x: 0, duration: 0.2 }, t)
        tl.call(() => sfx('type'), [], t)
        const tagEl = tags[i]
        if (tagEl) tl.fromTo(tagEl, { opacity: 0.4 }, { opacity: 1, duration: 0.3, scrambleText: { text: tagEl.dataset.text ?? '', chars: '01', speed: 1 } }, t + 0.08)
      })
      const prog = { v: 0 }
      tl.to(prog, { v: 100, duration: L.log.dur, ease: 'power1.inOut' }, G)
      tl.fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: L.log.dur, ease: 'power1.inOut' }, G)

      // ── title: SplitText + ScrambleText ──────────────────────────────────────────────────
      const T = L.title.at
      const split = SplitText.create(title, { type: 'chars', charsClass: 'jxb-char' })
      tl.fromTo(
        split.chars,
        { opacity: 0, yPercent: 70, scaleY: 2.4, transformOrigin: '50% 100%' },
        { opacity: 1, yPercent: 0, scaleY: 1, duration: 0.55, stagger: 0.055, ease: 'expo.out' },
        T,
      )
      tl.fromTo(title, { letterSpacing: '0.9em' }, { letterSpacing: '0.3em', duration: 1.1, ease: 'expo.out' }, T)
      tl.fromTo(sub, { opacity: 0 }, { opacity: 1, duration: 0.05 }, T + 0.35)
      tl.to(sub, { duration: 0.9, scrambleText: { text: SUBTITLE, chars: SCRAMBLE_CHARS, revealDelay: 0.25, speed: 0.7, tweenLength: false } }, T + 0.35)
      tl.fromTo(tag, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.4 }, T + 0.9)

      // ── status: ARWES Decipher (mounted by React state) ──────────────────────────────────
      tl.call(() => setStatusOn(true), [], L.status.at)

      // ── flash: PowerGlitch + light burst ─────────────────────────────────────────────────
      const F = L.flash.at
      tl.call(
        () => {
          sfx('success')
          setFlash((k) => k + 1)
        },
        [],
        F,
      )
      tl.fromTo(one('.jxb-flash'), { opacity: 0 }, { opacity: 0.6, duration: 0.07, yoyo: true, repeat: 1, ease: 'none' }, F)
      tl.fromTo(reactor, { scale: 1 }, { scale: 1.035, duration: 0.12, yoyo: true, repeat: 1, ease: 'power2.out' }, F)
      tl.to({}, { duration: 0.01 }, BOOT_MAIN_END - 0.01) // pad the timeline to the layer end

      // ── ambient loops (not part of the timeline; reverted with the context) ─────────────
      if (!reduced) {
        // HTML wrappers → compositor-only CSS rotation, no SVG repaint per frame
        gsap.to(one('[data-spin-a]'), { rotation: 360, duration: 48, repeat: -1, ease: 'none' })
        gsap.to(one('[data-spin-b]'), { rotation: -360, duration: 26, repeat: -1, ease: 'none' })
        gsap.to(one('[data-spin-c]'), { rotation: 360, duration: 120, repeat: -1, ease: 'none' })
      }

      // ── control flow ────────────────────────────────────────────────────────────────────
      const report = () => {
        const t = tl.time()
        tc.textContent = `T+${t.toFixed(2).replace('.', ',')} s`
        pct.textContent = `${Math.round(prog.v)}%`
        cb.current.onProgress?.(t)
      }
      tl.eventCallback('onUpdate', report)
      reportRef.current = report

      let finishing = false
      const finish = contextSafe((fast = false) => {
        if (finishing) return
        finishing = true
        if (overlay) gsap.to(el, { opacity: 0, scale: fast ? 1 : 1.015, duration: fast ? 0.25 : BOOT_LAYER.exit.dur, ease: 'power2.in', onComplete: done })
        else done()
      })
      tl.eventCallback('onComplete', () => finish())

      const jumpToEnd = () => {
        tl.progress(1, true)
        setStatusOn(true)
        report()
      }

      skipRef.current = contextSafe(() => {
        if (finishing) return
        if (overlay) {
          tl.pause()
          finish(true)
        } else {
          jumpToEnd()
          finish()
        }
      })
      seekRef.current = contextSafe((t: number) => {
        tl.pause()
        tl.seek(Math.max(0, Math.min(BOOT_MAIN_END, t)), true)
        setStatusOn(tl.time() >= L.status.at)
        report()
        cb.current.onPausedChange?.(true)
      })

      if (reduced) {
        // no choreography: final frame, short fade in/out
        jumpToEnd()
        if (overlay) {
          gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.2 })
          gsap.delayedCall(1.1, () => finish(true))
        } else finish()
      } else {
        tl.timeScale(speed)
        tl.play(0)
      }
    },
    { scope: root, dependencies: [] },
  )

  useEffect(() => {
    tlRef.current?.timeScale(speed)
  }, [speed])

  // The layout-phase timeline may have reported before the parent's refs (time readout, scrubber)
  // were attached — the parent's siblings mount after this component. Passive effects run after that,
  // so re-sending the current time here keeps the reduced-motion end state visible in BootView.
  useEffect(() => {
    reportRef.current()
  }, [])

  useImperativeHandle(
    apiRef,
    () => ({
      seek: (t) => seekRef.current(t),
      play: () => {
        const tl = tlRef.current
        if (!tl) return
        if (tl.progress() >= 1) tl.play(0)
        else tl.play()
        cb.current.onPausedChange?.(false)
      },
      pause: () => {
        tlRef.current?.pause()
        cb.current.onPausedChange?.(true)
      },
      skip: () => skipRef.current(),
    }),
    [],
  )

  // overlay: Esc / Enter / Space skip
  useEffect(() => {
    if (!overlay) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        skipRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [overlay])

  const statusDur = 0.75 / speed

  return (
    <div
      ref={root}
      className={`jxb-root ${overlay ? 'fixed inset-0 z-[70] cursor-pointer' : 'absolute inset-0'}`}
      data-q={quality}
      data-mode={mode}
      role={overlay ? 'dialog' : undefined}
      aria-modal={overlay ? true : undefined}
      aria-label={overlay ? 'Sekwencja rozruchu J.A.R.V.I.S — naciśnij Escape, aby pominąć' : 'Podgląd sekwencji rozruchu'}
      onClick={overlay ? () => skipRef.current() : undefined}
    >
      <div className="jxb-bg" />
      <div className="jxb-grid" />
      <div className="jxb-scan" />
      {/* light burst driven by the flash tween in the timeline (its target must exist, or GSAP warns) */}
      <div className="jxb-flash" aria-hidden="true" />
      {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
        <span key={c} className="jxb-corner" data-c={c} data-chrome aria-hidden="true" />
      ))}

      <div className="jxb-top" aria-hidden="true">
        <span className="jx-label text-jx-accent" data-chrome>
          Sekwencja rozruchu
        </span>
        <span className="jx-num text-jx-dim" data-chrome data-tc>
          T+0,00 s
        </span>
        <div className="jxb-rule" data-rule data-wide />
        <span className="jx-label" data-chrome data-wide>
          Mission Control · FX
        </span>
      </div>

      <div className="jxb-center">
        <Reactor gid={gid} className="jxb-reactor" />
        <FlashGlitch trigger={flash} enabled={!reduced}>
          <div className="jxb-title-block">
            <h1 ref={titleRef} className="jxb-title" aria-label="J.A.R.V.I.S">
              J.A.R.V.I.S
            </h1>
            <p ref={subRef} className="jxb-sub" aria-hidden="true">
              {SUBTITLE}
            </p>
          </div>
        </FlashGlitch>
        <p className="jxb-tag" data-tagline>
          Centrum dowodzenia efektami
        </p>
      </div>

      <div className="jxb-log" aria-hidden="true">
        <div className="jxb-col-head" data-chrome>
          <span className="jx-label text-jx-accent">Dziennik</span>
          <span className="flex-1" />
          <span className="jx-label">pomiar z przeglądarki</span>
        </div>
        {log.map((l, i) => (
          <div key={i} className="jxb-line" data-log>
            <span className="jxb-pct">[{String(l.pct).padStart(3, ' ')}%]</span>
            <span className="jxb-txt">{l.text}</span>
            <span className={l.tag === 'OK' ? 'jxb-tag-ok' : l.tag === 'INFO' ? 'jxb-tag-info' : 'jxb-tag-off'} data-log-tag data-text={l.tag}>
              {l.tag}
            </span>
          </div>
        ))}
      </div>

      <div className="jxb-status" role={overlay ? 'status' : undefined}>
        <div className="jxb-col-head" data-chrome aria-hidden="true">
          <span className="jx-label text-jx-accent">Status</span>
          <span className="flex-1" />
          <span className="jx-label">ARWES</span>
        </div>
        {statusOn &&
          status.map((s, i) => (
            <span key={s.text} className="jxb-status-line" data-accent={s.accent ? '' : undefined}>
              <Decipher text={s.text} duration={statusDur} delay={(i * 0.28) / speed} sound={i === 0} />
            </span>
          ))}
      </div>

      <div className="jxb-bottom">
        <div className="jxb-track" aria-hidden="true">
          <div className="jxb-bar" data-bar />
          <div className="jxb-track-ticks" />
        </div>
        <span className="jxb-pct-big" data-pct aria-hidden="true">
          0%
        </span>
        {overlay && (
          <button
            type="button"
            autoFocus
            data-augmented-ui="tl-clip br-clip border"
            className="jx-aug-btn jxb-skip px-3.5 py-1.5 text-[0.78rem]"
            onClick={(e) => {
              e.stopPropagation()
              playBleep('click')
              skipRef.current()
            }}
          >
            Pomiń <kbd>Esc</kbd>
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * PowerGlitch (react-powerglitch, MIT) flash. PowerGlitch re-parents the node it is attached to,
 * so the markup shape here never changes (also not with reduced motion — it just never fires);
 * React only ever removes the outer span.
 */
function FlashGlitch({ trigger, enabled, children }: { trigger: number; enabled: boolean; children: ReactNode }) {
  const { ref: glitchRef, startGlitch: start } = useGlitch({
    playMode: 'manual',
    hideOverflow: false,
    timing: { duration: 560, iterations: 1 },
    glitchTimeSpan: { start: 0, end: 1 },
    shake: { velocity: 20, amplitudeX: 0.06, amplitudeY: 0.12 },
    slice: { count: 8, velocity: 22, minHeight: 0.03, maxHeight: 0.22, hueRotate: true },
    pulse: false,
  })
  useEffect(() => {
    if (enabled && trigger > 0) start()
  }, [trigger, enabled, start])
  return (
    <span style={{ display: 'inline-block' }}>
      <span ref={glitchRef} style={{ display: 'inline-block' }}>
        {children}
      </span>
    </span>
  )
}
