# Architektura — JARVIS FX · Mission Control

Dokument dla osób rozwijających projekt. Skrót jest w [README](../README.md); licencje w
[LICENSES.md](../LICENSES.md).

## 1. Zasady projektu

| Zasada | Jak egzekwujemy |
|---|---|
| **Uczciwość danych** | Dane syntetyczne mają flagę `synthetic` i plakietkę **DEMO**. Telemetria przeglądarki jest prawdziwa; niedostępne API pokazujemy jako „n/d”, nigdy nie zmyślamy wartości. |
| **Licencje** | Tylko kod i zasoby permisywne. Porty mają nagłówek ze źródłem, licencją i „ported/adapted”. Rejestr zasobów: `src/data/resources.ts` (widok Arsenał). |
| **Wydajność** | Każdy efekt sprząta wszystko przy odmontowaniu (rAF, interwały, obserwatory, konteksty WebGL, `vanta.destroy()`, tsParticles, `echarts.dispose()`), respektuje `paused` i `quality`. Karty WebGL działają w puli slotów. |
| **Dostępność** | Kontrolki osiągalne z klawiatury, `aria-label` po polsku, Radix dla okien i podpowiedzi, `prefers-reduced-motion` + przełącznik ruchu. |
| **Akcent** | Kolor akcentu zawsze pochodzi z odcienia `--jx-hue` (CSS), `useAccent()` (hex dla bibliotek) albo `FxProps.accent` — nigdy na sztywno. |

## 2. Warstwy

```
┌─ App.tsx ─ powłoka: nagłówek, nawigacja (Alt+1…6), Ctrl+K, ustawienia, rozruch, Tooltip.Provider
│   ├─ shell/        CommandPalette (cmdk w Radix Dialog), SettingsMenu (Radix Dialog)
│   ├─ views/*       widoki ładowane leniwie (React.lazy), każdy w ErrorBoundary
│   │    └─ fx/FxHost → effects/<id>/index.tsx (leniwe chunki)
│   ├─ hud/          prymitywy wizualne: Panel, Frame, Decipher, Glitch, HudButton, Readout, Backdrop
│   └─ lib/          store · router · sound · agents · telemetry
└─ styles/           tokens.css → hud.css (@layer components) → global.css (Tailwind + @theme)
```

## 3. Stan, ustawienia i routing

- **`lib/store.ts`** — zustand z `persist` (`localStorage['jx-settings']`, wersja 1): dźwięk i głośność,
  ruch (`auto | full | reduced`), jakość (`auto | low | med | high`), odcień, linie skanowania, `bootSeen`,
  `agentSource`. `App` zapisuje `--jx-hue` na `:root` i atrybut `data-motion`.
  - `useAccent()` → `{ hue, hex, hex2, dim }` dla three.js, ECharts i kanw.
  - `useReducedMotion()` łączy preferencję systemową z przełącznikiem.
  - `resolveQuality('auto')` zgaduje jakość z liczby rdzeni, pamięci i typu wskaźnika.
- **`lib/router.ts`** — router na hashu: `#/bridge`, `#/gallery/<fxId>`, `#/agents`, `#/sound`,
  `#/arsenal`, `#/boot`. Tryb solo `?fx=<id>` renderuje jeden efekt bez powłoki (zrzuty, osadzanie).
  Arsenał trzyma zakładkę w drugim segmencie (`#/arsenal/paleta`) przez `history.replaceState`.

## 4. System wizualny

- **Tokeny** (`styles/tokens.css`): powierzchnie, akcent (wszystko liczone z `--jx-hue`), tekst, kolory
  semantyczne, poświaty, role fontów i zmienne dla ARWES (`--arwes-frames-*`) i augmented-ui (`--aug-*`).
- **Most Tailwind** (`styles/global.css`, `@theme inline`): każdy token jest też klasą — `text-jx-accent`,
  `bg-jx-panel`, `border-jx-line`, `font-head`, `font-mono`…
- **Kolejność warstw CSS**: augmented-ui w `layer(base)`, klasy `jx-*` w `@layer components`, więc
  narzędzia Tailwind (`utilities`) zawsze wygrywają — `!important` nie jest potrzebny.
- **Klasy semantyczne**: `jx-aug` (panel augmented-ui), `jx-aug-btn`, `jx-label`, `jx-title`, `jx-num`,
  `jx-display`, `jx-glow-text`, `jx-grid-bg`, `jx-dot`, `jx-caret`, `jx-frame-host`.
- **Fonty**: 12 krojów OFL z Fontsource (`styles/fonts.ts`, `FONT_ROLES`). Orbitron i Share Tech Mono nie
  mają polskich znaków — tekst z diakrytykami składamy Michromą, Oxanium, Chakra Petch albo JetBrains Mono.
- **Wydajność renderowania**: duże panele `jx-aug` mają `backdrop-filter: blur()`; nie animuj ich co klatkę
  (SwiftShader i słabsze GPU odmalowują je kosztownie). `will-change: transform` pomaga przy kafelkach.

## 5. Efekty

### 5.1 Rejestr i kontrakt

```ts
// src/fx/registry.ts
const metas = import.meta.glob<FxMeta>('./effects/*/meta.ts', { eager: true, import: 'meta' })   // małe, od razu
const loaders = import.meta.glob<{ default: FxComponent }>('./effects/*/index.tsx')            // leniwe chunki
```

`meta.id` musi równać się nazwie folderu (ostrzeżenie w konsoli w przeciwnym razie). Kolejność: kategoria
(`FX_CATEGORIES`), potem `order`, potem tytuł (`localeCompare('pl')`).

`FxProps`: `accent`, `accent2`, `hue`, `quality`, `reducedMotion`, `stage`, `paused`. W kartach galerii
`quality` jest zawsze `'low'`, a `stage = false` (~260 × 160 px) — efekt powinien renderować lżej.

### 5.2 FxHost

Montuje komponent w `Suspense` + `ErrorBoundary`, podaje wspólne propsy z ustawień i ustawia
`paused = true`, gdy karta jest poza ekranem lub karta przeglądarki jest ukryta (`visibilitychange`).

### 5.3 Parametry na żywo

`useFxControls(schema)` (`fx/controls.tsx`) używa osobnego magazynu Leva na scenę. Na scenie panel Leva
jest widoczny, w kartach — nie, więc efekt dostaje wartości domyślne schematu. 2–6 parametrów na efekt.

### 5.4 Pula kontekstów WebGL (`fx/slots.ts`)

Przeglądarki ograniczają liczbę żywych kontekstów WebGL (~16). Karta z `meta.webgl = true` wywołuje
`useWebglSlot(webgl, visible)`; sloty przydzielane są w kolejności FIFO, limit ustawia galeria
(`setWebglSlotLimit`: 3/4/6 zależnie od jakości, 1 gdy otwarta jest scena). Najechanie kursorem na kartę bez
slotu wymusza przejęcie najstarszego. Karty bez WebGL zawsze dostają `true`.

### 5.5 HudComposer (`fx/three/HudComposer.tsx`)

Każdy post-processing R3F idzie przez `<HudComposer>`. Wrapper wykrywa renderer programowy
(SwiftShader, llvmpipe — `WEBGL_debug_renderer_info`) i wybiera bufor `UnsignedByteType` zamiast
`HalfFloatType`, bo half-float na rendererze programowym daje czarny obraz. `multisampling = 0`.
W `<Canvas>` przy `paused` używamy `frameloop="demand"`. `drei <Environment preset>` pobiera HDR z CDN
(zablokowanego) — oświetlenie budujemy z `<Lightformer>`.

### 5.6 Vanta.js na three@0.134

Vanta nie działa z three 0.187. `package.json` instaluje drugą kopię pod aliasem
`"three-vanta": "npm:three@^0.134.0"`, a `fx/effects/bg-kit/useVanta.ts` przekazuje ją przez opcję `THREE`.
Adapter steruje własną pętlą Vanty (brak API pauzy), aktualizuje opcje przez `setOptions()` i przy
odmontowaniu zwalnia render targety, geometrie, materiały, renderer i kontekst. Typy: `src/types/vanta.d.ts`.

### 5.7 tsParticles 4

`@tsparticles/react` v4 zastąpił `initParticlesEngine()` komponentem `<ParticlesProvider init>`, którego
`init` musi być jedną stabilną funkcją w całej aplikacji. Jest nią `jxParticlesInit` z
`fx/effects/particles-kit/engine.ts` (ładuje pakiet slim i rejestruje kształt `jx-glyph`) — każdy nowy
moduł z cząsteczkami musi jej używać.

## 6. ARWES (pakiety vanilla) i alias motion@10

ARWES jest nieutrzymywany, a jego pakiety React wspierają tylko React 18. Używamy wyłącznie pakietów
vanilla: `@arwes/frames` (ramki SVG — `hud/Frame.tsx`), `@arwes/text` (deszyfracja — `hud/Decipher.tsx`),
`@arwes/bgs` + `@arwes/animator` (tła — `hud/Backdrop.tsx` z własnym „animator shim”).

Pakiety te importują `motion` i oczekują API Motion 10 (`timeline`, `glide`), a aplikacja używa Motion 14.
Rozwiązanie w `vite.config.ts`:

```ts
// import 'motion' z wnętrza node_modules/@arwes/* → alias "motion-v10" (npm:motion@^10.18.0)
resolveId(source, importer) {
  if (source === 'motion' && importer && /[\\/]@arwes[\\/]/.test(importer)) return this.resolve('motion-v10', importer, { skipSelf: true })
}
```

Ta sama wtyczka jest podpięta do pre-bundlera Rolldown (`optimizeDeps.rolldownOptions.plugins`), bo
optymalizator zależności nie uruchamia wtyczek Vite. `.npmrc` ma `legacy-peer-deps=true`, ponieważ ARWES
deklaruje peer React 18.

## 7. Agenci

Kontrakt (`lib/agents/types.ts`, stabilny):

```ts
interface AgentSource {
  label: string                     // np. "DEMO · symulator" albo "ws://localhost:8651/agents"
  kind: 'demo' | 'ws' | 'sse'
  synthetic: boolean                // true → interfejs MUSI pokazać plakietkę DEMO
  subscribe(cb: (snap: OrchestrationSnapshot) => void,
            onStatus?: (s: 'connecting' | 'live' | 'error', detail?: string) => void): () => void
}
```

- Źródło emituje **pełne migawki** (`agents`, `links`, `events` — najnowsze na końcu, ~200, `tasks`); widoki
  ich nie mutują.
- `createDemoSource()` — symulator (synthetic = true). `createRemoteSource(url)` — `ws(s)://` → WebSocket,
  `http(s)://` → EventSource; jedna migawka JSON na wiadomość / `data:`; ponowne łączenie z opóźnieniem
  wykładniczym (0,5 s → maks. 15 s); błędny JSON → status `error` z opisem.
- `useAgents()` (`lib/agents/index.ts`) to magazyn zustand z licznikiem referencji: pierwszy konsument
  otwiera źródło, ostatni je zamyka; zmiana `settings.agentSource` przełącza źródło.
- Własne źródło (np. orkiestrator LLM): wystaw endpoint WS/SSE wysyłający `OrchestrationSnapshot` albo
  dopisz nowy `AgentSource` i rozszerz `makeSource()`.

## 8. Telemetria

`lib/telemetry` — współdzielony próbnik 1 Hz (jedna pętla rAF + jeden interwał niezależnie od liczby
konsumentów): FPS i czasy klatek, pamięć JS (gdy dostępna), Network Information, bateria, magazyn,
długie zadania (`PerformanceObserver('longtask')`). Nieobsługiwane API → `null` → „n/d”.

## 9. Dźwięk

Jedno API: `playBleep(name)` (`lib/sound`), 11 nazw w konwencji ARWES (`click`, `hover`, `open`, `close`,
`type`, `success`, `error`, `alert`, `scan`, `boot`, `toggle`). Szanuje wyciszenie i głośność, ogranicza
częstotliwość (np. `type` co ≥ 30 ms, `hover` co ≥ 60 ms).

| Priorytet | Backend | Źródło | Licencja |
|---|---|---|---|
| 1 | Kenney (opcjonalny) | `public/sounds/kenney/**` z `scripts/fetch-kenney.mjs` | CC0 |
| 2 | WAV przez howler | `public/sounds/synth/*.wav` z `scripts/render-sounds.mjs` | CC0 (własne) |
| 3 | Synteza WebAudio | `lib/sound/synth.ts` | CC0 (własna) |

`public/sounds/index.json` wylicza paczki (aplikacja nie zgaduje ścieżek → zero błędów 404). Backendy
plikowe ładują się w czasie bezczynności (`requestIdleCallback`) dopiero, gdy dźwięk jest włączony.
`onBleep()` emituje zdarzenia dla wizualizacji w laboratorium dźwięku. Szczegóły formatu:
`public/sounds/README.md`.

## 10. Powłoka

- **Paleta poleceń** (`shell/CommandPalette.tsx`) — `cmdk` w `@radix-ui/react-dialog` (fokus, Escape,
  ARIA z Radix), skórka augmented-ui. Grupy: Nawigacja, System (dźwięk, linie skanowania, ruch, jakość,
  ponowny rozruch), Odcień akcentu, Efekty × kategorie. Filtr = `defaultFilter` z cmdk po złożeniu
  diakrytyków (`ą→a`, `ł→l`), więc „czasteczki” znajduje „Cząsteczki”. Słowa kluczowe efektu: `tech`,
  `tags`, kategoria, licencja. Bleepy: `open`/`close`, `type` przy pisaniu, `click`/`toggle`/`success` po
  wyborze. Ponowny rozruch: `set({ bootSeen: false })` i przeładowanie strony.
- **Ustawienia** (`shell/SettingsMenu.tsx`) — Radix Dialog jako panel HUD.

## 11. Arsenał i rejestr zasobów

`src/data/resources.ts` — jedna tablica `RESOURCES: Resource[]`:

```ts
interface Resource {
  id: string; name: string; url: string
  category: 'ui' | 'motion' | '3d' | 'fx' | 'icons' | 'data' | 'fonts' | 'sound' | 'templates' | 'lists' | 'infra'
  license: string                       // jak publikuje autor (SPDX, gdy istnieje)
  licenseFlag: 'ok' | 'care' | 'avoid'  // OK / UWAGA / STOP
  usage: 'code' | 'reference' | 'excluded'
  where: string[]                       // 'view:bridge' · 'fx:<id>' · 'code:<ścieżka>'
  fxMatch?: RegExp                      // automatyczne powiązanie z efektami po meta (tech, licencja, źródło)
  pkg?: string[]; note: string; verified?: string; extra?: boolean
}
```

Widok (`views/arsenal/`) liczy statystyki na żywo z rejestru i z `FX` — nowy efekt, którego `meta.tech`
wspomina np. „GSAP”, sam pojawi się przy zasobie GSAP. Zakładki: Rejestr (filtry, liczniki, legenda,
szczegóły), Typografia, Ikony (podzbiór game-icons w `src/data/gameIconsArsenal.ts`), Kształty, Paleta
(odcień na żywo, wartości tokenów i kontrast WCAG liczony z wyliczonych kolorów).

Podzbiór game-icons regeneruje się jednym poleceniem (lista nazw w pliku):

```bash
node -e 'const j=require("./node_modules/@iconify-json/game-icons/icons.json");const n=["cpu","holosphere"];console.log(JSON.stringify({prefix:j.prefix,width:j.width,height:j.height,icons:Object.fromEntries(n.map(k=>[k,j.icons[k]]))}))'
```

`docs/gen-licenses.mjs` przepisuje tabele zależności w `LICENSES.md` z `node_modules` (pole `license`,
w razie braku — rozpoznanie tekstu pliku LICENSE) i wykrywa importy z `src/`, które są tylko zależnościami
przechodnimi.

## 12. Weryfikacja

```bash
npx tsc -p tsconfig.app.json --noEmit         # typy
npx oxlint src                                # lint
node scripts/shoot.mjs --wait 6000 fx:<id> view:gallery view:arsenal/paleta   # zrzuty → shots/*.png
```

`shoot.mjs` (Playwright + Chromium z SwiftShader) wypisuje JSON z błędami konsoli i `pageerror` dla
każdego celu; obsługuje `--hue`, `--motion`, `--quality`, `--click`, `--w/--h`, `--dsf`, `--jpeg`.
Cele WebGL potrzebują `--wait 6000+` (renderer programowy jest wolny). Równoległe serwery deweloperskie
mogą używać osobnych katalogów cache: `VITE_CACHE_DIR=node_modules/.vite-<nazwa> npx vite --port 518x`.

## 13. Znane ograniczenia

- Dwie kopie three.js (0.187 i 0.134 dla Vanty) zwiększają paczkę; efekty Vanta są leniwe.
- `@arwes/bleeps`, `@arwes/animated` i `ogl` są zainstalowane, ale nieimportowane bezpośrednio (kandydaci
  do usunięcia z `package.json`, jeśli nie będą potrzebne). `three-stdlib` i `powerglitch` są importowane
  bezpośrednio, a zadeklarowane tylko przechodnio (przez drei i react-powerglitch).
- Fonty Orbitron i Share Tech Mono nie mają polskich znaków (fallback na następny font ze stosu).
