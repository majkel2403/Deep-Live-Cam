import type { ReactNode } from 'react'
import {
  IconAlertOctagon,
  IconAlertTriangle,
  IconCircleCheck,
  IconHandFinger,
  IconKeyboard,
  IconPointer,
  IconPower,
  IconRadar,
  IconToggleRight,
  IconWindowMaximize,
  IconWindowMinimize,
} from '@tabler/icons-react'
import type { Backend, BleepName } from '@/lib/sound'

export const BLEEP_INFO: Record<BleepName, { label: string; desc: string; icon: ReactNode }> = {
  click: { label: 'Kliknięcie', desc: 'Naciśnięcie przycisku HUD.', icon: <IconPointer /> },
  hover: { label: 'Najechanie', desc: 'Kursor nad aktywnym elementem — najcichszy.', icon: <IconHandFinger /> },
  open: { label: 'Otwarcie', desc: 'Panel, okno lub paleta poleceń.', icon: <IconWindowMaximize /> },
  close: { label: 'Zamknięcie', desc: 'Zwinięcie panelu lub okna.', icon: <IconWindowMinimize /> },
  type: { label: 'Znak', desc: 'Tik odszyfrowywanego tekstu (Decipher).', icon: <IconKeyboard /> },
  success: { label: 'Sukces', desc: 'Potwierdzenie, koniec rozruchu.', icon: <IconCircleCheck /> },
  error: { label: 'Błąd', desc: 'Podwójny niski sygnał błędu.', icon: <IconAlertOctagon /> },
  alert: { label: 'Alarm', desc: 'Podwójny sygnał ostrzegawczy.', icon: <IconAlertTriangle /> },
  scan: { label: 'Skan', desc: 'Przemiatanie radaru, namierzanie.', icon: <IconRadar /> },
  boot: { label: 'Rozruch', desc: 'Narastające zasilanie — tylko sekwencja startowa.', icon: <IconPower /> },
  toggle: { label: 'Przełącznik', desc: 'Zmiana stanu przełącznika.', icon: <IconToggleRight /> },
}

export const BACKEND_INFO: Record<Backend, { label: string; short: string; tone: string }> = {
  synth: { label: 'Synteza WebAudio', short: 'SYNTEZA', tone: 'text-jx-violet border-jx-violet/50' },
  wav: { label: 'WAV przez howler', short: 'WAV', tone: 'text-jx-accent border-jx-accent/50' },
  kenney: { label: 'Kenney (CC0)', short: 'KENNEY', tone: 'text-jx-ok border-jx-ok/50' },
}

export const dbfs = (x: number) => (x > 0 ? 20 * Math.log10(x) : -Infinity)
/** Polish number format with a real minus sign, e.g. "−13,5 dBFS" */
export const fmtDb = (x: number) => (Number.isFinite(dbfs(x)) ? `${dbfs(x).toFixed(1).replace('.', ',').replace('-', '\u2212')} dBFS` : '—')

export const CTX_STATE_PL: Record<string, string> = { running: 'działa', suspended: 'wstrzymany', closed: 'zamknięty', interrupted: 'przerwany', none: 'brak' }
