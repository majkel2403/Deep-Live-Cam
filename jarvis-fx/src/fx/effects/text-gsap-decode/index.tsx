import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { SplitText } from 'gsap/SplitText'
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin'
import { useGSAP } from '@gsap/react'
import { useFxControls } from '@/fx/controls'
import type { FxProps } from '@/fx/types'
import { CornerBrackets } from '../motion-kit/kit'

gsap.registerPlugin(useGSAP, SplitText, ScrambleTextPlugin)

/** Title cards. Titles stay ASCII so Orbitron (latin-only) renders them without fallback glyphs. */
const SEQUENCES = [
  {
    code: 'BOOT',
    title: 'SYSTEM ONLINE',
    lines: ['Inicjalizacja rdzenia J.A.R.V.I.S.', 'Kalibracja czujników zewnętrznych', 'Łącze satelitarne ustanowione'],
  },
  {
    code: 'DEF',
    title: 'TARCZE AKTYWNE',
    lines: ['Pole repulsorowe – moc nominalna', 'Rozkład energii na segmenty pancerza', 'Integralność powłoki zweryfikowana'],
  },
  {
    code: 'TAC',
    title: 'TRYB TAKTYCZNY',
    lines: ['Namierzanie celów w trybie ciągłym', 'Analiza zagrożeń: priorytet wysoki', 'Oczekiwanie na rozkaz pilota'],
  },
] as const

const CHARSETS = {
  bloki: '█▓▒░▚▞▙▟',
  hex: '0123456789ABCDEF',
  binarne: '01',
  polskie: 'ĄĆĘŁŃÓŚŹŻ',
  symbole: '<>/\\[]{}=+*^?#_',
} as const

const FONTS = { Orbitron: 'var(--jx-font-display)', Michroma: 'var(--jx-font-cmd)', Audiowide: 'var(--jx-font-audiowide)' } as const

export default function GsapDecode({ stage, reducedMotion, paused }: FxProps) {
  const c = useFxControls({
    tempo: { value: 1, min: 0.25, max: 2.5, step: 0.05, label: 'tempo' },
    charset: { value: CHARSETS.bloki as string, options: CHARSETS, label: 'szyfr' },
    font: { value: FONTS.Orbitron as string, options: FONTS, label: 'krój' },
    hold: { value: 1.8, min: 0.4, max: 6, step: 0.1, label: 'pauza (s)' },
    glow: { value: true, label: 'poświata' },
  })

  const root = useRef<HTMLDivElement>(null)
  const tlRef = useRef<gsap.core.Timeline | null>(null)
  const tempoRef = useRef(c.tempo)
  const pausedRef = useRef(paused)

  // live tempo without restarting the sequence
  useEffect(() => {
    tempoRef.current = c.tempo
    tlRef.current?.timeScale(c.tempo)
  }, [c.tempo])

  useEffect(() => {
    pausedRef.current = paused
    if (paused) tlRef.current?.pause()
    else tlRef.current?.resume()
  }, [paused])

  useGSAP(
    (_ctx, contextSafe) => {
      const el = root.current
      if (!el || !contextSafe) return
      const q = <T extends Element>(s: string) => el.querySelector<T>(s)!
      const titleEl = q<HTMLHeadingElement>('[data-title]')
      const kickerEl = q<HTMLSpanElement>('[data-kicker]')
      const ruleEl = q<HTMLDivElement>('[data-rule]')
      const sweepEl = q<HTMLDivElement>('[data-sweep]')
      const barEl = q<HTMLDivElement>('[data-bar]')
      const pctEl = q<HTMLSpanElement>('[data-pct]')
      const rows = Array.from(el.querySelectorAll<HTMLDivElement>('[data-row]'))
      let split: SplitText | null = null
      let alive = true

      const fill = (i: number) => {
        const s = SEQUENCES[i % SEQUENCES.length]
        titleEl.textContent = s.title
        kickerEl.textContent = `Sekwencja ${String((i % SEQUENCES.length) + 1).padStart(2, '0')}/${String(SEQUENCES.length).padStart(2, '0')} · ${s.code}`
        rows.forEach((r, k) => {
          r.querySelector('[data-line]')!.textContent = s.lines[k] ?? ''
          r.querySelector('[data-ok]')!.textContent = 'OK'
        })
        pctEl.textContent = '100%'
        gsap.set(barEl, { scaleX: 1 })
        gsap.set([ruleEl, ...rows], { clearProps: 'all' })
        gsap.set(ruleEl, { scaleX: 1 })
      }

      if (reducedMotion) {
        fill(0)
        return
      }

      const play = contextSafe((i: number) => {
        if (!alive) return
        const s = SEQUENCES[i % SEQUENCES.length]
        split?.revert()
        titleEl.textContent = s.title
        split = SplitText.create(titleEl, { type: 'chars', charsClass: 'gx-char', aria: 'auto' })
        const chars = split.chars as HTMLElement[]
        const lines = rows.map((r) => r.querySelector<HTMLElement>('[data-line]')!)
        const oks = rows.map((r) => r.querySelector<HTMLElement>('[data-ok]')!)
        lines.forEach((l) => (l.textContent = ''))
        oks.forEach((o) => (o.textContent = ''))
        kickerEl.textContent = ''
        const counter = { v: 0 }

        const tl = gsap.timeline({
          defaults: { ease: 'power3.out' },
          onComplete: () => play(i + 1),
        })
        tl.timeScale(tempoRef.current)
        tlRef.current = tl

        tl.set(rows, { opacity: 1 })
          .set(barEl, { scaleX: 0 })
          .to(kickerEl, { duration: 0.8, scrambleText: { text: `Sekwencja ${String((i % SEQUENCES.length) + 1).padStart(2, '0')}/${String(SEQUENCES.length).padStart(2, '0')} · ${s.code}`, chars: c.charset, speed: 0.6 } }, 0)
          .from(chars, { opacity: 0, y: '0.55em', scaleY: 2.4, filter: 'blur(6px)', transformOrigin: '50% 100%', duration: 0.7, stagger: 0.045, ease: 'expo.out' }, 0.1)
          .to(chars, { duration: 1.0, stagger: 0.045, scrambleText: { text: '{original}', chars: c.charset, speed: 0.55, revealDelay: 0.35 } }, 0.1)
          .fromTo(sweepEl, { xPercent: -120, opacity: 1 }, { xPercent: 120, opacity: 0.2, duration: 1.1, ease: 'power2.inOut' }, 0.35)
          .fromTo(ruleEl, { scaleX: 0 }, { scaleX: 1, duration: 0.9, ease: 'expo.inOut' }, 0.3)
          .to(counter, { v: 100, duration: 2.6, ease: 'power1.inOut', onUpdate: () => (pctEl.textContent = `${Math.round(counter.v)}%`) }, 0.6)
          .to(barEl, { scaleX: 1, duration: 2.6, ease: 'power1.inOut' }, 0.6)
        lines.forEach((l, k) => {
          const at = 0.9 + k * 0.5
          tl.fromTo(rows[k], { x: -12, opacity: 0 }, { x: 0, opacity: 1, duration: 0.35 }, at)
          tl.to(l, { duration: 1.1, scrambleText: { text: s.lines[k] ?? '', chars: c.charset, speed: 0.5, revealDelay: 0.25 } }, at)
          tl.to(oks[k], { duration: 0.35, scrambleText: { text: 'OK', chars: c.charset, speed: 1 } }, at + 1.05)
        })
        // hold, then exit
        tl.to(chars, { opacity: 0, y: '-0.35em', filter: 'blur(4px)', duration: 0.45, stagger: { each: 0.025, from: 'end' }, ease: 'power2.in' }, `+=${c.hold}`)
          .to(rows, { opacity: 0, x: 10, duration: 0.3, stagger: 0.06, ease: 'power2.in' }, '<')
          .to(ruleEl, { scaleX: 0, duration: 0.4, ease: 'power2.in' }, '<0.1')
          .to(kickerEl, { duration: 0.35, scrambleText: { text: ' ', chars: c.charset } }, '<')
        if (pausedRef.current) tl.pause()
      })

      play(0)
      return () => {
        alive = false
        tlRef.current?.kill()
        tlRef.current = null
        split?.revert()
      }
    },
    { scope: root, dependencies: [c.charset, c.hold, reducedMotion], revertOnUpdate: true },
  )

  const big = stage ? 'text-[clamp(2.4rem,7.2vw,6.4rem)]' : 'text-[1.45rem]'
  const glowShadow = c.glow ? '0 0 18px hsl(var(--jx-hue) 100% 55% / 0.85), 0 0 2px hsl(var(--jx-hue) 100% 85%)' : 'none'

  return (
    <div ref={root} className="absolute inset-0 overflow-hidden bg-jx-bg">
      <div className="absolute inset-0 jx-grid-bg opacity-60" aria-hidden="true" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--jx-hue)_90%_30%/0.28),transparent_65%)]" aria-hidden="true" />
      <CornerBrackets size={stage ? 22 : 10} inset={stage ? 18 : 6} />

      <div className={`absolute inset-0 flex flex-col items-center justify-center ${stage ? 'gap-5 px-10' : 'gap-1.5 px-3'}`}>
        <span data-kicker className={`jx-label text-jx-accent ${stage ? 'text-sm tracking-[0.4em]' : 'text-[0.5rem] tracking-[0.3em]'}`} aria-hidden="true">
          Sekwencja 01/03 · BOOT
        </span>

        <div className="relative">
          <h2
            data-title
            className={`m-0 leading-none whitespace-nowrap ${big}`}
            style={{ fontFamily: c.font, letterSpacing: '0.16em', color: 'hsl(var(--jx-hue) 100% 93%)', textShadow: glowShadow, fontWeight: 700 }}
          >
            SYSTEM ONLINE
          </h2>
          {/* light sweep */}
          <div
            data-sweep
            aria-hidden="true"
            className="absolute inset-y-[-20%] left-0 w-full pointer-events-none mix-blend-screen opacity-0"
            style={{ background: 'linear-gradient(100deg, transparent 35%, hsl(var(--jx-hue) 100% 75% / 0.55) 50%, transparent 65%)' }}
          />
        </div>

        <div className={`relative flex items-center ${stage ? 'w-[min(56rem,80%)]' : 'w-[88%]'}`} aria-hidden="true">
          <span className="size-1.5 rotate-45 border border-jx-accent shrink-0" />
          <div data-rule className="h-px flex-1 bg-gradient-to-r from-transparent via-jx-accent to-transparent shadow-[0_0_8px_var(--jx-accent)]" />
          <span className="size-1.5 rotate-45 border border-jx-accent shrink-0" />
        </div>

        <div className={`flex flex-col ${stage ? 'gap-2 w-[min(40rem,70%)]' : 'gap-0.5 w-[88%]'}`}>
          {[0, 1, 2].map((k) => (
            <div key={k} data-row className={`flex items-center gap-2 font-head ${stage ? 'text-lg' : 'text-[0.55rem]'} text-jx-text/90`}>
              <span className="text-jx-accent">›</span>
              <span data-line className="flex-1 truncate tracking-wider">
                {SEQUENCES[0].lines[k]}
              </span>
              <span data-ok className="jx-num text-jx-ok tracking-widest">
                OK
              </span>
            </div>
          ))}
        </div>

        <div className={`flex items-center gap-3 ${stage ? 'w-[min(40rem,70%)] mt-2' : 'w-[88%]'}`} aria-hidden="true">
          <span className={`jx-label ${stage ? '' : 'text-[0.45rem]'}`}>Synchronizacja</span>
          <div className="relative flex-1 h-1 bg-jx-accent-dim/30 overflow-hidden">
            <div data-bar className="absolute inset-0 origin-left bg-jx-accent shadow-[0_0_8px_var(--jx-accent)]" />
          </div>
          <span data-pct className={`jx-num text-jx-accent ${stage ? 'text-sm' : 'text-[0.5rem]'} w-[3.2em] text-right`}>
            100%
          </span>
        </div>
      </div>
    </div>
  )
}
