import * as Dialog from '@radix-ui/react-dialog'
import { IconSettings, IconX } from '@tabler/icons-react'
import { HudButton, Panel } from '@/hud'
import { DEFAULT_SETTINGS, useSettings, type MotionPref, type QualityPref } from '@/lib/store'
import { playBleep } from '@/lib/sound'

/** Global settings (Radix Dialog primitive, restyled as a HUD panel). */
export function SettingsMenu() {
  const s = useSettings()
  return (
    <Dialog.Root onOpenChange={(o) => playBleep(o ? 'open' : 'close')}>
      <Dialog.Trigger asChild>
        <HudButton size="sm" aria-label="Ustawienia" icon={<IconSettings />} />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed z-50 right-4 top-16 w-[min(380px,calc(100vw-2rem))] outline-none" aria-describedby={undefined}>
          <Panel
            title={<Dialog.Title>Ustawienia</Dialog.Title>}
            code="CFG"
            actions={
              <Dialog.Close asChild>
                <HudButton size="sm" aria-label="Zamknij" icon={<IconX />} className="mr-2" />
              </Dialog.Close>
            }
            bodyClassName="p-4 flex flex-col gap-4"
          >
            <label className="flex flex-col gap-1">
              <span className="jx-label">Kolor akcentu · {s.hue}°</span>
              <input type="range" min={0} max={359} value={s.hue} onChange={(e) => s.set({ hue: Number(e.target.value) })} className="accent-[var(--jx-accent)]" />
              <div className="flex gap-1">
                {[188, 200, 160, 28, 350, 265].map((h) => (
                  <button key={h} aria-label={`Odcień ${h}`} onClick={() => s.set({ hue: h })} className="size-5 border border-white/20 cursor-pointer" style={{ background: `hsl(${h} 100% 52%)` }} />
                ))}
              </div>
            </label>
            <label className="flex flex-col gap-1">
              <span className="jx-label">Głośność · {Math.round(s.volume * 100)}%</span>
              <input type="range" min={0} max={1} step={0.05} value={s.volume} onChange={(e) => s.set({ volume: Number(e.target.value) })} className="accent-[var(--jx-accent)]" />
            </label>
            <fieldset className="flex flex-col gap-1">
              <legend className="jx-label mb-1">Jakość efektów</legend>
              <div className="flex gap-1">
                {(['auto', 'low', 'med', 'high'] as QualityPref[]).map((q) => (
                  <HudButton key={q} size="sm" active={s.quality === q} onClick={() => s.set({ quality: q })}>
                    {{ auto: 'Auto', low: 'Niska', med: 'Średnia', high: 'Wysoka' }[q]}
                  </HudButton>
                ))}
              </div>
            </fieldset>
            <fieldset className="flex flex-col gap-1">
              <legend className="jx-label mb-1">Ruch</legend>
              <div className="flex gap-1">
                {(['auto', 'full', 'reduced'] as MotionPref[]).map((m) => (
                  <HudButton key={m} size="sm" active={s.motion === m} onClick={() => s.set({ motion: m })}>
                    {{ auto: 'Systemowy', full: 'Pełny', reduced: 'Ograniczony' }[m]}
                  </HudButton>
                ))}
              </div>
            </fieldset>
            <div className="flex flex-wrap gap-1">
              <HudButton size="sm" active={s.scanlines} onClick={() => s.set({ scanlines: !s.scanlines })}>
                Linie skanowania
              </HudButton>
              <HudButton size="sm" onClick={() => s.set({ bootSeen: false })}>
                Rozruch przy starcie
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
