# J.A.R.V.I.S FX · Mission Control

Futurystyczny interfejs HUD w stylu filmowych FUI (Iron Man / Oblivion / TRON), zbudowany w całości z
**darmowego** stosu UI/UX. Aplikacja jest jednocześnie centrum dowodzenia (telemetria przeglądarki, agenci,
dźwięk) i **żywym katalogiem** ponad 40 efektów: sceny 3D, tła, cząsteczki, elementy HUD, loadery, tekst,
wykresy i choreografie ruchu — każdy z parametrami na żywo, licencją i źródłem.

Interfejs jest po polsku. Dane syntetyczne (symulator agentów) są zawsze oznaczone plakietką **DEMO**;
telemetria przeglądarki na Mostku jest prawdziwa.

| | |
|---|---|
| ![Mostek](docs/screens/bridge.png) | ![Galeria FX](docs/screens/gallery.png) |
| ![Agenci](docs/screens/agents.png) | ![Dźwięk](docs/screens/sound.png) |
| ![Arsenał](docs/screens/arsenal.png) | ![Rozruch](docs/screens/boot.png) |

> Zrzuty ekranu trafiają do `docs/screens/*.png` (np. `node scripts/shoot.mjs view:bridge` i skopiowanie
> pliku z `shots/`). Do czasu ich dodania powyższe odnośniki są puste.

## Szybki start

```bash
cd jarvis-fx
npm install          # .npmrc ustawia legacy-peer-deps (ARWES deklaruje React 18)
npm run dev          # http://127.0.0.1:5173
npm run build        # tsc -b + vite build → dist/
npm run lint         # oxlint
```

Wymagania: Node ≥ 20 (zalecany 22+), przeglądarka z WebGL2. Bez sieci w czasie działania: fonty, ikony i
dźwięki są hostowane lokalnie.

| Skrót | Działanie |
|---|---|
| `Ctrl/⌘ + K` | Paleta poleceń: widoki, wszystkie efekty (wyszukiwanie rozmyte, bez polskich znaków też działa), dźwięk, linie skanowania, odcień, jakość, ruch, ponowny rozruch |
| `Alt + 1…6` | Mostek · Galeria FX · Agenci · Dźwięk · Arsenał · Rozruch |
| `?fx=<id>` | Pojedynczy efekt na pełnym ekranie (zrzuty, osadzanie) |
| `#/gallery/<id>` | Galeria z otwartą sceną efektu |
| `#/arsenal/<zakładka>` | `typografia`, `ikony`, `ksztalty`, `paleta` |

## Widoki

| Widok | Co pokazuje |
|---|---|
| **Mostek** | Rdzeń 3D (R3F), radialny HUD (GSAP), prawdziwa telemetria przeglądarki (FPS, pamięć, sieć, długie zadania), zegary ECharts, sparkline’y visx, agenci i zadania (DEMO). |
| **Galeria FX** | Wszystkie efekty z rejestru jako karty na żywo + scena z panelem Leva. Karty WebGL korzystają z puli kontekstów. |
| **Agenci** | Topologia 2D/3D (react-force-graph), oś zdarzeń, szczegóły agenta (radar umiejętności, tracker dostępności z Tremor). Źródło: symulator albo WebSocket/SSE. |
| **Dźwięk** | Laboratorium bleepów: synteza WebAudio, nasze WAV-y (howler), opcjonalnie Kenney; oscyloskop, use-sound, polityka licencji. |
| **Arsenał** | Rejestr wszystkich zasobów z raportu (licencja, flaga, gdzie użyte) + specimeny fontów, ikon, kształtów i palety. |
| **Rozruch** | Sekwencja startowa (GSAP SplitText/DrawSVG/MorphSVG/ScrambleText, PowerGlitch). |

## Stos

React 19 · Vite 8 (Rolldown) · TypeScript 7 · Tailwind v4 · ARWES (pakiety vanilla) · augmented-ui ·
Motion 14 · GSAP 3 (wszystkie wtyczki) · anime.js 4 · React Three Fiber 9 + drei 10 + postprocessing 3 +
@react-spring/three + @react-three/uikit + @theatre/core · tsParticles 4 · Vanta.js · PowerGlitch ·
Tabler / Lucide / Phosphor / Material Symbols / game-icons (Iconify) · ECharts 6 · visx ·
react-force-graph · howler + use-sound · lottie-react · react-spinners · cmdk · Radix · zustand · Leva ·
Fontsource (12 fontów OFL).

Pełna lista z licencjami: **[LICENSES.md](LICENSES.md)** oraz widok **Arsenał** w aplikacji.

## Architektura w skrócie

```
src/
  App.tsx              powłoka: nagłówek, nawigacja, skróty, paleta, ustawienia, rozruch
  lib/                 store (zustand, ustawienia + useAccent), router (hash), sound, agents, telemetry
  hud/                 Panel, Frame (ARWES), Decipher, Glitch, HudButton, Readout, Backdrop
  fx/
    types.ts           kontrakt efektu (FxMeta, FxProps)
    registry.ts        automatyczny rejestr: import.meta.glob('./effects/*/meta.ts')
    FxHost.tsx         montuje efekt (Suspense + ErrorBoundary + wspólne propsy)
    slots.ts           pula kontekstów WebGL dla kart galerii
    controls.tsx       useFxControls() – parametry Leva per scena
    three/HudComposer  wspólny post-processing bezpieczny dla renderera programowego
    effects/<id>/      meta.ts + index.tsx (jeden folder = jeden efekt)
  views/               bridge · gallery · agents · sound · arsenal · boot
  shell/               CommandPalette (cmdk + Radix Dialog), SettingsMenu
  data/resources.ts    rejestr zasobów i licencji (widok Arsenał)
  styles/              tokens.css (--jx-*), hud.css, global.css (most Tailwind ↔ tokeny), fonts.ts
```

- **Rejestr efektów** — dodanie folderu w `src/fx/effects/` wystarcza; żaden wspólny plik nie wymaga edycji.
- **Kontrakt efektu** — komponent wypełnia rodzica i dostaje `accent`, `accent2`, `hue`, `quality`,
  `reducedMotion`, `stage` (duża scena vs karta), `paused`.
- **HudComposer** — cały post-processing R3F przechodzi przez jeden wrapper, który na SwiftShader/llvmpipe
  wybiera bufor 8-bit zamiast half-float (inaczej obraz byłby czarny).
- **ARWES + motion@10** — pakiety ARWES wymagają API Motion 10; wtyczka w `vite.config.ts` kieruje import
  `motion` z wnętrza `@arwes/*` do aliasu `motion-v10`, a reszta aplikacji używa Motion 14.
- **Pula WebGL** — przeglądarki ograniczają liczbę kontekstów (~16); karty WebGL w galerii muszą mieć
  „slot” (3–6 zależnie od jakości); pozostałe pokazują statyczny podgląd i przejmują najstarszy slot po
  najechaniu kursorem.
- **Źródło agentów** — jeden kontrakt `AgentSource` (symulator DEMO, WebSocket, SSE) i pełne migawki JSON.

Szczegóły: **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

## Jak dodać efekt

1. Wybierz unikalne `id` z prefiksem kategorii: `r3f-`, `bg-`, `particles-`, `hud-`, `loader-`, `text-`, `data-`, `motion-`.
2. Utwórz `src/fx/effects/<id>/meta.ts`:

   ```ts
   import type { FxMeta } from '@/fx/types'
   export const meta: FxMeta = {
     id: 'hud-moj-efekt', // = nazwa folderu
     title: 'Mój efekt',
     category: 'hud',
     description: 'Jedno–dwa zdania po polsku: co widać i z czego jest zbudowane.',
     tech: ['Canvas 2D'],
     license: 'MIT (kod własny)',
     source: { label: 'inspiracja / port', url: 'https://…' }, // gdy przeniesione lub inspirowane
     cost: 1,
     tags: ['radar'],
   }
   ```

3. Utwórz `src/fx/effects/<id>/index.tsx` z domyślnym eksportem przyjmującym `FxProps`:

   ```tsx
   import type { FxProps } from '@/fx/types'
   import { useFxControls } from '@/fx/controls'

   export default function Fx({ accent, quality, reducedMotion, stage, paused }: FxProps) {
     const { speed } = useFxControls({ speed: { value: 1, min: 0, max: 3, label: 'Prędkość' } })
     // wypełnij rodzica, posprzątaj rAF/obserwatory przy odmontowaniu, uszanuj paused i reducedMotion
     return <div className="absolute inset-0" style={{ color: accent }} />
   }
   ```

4. WebGL: ustaw `webgl: true`, post-processing tylko przez `<HudComposer>`, a w `<Canvas>` przy `paused`
   użyj `frameloop="demand"`. `drei <Environment preset>` pobiera HDR z CDN — używaj `<Lightformer>`.
5. Kod przeniesiony z innego projektu: nagłówek z adresem źródła, licencją i „ported/adapted”; potem
   wpis w `src/data/resources.ts` i `node docs/gen-licenses.mjs`, jeśli doszła zależność.
6. Sprawdź: `node scripts/shoot.mjs --wait 6000 fx:<id> view:gallery` i obejrzyj PNG w `shots/`.

## Jak podłączyć prawdziwe źródło agentów

Widok **Agenci → Źródło** (lub ustawienie `agentSource` w `localStorage['jx-settings']`) przyjmuje:

- `demo` — wbudowany symulator (plakietka **DEMO** w całym interfejsie),
- `ws://host:port/ścieżka` lub `wss://…` — WebSocket, **jedna pełna migawka JSON na wiadomość**,
- `http(s)://host/ścieżka` — Server-Sent Events, jedna migawka na zdarzenie `data:`.

Migawka to `OrchestrationSnapshot` z `src/lib/agents/types.ts`:

```json
{
  "ts": 1763258400000,
  "agents": [{ "id": "a1", "name": "Planista", "role": "orkiestrator", "model": "…", "status": "running",
               "load": 0.42, "latencyMs": 820, "tokensPerMin": 5400, "successRate": 0.97, "queue": 2,
               "skills": { "plan": 0.9, "code": 0.4, "search": 0.6, "memory": 0.7, "voice": 0.1, "vision": 0.2 },
               "history": [0.3, 0.35, 0.42], "uptime": [true, true, false, true] }],
  "links": [{ "source": "a1", "target": "a2", "kind": "delegates", "traffic": 12 }],
  "events": [{ "id": "e1", "ts": 1763258400000, "agentId": "a1", "level": "info", "text": "Przydzielono zadanie" }],
  "tasks": [{ "id": "t1", "title": "Analiza logów", "ownerId": "a2", "progress": 0.4, "state": "active", "startedAt": 1763258300000 }]
}
```

Adapter (`src/lib/agents/remote.ts`) łączy się ponownie z wykładniczym opóźnieniem (do 15 s) i pokazuje
status połączenia. Minimalny serwer testowy (Node, pakiet `ws`):

```js
import { WebSocketServer } from 'ws'
const wss = new WebSocketServer({ port: 8651, path: '/agents' })
wss.on('connection', (ws) => setInterval(() => ws.send(JSON.stringify(buildSnapshot())), 1000))
```

## Jak dodać dźwięki Kenney

Aplikacja ma trzy backendy bleepów (wybór per dźwięk w widoku **Dźwięk**): opcjonalne paczki Kenney (CC0),
nasze WAV-y CC0 (`public/sounds/synth/`) i syntezę WebAudio (zawsze dostępna).

```bash
node scripts/fetch-kenney.mjs                          # pobierz Interface Sounds + Sci-fi Sounds z kenney.nl
node scripts/fetch-kenney.mjs --from-dir ~/Downloads    # albo użyj ręcznie pobranych kenney_*.zip
node scripts/fetch-kenney.mjs --remove                 # odinstaluj
```

Skrypt rozpakowuje tylko audio i licencję do `public/sounds/kenney/`, mapuje pliki na bleepy w
`manifest.json` i dopisuje paczkę do `public/sounds/index.json`. Pliki Kenneya nie trafiają do repozytorium.
Format manifestu i zasady licencyjne: `public/sounds/README.md`.

## Jak przenieść folder do osobnego repozytorium

Folder `jarvis-fx/` jest samodzielny (własne `package.json`, lockfile, konfiguracje, `.gitignore`).

```bash
# 1) z zachowaniem historii (z katalogu głównego obecnego repozytorium)
git subtree split --prefix=jarvis-fx -b jarvis-fx-only
mkdir ../jarvis-fx && cd ../jarvis-fx && git init
git pull ../<obecne-repo> jarvis-fx-only
git remote add origin git@github.com:<konto>/jarvis-fx.git && git push -u origin main

# 2) albo bez historii
cp -r jarvis-fx ../jarvis-fx && cd ../jarvis-fx && rm -rf node_modules shots && git init
```

Po przeniesieniu: `npm ci && npm run build`. Do hostingu w podkatalogu (np. GitHub Pages) ustaw
`VITE_BASE=/jarvis-fx/ npm run build`. Zrzuty z `docs/screens/` są śledzone wyjątkiem w `.gitignore`.

## Licencje

Kod aplikacji: MIT. Zależności i zasoby mają własne licencje — **[LICENSES.md](LICENSES.md)** (tabele
generowane z `node_modules`: `node docs/gen-licenses.mjs`). Najważniejsze zastrzeżenia: GSAP (darmowa
licencja własnościowa Webflow), React Bits (MIT + Commons Clause), game-icons.net (CC BY 3.0 — atrybucja),
Vanta.js (osobna kopia three@0.134). Kodu z LYGIA, Shadertoy, eDEX-UI i Aceternity UI nie używamy.
