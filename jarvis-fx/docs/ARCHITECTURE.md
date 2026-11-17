# Architektura — JARVIS FX · Mission Control

Dokument dla osób rozwijających projekt. Skrót jest w [README](../README.md); licencje w
[LICENSES.md](../LICENSES.md), pełne teksty licencji w [docs/licenses/](licenses/).

## 1. Zasady projektu

| Zasada | Jak egzekwujemy |
|---|---|
| **Uczciwość danych** | Dane syntetyczne mają flagę `synthetic` i plakietkę **DEMO**. Telemetria przeglądarki jest prawdziwa; niedostępne API pokazujemy jako „n/d”, nigdy nie zmyślamy wartości. |
| **Licencje** | Tylko kod i zasoby permisywne. Porty mają nagłówek ze źródłem, licencją i „ported/adapted”; ten sam wpis trafia do `meta.ts` (`license`, `source`) i do `src/data/resources.ts`. Pełne noty: `LICENSES.md`, `docs/licenses/`. |
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
public/              sounds/ (WAV, index.json) · posters/ (plakaty galerii) · fonty ładuje Fontsource (npm)
scripts/             shoot.mjs · posters.mjs · render-sounds.mjs · fetch-kenney.mjs · check-text-floor.mjs · smoke-keyboard.mjs · subset-material-symbols.py · agents-example-server.mjs
docs/                ARCHITECTURE.md · gen-licenses.mjs · licenses/ · screens/ (zrzuty do README)
```

## 3. Stan, ustawienia i routing

- **`lib/store.ts`** — zustand z `persist` (`localStorage['jx-settings']`, wersja 1): dźwięk i głośność,
  ruch (`auto | full | reduced`), jakość (`auto | low | med | high`), odcień, linie skanowania, `bootSeen`,
  `agentSource`. `App` zapisuje `--jx-hue` na `:root` i atrybut `data-motion`.
  - `useAccent()` → `{ hue, hex, hex2, dim }` dla three.js, ECharts i kanw.
  - `useReducedMotion()` łączy preferencję systemową z przełącznikiem.
  - `resolveQuality('auto')` zgaduje jakość z liczby rdzeni, pamięci i typu wskaźnika.
- **`lib/router.ts`** — router na hashu: `#/bridge`, `#/gallery` (lub `#/gallery/<fxId>`), `#/agents`,
  `#/sound`, `#/arsenal`, `#/boot`. Nieznany widok wraca na Mostek. Tryb solo `?fx=<id>` renderuje jeden efekt
  bez powłoki (zrzuty, osadzanie). Arsenał trzyma zakładkę w drugim segmencie (`#/arsenal/paleta`) przez
  `history.replaceState`; zakładki: `rejestr` (domyślna), `typografia`, `ikony`, `ksztalty`, `paleta`.
- Skróty: `Alt+1…6` przełącza widoki w kolejności Mostek · Galeria FX · Agenci · Dźwięk · Arsenał · Rozruch.

## 4. System wizualny

- **Tokeny** (`styles/tokens.css`): powierzchnie, akcent (wszystko liczone z `--jx-hue`), tekst, kolory
  semantyczne, poświaty, role fontów i zmienne dla ARWES (`--arwes-frames-*`) i augmented-ui (`--aug-*`).
- **Most Tailwind** (`styles/global.css`, `@theme inline`): każdy token jest też klasą — `text-jx-accent`,
  `bg-jx-panel`, `border-jx-line`, `font-head`, `font-mono`…
- **Kolejność warstw CSS**: augmented-ui w `layer(base)`, klasy `jx-*` w `@layer components`, więc
  narzędzia Tailwind (`utilities`) zawsze wygrywają — `!important` nie jest potrzebny.
- **Klasy semantyczne**: `jx-aug` (panel augmented-ui), `jx-aug-btn`, `jx-label`, `jx-title`, `jx-num`,
  `jx-display`, `jx-glow-text`, `jx-grid-bg`, `jx-dot`, `jx-caret`, `jx-frame-host`.
- **Fonty**: 12 krojów OFL z Fontsource (`styles/fonts.ts`, `FONT_ROLES`). `--jx-font-display` to Michroma
  (Orbitron ma tylko podzbiór latin, więc nie nadaje się do polskiego tekstu); Orbitron zostaje wyłącznie w klasie
  `.jx-logo` dla znaku J.A.R.V.I.S. Share Tech Mono też nie ma polskich znaków — tekst z diakrytykami składamy
  Michromą, Oxanium, Chakra Petch albo JetBrains Mono.
- **Wydajność renderowania**: duże panele `jx-aug` mają `backdrop-filter: blur()`; nie animuj ich co klatkę
  (SwiftShader i słabsze GPU odmalowują je kosztownie). `will-change: transform` pomaga przy kafelkach.

## 5. Efekty

Aktualnie **49 efektów** (folderów z `meta.ts`). Obok nich są foldery współdzielonego kodu bez `meta.ts`:
`bg-kit`, `particles-kit`, `motion-kit`, `r3f-kit`, `hud-kit`.

### 5.1 Rejestr i kontrakt

```ts
// src/fx/registry.ts
const metas = import.meta.glob<FxMeta>('./effects/*/meta.ts', { eager: true, import: 'meta' })   // małe, od razu
const loaders = import.meta.glob<{ default: FxComponent }>('./effects/*/index.tsx')            // leniwe chunki
```

`meta.id` musi równać się nazwie folderu (ostrzeżenie w konsoli w przeciwnym razie). Kolejność: kategoria
(`FX_CATEGORIES`), potem `order`, potem tytuł (`localeCompare('pl')`).

`FxMeta` (`fx/types.ts`): `id`, `title`, `category`, `description`, `tech[]`, `license`, opcjonalnie `source`
(`{ label, url }`), `webgl`, `cost` (1–3), `tags[]`, `order`.

Kategorie (`category`): `webgl` (Sceny 3D), `background` (Tła), `particles` (Cząsteczki), `hud` (Elementy HUD),
`loader` (Loadery), `text` (Tekst), `data` (Dane), `motion` (Choreografia). Prefiks identyfikatora zwykle
odpowiada kategorii, ale **kategoria decyduje**: `r3f-*` → `webgl` (10 efektów), `bg-*` → `background` (11),
`particles-*` → `particles` (3), `hud-*` → `hud` (6), `loader-*` → `loader` (4), `text-*` → `text` (4),
`data-*` → `data` (4), `motion-*` → `motion` (7).

`FxProps`: `accent`, `accent2`, `hue`, `quality`, `reducedMotion`, `stage`, `paused`. W kartach galerii
`quality` jest zawsze `'low'`, a `stage = false` — karta galerii (zmierzone: ok. 271 × 251 px przy szerokości 1440 px,
obszar podglądu 16:10 = 271 × 169 px; na telefonie ok. 362 × 285 px). Efekt powinien renderować lżej.

### 5.2 FxHost

Montuje komponent w `Suspense` + `ErrorBoundary`, podaje wspólne propsy z ustawień i ustawia
`paused = true`, gdy karta jest poza ekranem lub karta przeglądarki jest ukryta (`visibilitychange`).

`FxStage` (`fx/FxStage.tsx`) to scena pojedynczego efektu: okno dialogowe z galerii albo tryb `?fx=<id>`. Leży
w `src/fx`, a nie w widoku galerii, żeby `App.tsx` mógł importować go statycznie, nie ciągnąc widoku do głównego
chunka (widok pozostaje leniwy).

### 5.3 Parametry na żywo

`useFxControls(schema)` (`fx/controls.tsx`) używa osobnego magazynu Leva na scenę. Na scenie panel Leva
jest widoczny, w kartach — nie, więc efekt dostaje wartości domyślne schematu. 2–6 parametrów na efekt.

### 5.4 Pula kontekstów WebGL (`fx/slots.ts`)

Przeglądarki ograniczają liczbę żywych kontekstów WebGL (~16). Karta z `meta.webgl = true` wywołuje
`useWebglSlot(webgl, visible)`; sloty przydzielane są w kolejności FIFO. Limit ustawia galeria
(`setWebglSlotLimit`): 3 / 4 / 6 dla jakości low / med / high, a **1 gdy otwarta jest scena** (`fxId`).
Najechanie kursorem na kartę bez slotu wymusza przejęcie najstarszego. Karty bez WebGL zawsze dostają `true`.

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

Dwie kopie three.js to znany koszt: na stronach, na których działa R3F i Vanta, konsola pokazuje ostrzeżenie
„Multiple instances of Three.js”. Nie znika bez zmiany wersji Vanty.

### 5.7 tsParticles 4

`@tsparticles/react` v4 zastąpił `initParticlesEngine()` komponentem `<ParticlesProvider init>`, którego
`init` musi być jedną stabilną funkcją w całej aplikacji. Jest nią `jxParticlesInit` z
`fx/effects/particles-kit/engine.ts` (ładuje pakiet slim i rejestruje kształt `jx-glyph`) — każdy nowy
moduł z cząsteczkami musi jej używać.

### 5.8 Porty i zgodność metadanych

Kod przeniesiony z innego projektu ma **cztery miejsca z tą samą informacją**; przy zmianie licencji lub
źródła trzeba zaktualizować wszystkie:

1. nagłówek pliku (źródło, licencja, autor, opis zmian),
2. `meta.ts` (`license`, `source`),
3. wpis w `src/data/resources.ts` (`license`, `usage`, `where`, `verified`),
4. jeśli licencja wymaga pełnej noty (MIT, Apache-2.0) — plik w `docs/licenses/` i wpis w `LICENSES.md`.

## 6. ARWES (pakiety vanilla) i alias motion@10

ARWES jest nieutrzymywany, a jego pakiety React wspierają tylko React 18. Używamy wyłącznie pakietów
vanilla, każdy w innym miejscu:

| Pakiet | Gdzie | Do czego |
|---|---|---|
| `@arwes/frames` | `hud/Frame.tsx` | ramki SVG w panelach |
| `@arwes/text` | `hud/Decipher.tsx`, `text-arwes-decipher` | deszyfracja tekstu |
| `@arwes/bgs` + `@arwes/animator` | `hud/Backdrop.tsx`, `bg-arwes-layers` | tła; własny „animator shim” w `hud/arwes.ts` |
| `@arwes/animated` | `motion-arwes-animated` | `createAnimatedElement` + `createAnimatorShim` — sekwencja montaż / podtrzymanie / demontaż |
| `@arwes/bleeps` | `lib/sound/arwes.ts` | backend dźwięku „ARWES” (patrz §9) |

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

- Źródło emituje **pełne migawki** `OrchestrationSnapshot`: `ts`, `agents`, `links`, `events` (najnowsze na
  końcu, ~200), `tasks`. Widoki ich nie mutują.
- `Agent`: `id`, `name`, `role`, `model`, `status`, `load` (0–1), `latencyMs`, `tokensPerMin`, `successRate`
  (0–1), `queue`, opcjonalnie `parentId`, `skills` (sześć osi: plan, code, search, memory, voice, vision),
  `history` (próbki obciążenia), `uptime` (`true` = zdrowy tick, `false` = incydent).
- `createDemoSource()` (`demo.ts`) — symulator (`synthetic = true`). `createRemoteSource(url)` (`remote.ts`)
  — `ws(s)://` → WebSocket, `http(s)://` → EventSource; jedna migawka JSON na wiadomość / zdarzenie `data:`;
  ponowne łączenie z opóźnieniem wykładniczym (0,5 s → maks. 15 s); błędny JSON → status `error` z opisem.
- `useAgents()` (`lib/agents/index.ts`) to magazyn zustand z licznikiem referencji: pierwszy konsument
  otwiera źródło, ostatni je zamyka; zmiana `settings.agentSource` przełącza źródło.
- Własne źródło (np. orkiestrator LLM): wystaw endpoint WS/SSE wysyłający `OrchestrationSnapshot` albo
  dopisz nowy `AgentSource` i rozszerz `makeSource()`.

## 8. Telemetria

`lib/telemetry` — współdzielony próbnik 1 Hz (jedna pętla rAF + jeden interwał niezależnie od liczby
konsumentów): FPS i czasy klatek, pamięć JS (gdy dostępna), Network Information, bateria, magazyn,
długie zadania (`PerformanceObserver('longtask')`). Nieobsługiwane API → `null` → „n/d”.

## 9. Dźwięk

API: `playBleep(name)` (`lib/sound`), 11 nazw w konwencji ARWES (`click`, `hover`, `open`, `close`,
`type`, `success`, `error`, `alert`, `scan`, `boot`, `toggle`). Szanuje wyciszenie i głośność, ogranicza
częstotliwość (np. `type` co ≥ 30 ms, `hover` co ≥ 60 ms). `onBleep()` emituje zdarzenia dla wizualizacji
w laboratorium dźwięku.

Preferencja w silniku dźwięku (widok **Dźwięk → Silnik**) decyduje o backendzie:

| Preferencja | Co gra | Źródło | Licencja | Uwagi |
|---|---|---|---|---|
| **Auto** (domyślna) | Kenney, jeśli zainstalowany → WAV → syntezator | różne | różne | kolejność dla każdego bleepa osobno |
| **Kenney** | paczki Kenney | `public/sounds/kenney/**` (`scripts/fetch-kenney.mjs`) | CC0 1.0 | opcjonalne, nie w repozytorium |
| **WAV** | nasze pliki przez howler | `public/sounds/synth/*.wav` (`scripts/render-sounds.mjs`) | CC0 1.0 (własne) | w repozytorium, ~164 KB |
| **ARWES** | te same WAV-y przez `createBleep` z `@arwes/bleeps` | `src/lib/sound/arwes.ts` | MIT | tylko po wyborze; biblioteka ładuje się leniwie; raportuje tylko zdekodowane pliki |
| **Synteza** | oscylatory WebAudio | `lib/sound/synth.ts` | CC0 1.0 (własna) | zawsze dostępna; także fallback podczas ładowania plików |

`public/sounds/index.json` wylicza paczki (aplikacja nie zgaduje ścieżek → zero błędów 404). Backendy
plikowe ładują się w czasie bezczynności (`requestIdleCallback`) dopiero, gdy dźwięk jest włączony.
Szczegóły formatu manifestu i zasady licencyjne: `public/sounds/README.md`.

## 10. Powłoka

- **Paleta poleceń** (`shell/CommandPalette.tsx`) — `cmdk` w `@radix-ui/react-dialog` (fokus, Escape,
  ARIA z Radix), skórka augmented-ui. Grupy: Nawigacja, System (dźwięk, linie skanowania, ruch, jakość,
  ponowny rozruch), Odcień akcentu, Efekty × kategorie. Filtr = `defaultFilter` z cmdk po złożeniu
  diakrytyków (`ą→a`, `ł→l`), więc „czasteczki” znajduje „Cząsteczki”. Słowa kluczowe efektu: `tech`,
  `tags`, kategoria, licencja. Bleepy: `open`/`close`, `type` przy pisaniu, `click`/`toggle`/`success` po
  wyborze. Ponowny rozruch: `set({ bootSeen: false })` i przeładowanie strony.
- **Ustawienia** (`shell/SettingsMenu.tsx`) — Radix Dialog jako panel HUD.
- **Galeria** — karta pokazuje plakat z `public/posters/<id>.jpg`, gdy efekt nie działa (poza ekranem, bez
  slotu WebGL, w ładowaniu); plakat ma fallback na stary placeholder przy 404.

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

- `where` to miejsca użycia: `view:<widok>`, `fx:<id efektu>` (istniejący folder w `src/fx/effects/`),
  `code:<ścieżka pod src/>` (lub pod katalogiem projektu dla skryptów, np. `code:scripts/fetch-kenney.mjs`).
  Wartości są sprawdzane ręcznie przy zmianie; po zmianie efektów warto je przejrzeć.
- `pkg` — pakiety npm, przez które zasób wchodzi do paczki; `verified` — jak sprawdzono licencję (adres pliku
  LICENSE i stan w dniu weryfikacji).
- `fxMatch` linkuje efekty galerii po ich metadanych — nowy efekt, którego `meta.tech` wspomina np. „GSAP”,
  sam pojawi się przy zasobie GSAP.

Widok (`views/arsenal/`) liczy statystyki na żywo z rejestru i z `FX`. Zakładki: Rejestr (filtry, liczniki,
legenda, szczegóły), Typografia, Ikony (podzbiór game-icons w `src/data/gameIconsArsenal.ts`), Kształty,
Paleta (odcień na żywo, wartości tokenów i kontrast WCAG liczony z wyliczonych kolorów).

Podzbiór game-icons (12 ikon w `ARSENAL_GAME_ICONS`) regeneruje się z listy nazw zapisanej w tym pliku:

```bash
node -e 'const fs=require("fs");const src=fs.readFileSync("src/data/gameIconsArsenal.ts","utf8");const names=JSON.parse(src.match(/ARSENAL_GAME_ICONS: string\[\] = (\[.*?\])/)[1]);const j=require("./node_modules/@iconify-json/game-icons/icons.json");console.log(JSON.stringify({prefix:j.prefix,width:j.width,height:j.height,icons:Object.fromEntries(names.map(k=>[k,j.icons[k]]))}))'
```

Wynik wkleja się jako `ARSENAL_GAME_ICONS_SUBSET`.

Czcionka Material Symbols jest w aplikacji podzbiorem (16 ligatur z list `MATERIAL` w `IconsTab.tsx` i `hud-icon-matrix`,
`src/styles/fonts/material-symbols-outlined.subset.woff2`, ok. 35 KB zamiast 4 MB). Przebudowa po zmianie list:
`python3 scripts/subset-material-symbols.py` (fonttools + brotli). Podzbiór efektu „Matryca ikon” (`hud-icon-matrix/gameIcons.ts`, 20 ikon, lista `GAME_ICON_NAMES`) regeneruje się tak samo, z jego listy nazw, a wynik trafia do `GAME_ICONS_SUBSET`.

`docs/gen-licenses.mjs` przepisuje tabele zależności w `LICENSES.md` z `node_modules` (pole `license`, kolumna „Import w `src/`”
mówi, które pakiety są bezpośrednio importowane przez aplikację,
w razie braku — rozpoznanie tekstu pliku LICENSE). Skanuje importy ES w `src/` i `vite.config.ts` (bez komentarzy
i tekstu w cudzysłowach) i zgłasza dwie listy: importy bez deklaracji w `package.json` (powinna być pusta)
oraz pakiety zadeklarowane, ale nieimportowane (narzędzia, generator podzbioru ikon, alias `motion-v10`).

## 12. Weryfikacja i narzędzia

```bash
npx tsc -p tsconfig.app.json --noEmit         # typy
npx oxlint src                                # lint (npm run lint)
npm run build                                 # tsc -b + vite build → dist/
node docs/gen-licenses.mjs                    # odśwież tabele w LICENSES.md
node scripts/check-text-floor.mjs             # żaden rozmiar tekstu poniżej 10 px (--fix podnosi)
node scripts/shoot.mjs --wait 6000 fx:<id> view:gallery view:arsenal/paleta   # zrzuty → shots/*.png
node scripts/smoke-keyboard.mjs --base http://127.0.0.1:5173   # test klawiatury: Tab, Alt+1…6, Ctrl+K/Esc, karta galerii
PLAYWRIGHT_MODULE=/ścieżka/do/playwright node scripts/shoot.mjs ...   # gdy playwright nie jest w projekcie
```

`scripts/shoot.mjs` (Playwright + Chromium z SwiftShader) wypisuje JSON z błędami konsoli i `pageerror` dla
każdego celu; obsługuje `--hue`, `--motion`, `--quality`, `--click`, `--w/--h`, `--dsf`, `--jpeg`, `--suffix`.
Nazwa pliku to cel z zamienionymi znakami (`view:bridge` → `view_bridge.png`). Cele WebGL potrzebują
`--wait 6000+` (renderer programowy jest wolny). Równoległe serwery deweloperskie mogą używać osobnych katalogów
cache: `VITE_CACHE_DIR=node_modules/.vite-<nazwa> npx vite --port 518x`.

**Plakaty galerii** — `scripts/posters.mjs` renderuje każdy efekt (`?fx=<id>`, 640 × 400) do
`public/posters/<id>.jpg`:

```bash
node scripts/posters.mjs --base http://127.0.0.1:5173               # wszystkie (ok. 8 min pod SwiftShader)
node scripts/posters.mjs --base http://127.0.0.1:5173 --only hud-radar-sweep,r3f-holo-globe
```

Uruchom ponownie po zmianie wyglądu efektu. Plakat ma tonację akcentu tylko przybliżoną (`hue-rotate`), więc
na żywo widać prawdziwy kolor.

## 13. Znane ograniczenia

- Dwie kopie three.js (0.187 i 0.134 dla Vanty) zwiększają paczkę i powodują ostrzeżenie „Multiple instances
  of Three.js”; efekty Vanta są leniwe (§5.6).
- R3F 9 tworzy wewnętrzny `THREE.Clock` i zgłasza jego deprecation na każdym montażu `<Canvas>`. Nie jest to
  kod aplikacji; zniknie po przejściu R3F na `THREE.Timer` (lista aktualizacji zależności).
- `@iconify-json/game-icons` nie jest importowany w runtime — służy tylko do wygenerowania podzbiorów ikon (§11).
  `motion-v10` i `three-vanta` to aliasy npm, a nie zwykłe importy.
- Pakiety `@arwes/*` używane w aplikacji: frames, text, bgs, animator, animated, bleeps (§6).
- Fonty Orbitron i Share Tech Mono nie mają polskich znaków (fallback na następny font ze stosu).
- Rozmiary tekstu: nic nie schodzi poniżej 10 px (0,625 rem); egzekwuje to `scripts/check-text-floor.mjs`.
- `lib/sound` tworzy współdzielony `AudioContext` dopiero po pierwszym geście użytkownika
  (`navigator.userActivation`), więc Chrome nie zgłasza „AudioContext was not allowed to start”. Biblioteka howler
  tworzy własny kontekst przy załadowaniu, w stanie zawieszonym (bez ostrzeżenia); adopcja do wspólnego busa
  następuje przy pierwszym dźwięku.
- Radar (`hud-radar-sweep`) na renderze programowym: liczba klatek rAF spada z ok. 120 do ok. 36–40 na 2 s po
  kilku sekundach (pomiar 24 s, quality low) i na tym poziomie się utrzymuje; nie spada dalej. Czas callbacku JS jest
  stały (0,3–0,9 ms). Stan rysowania nie rośnie (statyczna warstwa, wstęp klina i poświaty są w buforach poza pętlą,
  a pętla `useCanvas2D` planuje klatki tylko przy działającym efekcie). Spadek jest po stronie rasteryzacji
  SwiftShadera, podobnie jak w innych efektach canvas. Nie sprawdzono tego na sprzętowym GPU.
- Karty galerii są przyciskami (`<button>`): efekt nie może renderować w trybie karty interaktywnych elementów
  (zagnieżdżone przyciski); tam, gdzie są potrzebne, rysuj wizualne odpowiedniki (jak `hud-cyber-elements`).
- Do zrobienia przy aktualizacji zależności: R3F 9 przejdzie na `THREE.Timer` (dziś `THREE.Clock`); zmiana Vanty
  na nowszy three usunie drugą kopię three.js (§5.6).
- Nieobsłużone: brak pliku `LICENSE` w katalogu projektu; zestaw UI Audio Kenneya nie jest pobierany przez
  `fetch-kenney.mjs` (wymaga sieci do kenney.nl); brak automatycznego axe-core (wymaga decyzji o zależności).
  Test klawiatury jest w `scripts/smoke-keyboard.mjs` (§12). Wymaga Playwrighta (`npm i -D playwright` albo `PLAYWRIGHT_MODULE=<ścieżka>`), bez niego kończy się kodem 2.
- Atlas fontu Inter (MSDF z `@pmndrs/msdfonts`, domyślny krój uikit) trafia do paczki wyłącznie z leniwym
  fragmentem efektu `r3f-uikit-panel` (ok. 420 KB); główny fragment aplikacji go nie zawiera.
- Pakiet Theatre: każde zamontowanie `r3f-theatre-flythrough` dodaje arkusz do wspólnego projektu, którego API nie
  pozwala usunąć — przy wielokrotnym montowaniu projekt rośnie nieznacznie.
