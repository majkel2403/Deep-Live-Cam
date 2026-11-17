import { useRef } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import IconCommand from '@tabler/icons-react/icons/IconCommand'
import IconSettings from '@tabler/icons-react/icons/IconSettings'
import IconX from '@tabler/icons-react/icons/IconX'
import { HudButton, Panel } from '@/hud'
import { DEFAULT_SETTINGS, useSettings, type MotionPref, type QualityPref } from '@/lib/store'
import { playBleep } from '@/lib/sound'

const HUE_SWATCHES = [188, 200, 160, 28, 350, 265] as const
const QUALITY_LABELS: Record<QualityPref, string> = { auto: 'Auto', low: 'Niska', med: 'Średnia', high: 'Wysoka' }
const MOTION_LABELS: Record<MotionPref, string> = { auto: 'Systemowy', full: 'Pełny', reduced: 'Ograniczony' }

/**
 * Global settings (Radix Dialog primitive, restyled as a HUD panel).
 * Also the touch route to the command palette: the header button is hidden below sm, so phones open it from here.
 */
export function SettingsMenu({ onOpenPalette }: { onOpenPalette?: () => void }) {
  const s = useSettings()
  // Opening the palette closes this dialog; keep focus on the palette instead of returning it to the trigger.
  const handOffToPalette = useRef(false)
  return (
    <Dialog.Root onOpenChange={(o) => playBleep(o ? 'open' : 'close')}>
      <Dialog.Trigger asChild>
        <HudButton size="sm" aria-label="Ustawienia" icon={<IconSettings />} />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed z-50 right-2 sm:right-4 top-16 w-[min(380px,calc(100vw-1rem))] outline-none"
          aria-describedby={undefined}
          onCloseAutoFocus={(e) => {
            if (handOffToPalette.current) {
              e.preventDefault()
              handOffToPalette.current = false
            }
          }}
        >
          {/* Panel already renders the heading, so the Radix title is a span that only supplies aria-labelledby. */}
          <Panel
            title={
              <Dialog.Title asChild>
                <span>Ustawienia</span>
              </Dialog.Title>
            }
            code="CFG"
            className="max-h-[calc(100dvh-5rem)]"
            actions={
              <Dialog.Close asChild>
                <HudButton size="sm" aria-label="Zamknij ustawienia" icon={<IconX />} className="mr-2" />
              </Dialog.Close>
            }
            bodyClassName="p-4 flex flex-col gap-4 overflow-y-auto"
          >
            {onOpenPalette && (
              <Dialog.Close asChild>
                <HudButton
                  size="sm"
                  icon={<IconCommand />}
                  onClick={() => {
                    handOffToPalette.current = true
                    onOpenPalette()
                  }}
                >
                  Paleta poleceń · Ctrl K
                </HudButton>
              </Dialog.Close>
            )}
            <div className="flex flex-col gap-1.5">
              <span id="jx-set-hue" className="jx-label">
                Kolor akcentu · {s.hue}°
              </span>
              <input
                type="range"
                min={0}
                max={359}
                value={s.hue}
                aria-labelledby="jx-set-hue"
                onChange={(e) => s.set({ hue: Number(e.target.value) })}
                className="accent-[var(--jx-accent)] w-full"
              />
              <div className="flex gap-1.5" role="group" aria-label="Gotowe odcienie">
                {HUE_SWATCHES.map((h) => (
                  <button
                    key={h}
                    type="button"
                    aria-label={`Odcień ${h}°`}
                    aria-pressed={s.hue === h}
                    onClick={() => s.set({ hue: h })}
                    className={`size-6 cursor-pointer border ${s.hue === h ? 'border-white shadow-[0_0_8px_currentColor]' : 'border-white/20'}`}
                    style={{ background: `hsl(${h} 100% 52%)`, color: `hsl(${h} 100% 52%)` }}
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="jx-set-volume" className="jx-label">
                Głośność · {Math.round(s.volume * 100)}%
              </label>
              <input
                id="jx-set-volume"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={s.volume}
                onChange={(e) => s.set({ volume: Number(e.target.value) })}
                className="accent-[var(--jx-accent)] w-full"
              />
            </div>

            <fieldset className="flex flex-col gap-1.5">
              <legend className="jx-label mb-1">Jakość efektów</legend>
              <div className="flex flex-wrap gap-1">
                {(Object.keys(QUALITY_LABELS) as QualityPref[]).map((q) => (
                  <HudButton key={q} size="sm" active={s.quality === q} onClick={() => s.set({ quality: q })}>
                    {QUALITY_LABELS[q]}
                  </HudButton>
                ))}
              </div>
            </fieldset>

            <fieldset className="flex flex-col gap-1.5">
              <legend className="jx-label mb-1">Ruch</legend>
              <div className="flex flex-wrap gap-1">
                {(Object.keys(MOTION_LABELS) as MotionPref[]).map((m) => (
                  <HudButton key={m} size="sm" active={s.motion === m} onClick={() => s.set({ motion: m })}>
                    {MOTION_LABELS[m]}
                  </HudButton>
                ))}
              </div>
            </fieldset>

            <div className="flex flex-wrap gap-1">
              <HudButton size="sm" active={s.scanlines} onClick={() => s.set({ scanlines: !s.scanlines })}>
                Linie skanowania
              </HudButton>
              <HudButton size="sm" active={!s.bootSeen} title="Odtwórz sekwencję rozruchu przy następnym otwarciu" onClick={() => s.set({ bootSeen: !s.bootSeen })}>
                Rozruch przy następnym starcie
              </HudButton>
              <HudButton size="sm" onClick={() => s.set({ ...DEFAULT_SETTINGS, bootSeen: true })}>
                Przywróć domyślne
              </HudButton>
            </div>
          </Panel>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
