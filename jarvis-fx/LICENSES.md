# Licencje i noty stron trzecich — JARVIS FX · Mission Control

Ten plik zbiera noty licencyjne wszystkiego, co trafia do aplikacji: pakietów npm, kodu przeniesionego
(„ported/adapted”) z innych projektów, fontów, ikon, dźwięków i danych. Te same informacje są dostępne w
interfejsie: **Arsenał → Rejestr** (`#/arsenal`), dane w `src/data/resources.ts`.

- **Kod samej aplikacji JARVIS FX: MIT** (deklaracja w README). Plik `LICENSE` w katalogu projektu jeszcze
  nie istnieje — dodaj go przy przenoszeniu folderu do własnego repozytorium (patrz README, „Jak przenieść
  folder”). Do tego czasu deklaracja obowiązuje wyłącznie jako zapis intencji autora.
- Tabele zależności na końcu pliku są **generowane** z `node_modules` skryptem `node docs/gen-licenses.mjs`
  (czyta pole `license` z `package.json` każdego zainstalowanego pakietu, a gdy go brak — rozpoznaje tekst
  pliku LICENSE; osobno wykrywa importy z `src/` i `vite.config.ts`). Po każdej zmianie zależności uruchom
  skrypt ponownie.
- Pełne teksty licencji, których nagłówek i noty nie wystarczają, leżą w **`docs/licenses/`** (patrz
  tabela „Kod przeniesiony”).

## Zasady

| Flaga | Znaczenie | Przykłady |
|---|---|---|
| **OK** | Licencja permisywna; wystarczy zachować notę licencyjną. | MIT, ISC, BSD-2-Clause, Apache-2.0, Zlib, Unlicense, OFL-1.1, CC0-1.0 |
| **UWAGA** | Dozwolona z warunkami (atrybucja, zakaz sprzedaży, licencja własnościowa, licencja per plik). | GSAP „no charge”, MIT + Commons Clause, CC BY 3.0, Mixkit, Freesound, ZapSplat |
| **STOP** | Niekomercyjna, copyleft lub niejasna — **żadnego kopiowanego kodu**, najwyżej inspiracja wizualna. | LYGIA (Prosperity), Shadertoy (CC BY-NC-SA 3.0), eDEX-UI (GPL-3.0), Aceternity UI |

Commons Clause nie jest licencją open source w rozumieniu OSI, dlatego tam, gdzie się pojawia, flaga to
**UWAGA**, a nie OK. Każdy przeniesiony fragment ma w nagłówku pliku: adres źródła, licencję, autora i opis
zmian.

## Kod przeniesiony lub zaadaptowany

| Źródło | Licencja | Gdzie w repozytorium | Uwagi · pełny tekst |
|---|---|---|---|
| [Uiverse.io — Galaxy](https://github.com/uiverse-io/galaxy) · loadery autorów: mrhyddenn, aadium, Smit-Prajapati, gagan-gv, TemRevil, mobinkakei | MIT, © 2023 Uiverse.io | `src/fx/effects/loader-uiverse-pack/uiverse.css`, `index.tsx` | Autor i plik źródłowy podane przy każdym bloku CSS. Tekst: `docs/licenses/uiverse-galaxy-LICENSE.txt`. |
| [Magic UI](https://github.com/magicuidesign/magicui) — Number Ticker, Orbiting Circles, Retro Grid | MIT, © Magic UI | `src/fx/effects/motion-number-ticker/`, `motion-orbiting-circles/`, `motion-retro-grid/` | Przepisane na Motion 14 i tokeny HUD; nagłówki plików podają źródło w repozytorium magicuidesign/magicui. Tekst: `docs/licenses/magic-ui-LICENSE.md`. |
| [React Bits](https://github.com/DavidHDev/react-bits) — Threads, Faulty Terminal, Evil Eye, Lightning | **MIT + Commons Clause License Condition v1.0**, © 2026 David Haz | `src/fx/effects/bg-reactbits-threads/`, `bg-reactbits-faulty-terminal/`, `bg-reactbits-eye/`, `bg-reactbits-lightning/` | Shadery GLSL skopiowane (Threads, Faulty Terminal) lub przeniesione (Evil Eye, Lightning). Renderer: czysty WebGL2 (Threads, Faulty Terminal) albo [OGL](https://github.com/oframe/ogl) (Evil Eye, Lightning). Lightning: w upstreamie brak buildu na OGL, więc port jest reimplementacją oryginalnego WebGL2 na OGL (nagłówek to mówi). Tekst: `docs/licenses/react-bits-LICENSE.md`. |
| [react-cyber-elements](https://github.com/thiswallz/react-cyber-elements) — ramka, przycisk i pole (CyberEl53, CyberEl48, CyberEl50) | MIT, © 2022 Mau Joost | `src/fx/effects/hud-cyber-elements/cyber.tsx` (+ `index.tsx`, `cyber.css`) | Ścieżki SVG przeniesione, wypełnienia zamienione na `currentColor`. Pełna nota MIT w nagłówku `cyber.tsx`, zgodnie z warunkiem licencji. Tekst: `docs/licenses/react-cyber-elements-LICENSE.txt`. |
| [Tremor](https://github.com/tremorlabs/tremor) — Tracker v1.0.0 | Apache-2.0, © Tremor Labs | `src/views/agents/detail/UptimeTracker.tsx` | Nagłówek podaje źródło i zmiany (Radix HoverCard → Tooltip, kolory HUD, obsługa klawiatury, polskie teksty). Tekst: `docs/licenses/tremor-LICENSE-Apache-2.0.txt`. |

Wzorce zastosowane **bez kopiowania kodu** (inspiracja): shadcn/ui „Command Dialog” (paleta poleceń),
shadcn-admin i TailAdmin (układ paneli), eDEX-UI i jego forki (kierunek wizualny), jarvis-ui
(masterdeepak15, kariimmoalla1-source), openclaw-jarvis-ui, SwiftFUI, Kit FUI, Kenney UI Pack Sci-Fi.

## Dane i zasoby binarne

| Zasób | Licencja | Gdzie | Uwagi |
|---|---|---|---|
| [Natural Earth](https://www.naturalearthdata.com) 1:110m land (`ne_110m_land.geojson`) | domena publiczna | `src/fx/effects/r3f-holo-globe/landmask.ts` | Zrasteryzowane do maski bitowej 360 × 180. Atrybucja „Natural Earth” widoczna w efekcie. |
| Atlas MSDF z fontu [Chakra Petch](https://github.com/google/fonts/tree/main/ofl/chakrapetch) SemiBold | SIL OFL 1.1 | `src/fx/effects/r3f-uikit-panel/chakra-petch-msdf.{json,png}` + `ChakraPetch-OFL.txt` | Wygenerowany narzędziem uikit (@zappar/msdf-generator); tekst licencji dołączony obok. |
| Animacja orbu Lottie | MIT (własna) | `src/fx/effects/loader-lottie-orb/orb.ts` | JSON Bodymovin generowany w kodzie — bez plików z LottieFiles. |
| Podzbiory ikon [game-icons.net](https://game-icons.net) (20 ikon w efekcie, 12 w Arsenale) | **CC BY 3.0** | `src/fx/effects/hud-icon-matrix/gameIcons.ts`, `src/data/gameIconsArsenal.ts` | Wyciągnięte offline z `@iconify-json/game-icons`. Atrybucja poniżej. |
| Dźwięki WAV `public/sounds/synth/*.wav` | CC0 1.0 (własne) | `scripts/render-sounds.mjs` | Synteza offline; te same receptury co syntezator WebAudio. |
| Plakaty galerii `public/posters/*.jpg` (49 plików, ok. 1,7 MB) | jak w repozytorium (MIT) **z zastrzeżeniem** | `scripts/posters.mjs` | Zrzuty własnych efektów. Na zrzutach widać treści objęte innymi licencjami — fonty OFL (Fontsource) i ikony game-icons (CC BY 3.0, efekt „Matryca ikon”) — więc przy redystrybucji obowiązują te same noty co w tym pliku. |
| Zrzuty ekranu `docs/screens/*.jpg` | jak w repozytorium (MIT) | `docs/screens/` | Zrzuty interfejsu, w tym treści j.w. |

### Wymagana atrybucja — game-icons.net

> Icons by **Lorc, Delapouite & contributors** — <https://game-icons.net> — licensed under
> [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).

Pełny podpis jest w **Arsenał → Ikony** (`IconsTab.tsx`). Efekt „Matryca ikon” pokazuje skrót
„game-icons.net (CC BY 3.0)” — autorzy („Icons by Lorc, Delapouite & contributors”) są podani w karcie efektu i w Arsenale (wymóg CC BY).

## Fonty

Wszystkie 12 krojów jest hostowanych lokalnie przez [Fontsource](https://fontsource.org) (pakiety MIT jako
opakowanie) i objętych licencją **SIL Open Font License 1.1**. Pełny tekst OFL jest w pakiecie każdego kroju
(`node_modules/@fontsource*/<font>/LICENSE`):

Orbitron · Michroma · Oxanium · Rajdhani · Chakra Petch · Exo 2 · Audiowide · Share Tech Mono ·
JetBrains Mono · IBM Plex Mono · Space Grotesk · Space Mono

Uwaga praktyczna: **Orbitron** i **Share Tech Mono** mają w Fontsource tylko podzbiór `latin` — brak
polskich znaków. Tekst z diakrytykami składamy Michromą, Oxanium, Chakra Petch lub JetBrains Mono.

**Poza listą 12 krojów Fontsource:** Inter (atlas MSDF) z pakietu `@pmndrs/msdfonts` — domyślny krój
`@react-three/uikit`, używany tylko przez efekt „r3f-uikit-panel” (licencja SIL OFL 1.1; pełny tekst w
`docs/licenses/pmndrs-msdfonts-LICENSE.txt`). Atlas Roboto z tego samego pakietu (Apache-2.0) nie jest używany.
Materiał symboli (Material Symbols, Apache-2.0) jest w aplikacji **podzbiorem** 16 ligatur
(`src/styles/fonts/material-symbols-outlined.subset.woff2`, ok. 35 KB), zbudowanym przez
`scripts/subset-material-symbols.py`.

## Ikony

| Zestaw | Licencja | Pakiet |
|---|---|---|
| Tabler Icons | MIT | `@tabler/icons-react` |
| Lucide | ISC | `lucide-react` |
| Phosphor | MIT | `@phosphor-icons/react` |
| Material Symbols | Apache-2.0 | `material-symbols` |
| game-icons.net (przez Iconify) | CC BY 3.0 — atrybucja wymagana | `@iconify/react` (MIT) + `@iconify-json/game-icons` (tylko przy generowaniu podzbioru) |

## Dźwięki

| Źródło | Licencja | Status |
|---|---|---|
| Synteza WebAudio (`src/lib/sound/synth.ts`) | CC0 1.0 (własna) | zawsze dostępna |
| WAV-y `public/sounds/synth/` | CC0 1.0 (własne) | w repozytorium (~164 KB, 11 plików + `manifest.json`) |
| [Kenney Interface Sounds](https://kenney.nl/assets/interface-sounds), [Kenney Sci-fi Sounds](https://kenney.nl/assets/sci-fi-sounds) | CC0 1.0 | **opcjonalne**, instalowane lokalnie skryptem `scripts/fetch-kenney.mjs`, nie są w repozytorium |
| Kenney UI Audio | CC0 1.0 | referencja; można dopisać ręcznie do manifestu |
| ARWES bleeps (`@arwes/bleeps`) | MIT | **backend „ARWES”** (`src/lib/sound/arwes.ts`): odtwarza nasze WAV-y przez obiekty `createBleep`; ładowany leniwie, wybierany ręcznie w silniku dźwięku |
| howler.js, use-sound | MIT | biblioteki odtwarzania |
| Mixkit | Mixkit Sound Effects Free License | **nieużywane** — zakaz redystrybucji plików |
| Freesound | licencja per plik (CC0 / CC BY / CC BY-NC) | **nieużywane** — dopuszczalne wyłącznie pliki CC0 |
| ZapSplat | ZapSplat Standard License | **nieużywane** — atrybucja i zakaz redystrybucji |

## Zastrzeżenia (flagi „UWAGA” i „STOP”)

- **GSAP** (`gsap`, `@gsap/react`) — *GSAP Standard „no charge” License* (Webflow). Od wersji 3.13 darmowa, także
  komercyjnie, łącznie ze wszystkimi wtyczkami; używamy `useGSAP`, DrawSVGPlugin, MorphSVGPlugin, SplitText i
  ScrambleTextPlugin. **To nie jest licencja open source**: nie wolno używać GSAP w narzędziu konkurencyjnym
  wobec Webflow. Pakiety nie zawierają pliku LICENSE — treść: <https://gsap.com/standard-license>.
- **React Bits** — MIT + Commons Clause License Condition v1.0: wolno używać i modyfikować, nie wolno sprzedawać
  oprogramowania jako produktu lub usługi, której wartość pochodzi z tego oprogramowania. Pełny tekst:
  `docs/licenses/react-bits-LICENSE.md`.
- **game-icons.net** — CC BY 3.0: atrybucja obowiązkowa (patrz wyżej).
- **Vanta.js** (MIT) — wymaga three.js r134; instalujemy go obok three 0.187 pod aliasem `three-vanta`
  (`npm:three@^0.134.0`). Dwie kopie three.js w paczce. Efekty TOPOLOGY i TRUNK pominięto (p5.js, LGPL).
- **ARWES** (MIT) — projekt nieutrzymywany, pakiety React wspierają tylko React 18. Używamy wyłącznie pakietów
  vanilla: `@arwes/frames`, `text`, `bgs`, `animator`, `animated` (efekt „Montaż modułów – Arwes”) i `bleeps` (backend
  dźwięku). Ich import `motion` jest przekierowany na `motion-v10` (`npm:motion@^10`) wtyczką w `vite.config.ts`.
- **Theatre.js** — `@theatre/core` jest na Apache-2.0 (używany, efekt „Przelot nad miastem”); `@theatre/studio` jest na
  **AGPL-3.0**, nie figuruje w package.json i nie jest importowany (sprawdzone w `src/`).
- **Motion** — biblioteka MIT; płatnego Motion+ nie używamy.
- **jarvis-ui (kariimmoalla1-source)** — licencja MIT zadeklarowana tylko w README (brak pliku LICENSE i pola
  `license`); traktujemy wyłącznie jako inspirację.
- **LYGIA** (Prosperity 3.0 + Patron), **Shadertoy** (domyślnie CC BY-NC-SA 3.0), **eDEX-UI** i forki (GPL-3.0),
  **Aceternity UI** (licencja niejasna per komponent) — **zero skopiowanego kodu**. Przeszukanie `src/` nie
  znajduje żadnych ich fragmentów (trafienia słowa „GPL” to nazwy typu `DrawSVGPlugin`). Shadery w projekcie są
  własne albo pochodzą z pozycji wymienionych wyżej.

### Zweryfikowane licencje repozytoriów referencyjnych

| Repozytorium | Wynik weryfikacji |
|---|---|
| [DavidHDev/react-bits](https://github.com/DavidHDev/react-bits) | `LICENSE.md` (main): „MIT + Commons Clause License Condition v1.0”, © 2026 David Haz |
| [magicuidesign/magicui](https://github.com/magicuidesign/magicui) | `LICENSE.md` (main): MIT License, © Magic UI |
| [uiverse-io/galaxy](https://github.com/uiverse-io/galaxy) | `LICENSE` (main): MIT License, © 2023 Uiverse.io |
| [tremorlabs/tremor](https://github.com/tremorlabs/tremor) | `LICENSE` (main): Apache License 2.0 |
| [arwes/arwes](https://github.com/arwes/arwes) | `LICENSE` (main): MIT License, © 2014–2023 Romel Perez |
| [oframe/ogl](https://github.com/oframe/ogl) | `node_modules/ogl/package.json`: 1.0.11, `license: Unlicense` (plik `LICENSE` w gałęzi master nieosiągalny; pole pakietu wystarcza do wpisu) |
| [thiswallz/react-cyber-elements](https://github.com/thiswallz/react-cyber-elements) | `LICENSE` (main): MIT License, © 2022 Mau Joost; npm `react-cyber-elements@1.0.2`: `"license": "MIT"` |
| [masterdeepak15/jarvis-ui](https://github.com/masterdeepak15/jarvis-ui) | `packages/jarvis-ui/LICENSE`: MIT © 2026 Deepak Chougale (brak pliku w katalogu głównym monorepo) |
| [kariimmoalla1-source/jarvis-ui](https://github.com/kariimmoalla1-source/jarvis-ui) | README: „MIT License”; brak pliku LICENSE (gałęzie main/master), `package.json` bez pola `license` |
| [jincocodev/openclaw-jarvis-ui](https://github.com/jincocodev/openclaw-jarvis-ui) | `LICENSE`: ISC © 2026 JincocoDev |
| [GitSquared/edex-ui](https://github.com/GitSquared/edex-ui) | GPL-3.0, repozytorium zarchiwizowane |
| [gdy208/edex-ui-modern](https://github.com/gdy208/edex-ui-modern) | GPL-3.0 (fork eDEX-UI) |

## Zależności npm

<!-- AUTO:DEPENDENCIES:START -->
Wygenerowano z `node_modules` (68 zależności + 9 deweloperskich). Podsumowanie: MIT × 51 · OFL-1.1 × 12 · Apache-2.0 × 4 · MIT (tekst w pliku LICENSE) × 3 · SEE LICENSE AT https://gsap.com/standard-license × 1 · CC-BY-3.0 × 1 · BSD-2-Clause × 1 · Standard 'no charge' license: https://gsap.com/standard-license. × 1 · ISC × 1 · Unlicense × 1 · Zlib × 1.
⚠ = licencja spoza listy permisywnych SPDX – opis w sekcji „Zastrzeżenia”.

### Zależności (`dependencies`)

| Pakiet | Wersja | Licencja (pole `license`) | Plik LICENSE | Strona / repozytorium | Typ | Import w `src/` |
|---|---|---|---|---|---|---|
| `@arwes/animated` | 1.0.0-next.25020502 | MIT | tak | <https://arwes.dev> | runtime | tak |
| `@arwes/animator` | 1.0.0-next.25020502 | MIT | tak | <https://arwes.dev> | runtime | tak |
| `@arwes/bgs` | 1.0.0-next.25020502 | MIT | tak | <https://arwes.dev> | runtime | tak |
| `@arwes/bleeps` | 1.0.0-next.25020502 | MIT | tak | <https://arwes.dev> | runtime | tak |
| `@arwes/frames` | 1.0.0-next.25020502 | MIT | tak | <https://arwes.dev> | runtime | tak |
| `@arwes/text` | 1.0.0-next.25020502 | MIT | tak | <https://arwes.dev> | runtime | tak |
| `@fontsource-variable/exo-2` | 5.3.0 | OFL-1.1 | tak | <https://fontsource.org/fonts/exo-2> | runtime | tak |
| `@fontsource-variable/space-grotesk` | 5.3.0 | OFL-1.1 | tak | <https://fontsource.org/fonts/space-grotesk> | runtime | tak |
| `@fontsource/audiowide` | 5.3.0 | OFL-1.1 | tak | <https://fontsource.org/fonts/audiowide> | runtime | tak |
| `@fontsource/chakra-petch` | 5.3.0 | OFL-1.1 | tak | <https://fontsource.org/fonts/chakra-petch> | runtime | tak |
| `@fontsource/ibm-plex-mono` | 5.3.0 | OFL-1.1 | tak | <https://fontsource.org/fonts/ibm-plex-mono> | runtime | tak |
| `@fontsource/jetbrains-mono` | 5.3.0 | OFL-1.1 | tak | <https://fontsource.org/fonts/jetbrains-mono> | runtime | tak |
| `@fontsource/michroma` | 5.3.0 | OFL-1.1 | tak | <https://fontsource.org/fonts/michroma> | runtime | tak |
| `@fontsource/orbitron` | 5.3.0 | OFL-1.1 | tak | <https://fontsource.org/fonts/orbitron> | runtime | tak |
| `@fontsource/oxanium` | 5.3.0 | OFL-1.1 | tak | <https://fontsource.org/fonts/oxanium> | runtime | tak |
| `@fontsource/rajdhani` | 5.3.0 | OFL-1.1 | tak | <https://fontsource.org/fonts/rajdhani> | runtime | tak |
| `@fontsource/share-tech-mono` | 5.3.0 | OFL-1.1 | tak | <https://fontsource.org/fonts/share-tech-mono> | runtime | tak |
| `@fontsource/space-mono` | 5.3.0 | OFL-1.1 | tak | <https://fontsource.org/fonts/space-mono> | runtime | tak |
| `@gsap/react` | 2.1.2 | SEE LICENSE AT https://gsap.com/standard-license ⚠ | nie | <https://github.com/greensock/react#readme> | runtime | tak |
| `@iconify-json/game-icons` | 1.2.4 | CC-BY-3.0 ⚠ | nie | <https://icon-sets.iconify.design/game-icons/> | runtime | nie |
| `@iconify/react` | 6.0.4 | MIT | tak | <https://iconify.design/> | runtime | tak |
| `@phosphor-icons/react` | 2.1.10 | MIT | tak | <https://phosphoricons.com> | runtime | tak |
| `@radix-ui/react-dialog` | 1.3.1 | MIT | tak | <https://radix-ui.com/primitives> | runtime | tak |
| `@radix-ui/react-tooltip` | 1.4.1 | MIT | tak | <https://radix-ui.com/primitives> | runtime | tak |
| `@react-spring/three` | 10.1.2 | MIT | tak | <https://github.com/pmndrs/react-spring#readme> | runtime | tak |
| `@react-three/drei` | 10.7.9 | MIT | tak | <https://github.com/pmndrs/drei> | runtime | tak |
| `@react-three/fiber` | 9.8.2 | MIT | nie | <https://github.com/pmndrs/react-three-fiber#readme> | runtime | tak |
| `@react-three/postprocessing` | 3.2.2 | MIT | tak | <https://github.com/pmndrs/react-postprocessing#readme> | runtime | tak |
| `@react-three/uikit` | 1.0.78 | MIT (tekst w pliku LICENSE) | tak | <https://github.com/pmndrs/uikit> | runtime | tak |
| `@tabler/icons-react` | 3.52.0 | MIT | tak | <https://tabler.io/icons> | runtime | tak |
| `@tailwindcss/vite` | 4.3.5 | MIT | tak | <https://tailwindcss.com> | runtime | tak |
| `@theatre/core` | 0.7.2 | Apache-2.0 | tak | <https://github.com/AriaMinaei/theatre> | runtime | tak |
| `@tsparticles/engine` | 4.6.0 | MIT | tak | <https://particles.js.org> | runtime | tak |
| `@tsparticles/react` | 4.6.0 | MIT | nie | <https://github.com/tsparticles/tsparticles> | runtime | tak |
| `@tsparticles/slim` | 4.6.0 | MIT | tak | <https://particles.js.org> | runtime | tak |
| `@visx/group` | 4.0.0 | MIT | tak | <https://github.com/airbnb/visx#readme> | runtime | tak |
| `@visx/responsive` | 4.0.0 | MIT | tak | <https://github.com/airbnb/visx#readme> | runtime | tak |
| `@visx/scale` | 4.0.0 | MIT | tak | <https://github.com/airbnb/visx#readme> | runtime | tak |
| `@visx/shape` | 4.0.0 | MIT | tak | <https://github.com/airbnb/visx> | runtime | tak |
| `animejs` | 4.5.0 | MIT | tak | <https://animejs.com> | runtime | tak |
| `augmented-ui` | 2.0.0 | BSD-2-Clause | tak | <http://augmented-ui.com> | runtime | tak |
| `cmdk` | 1.1.1 | MIT | tak | <https://github.com/pacocoursey/cmdk#readme> | runtime | tak |
| `echarts` | 6.1.0 | Apache-2.0 | tak | <https://echarts.apache.org> | runtime | tak |
| `echarts-for-react` | 3.0.6 | MIT | tak | <https://github.com/hustcc/echarts-for-react> | runtime | tak |
| `gsap` | 3.15.1 | Standard 'no charge' license: https://gsap.com/standard-license. ⚠ | nie | <https://gsap.com> | runtime | tak |
| `howler` | 2.2.4 | MIT | tak | <https://howlerjs.com> | runtime | tak |
| `leva` | 0.10.1 | MIT | tak | <https://github.com/pmndrs/leva> | runtime | tak |
| `lottie-react` | 3.1.2 | MIT | tak | <https://lottiereact.com> | runtime | tak |
| `lucide-react` | 1.73.0 | ISC | tak | <https://lucide.dev> | runtime | tak |
| `material-symbols` | 0.49.0 | Apache-2.0 | tak | <https://marella.github.io/material-symbols/demo/> | runtime | nie |
| `motion` | 14.14.0 | MIT | tak | <https://github.com/motiondivision/motion> | runtime | tak |
| `motion-v10` (alias `motion`) | 10.18.0 | MIT | tak | — | runtime | nie |
| `ogl` | 1.0.11 | Unlicense | nie | <https://github.com/oframe/ogl#readme> | runtime | tak |
| `postprocessing` | 6.39.6 | Zlib | tak | <https://github.com/pmndrs/postprocessing> | runtime | tak |
| `powerglitch` | 2.5.0 | MIT (tekst w pliku LICENSE) | tak | <https://github.com/7PH/powerglitch> | runtime | tak |
| `react` | 19.3.1 | MIT | tak | <https://react.dev/> | runtime | tak |
| `react-dom` | 19.3.1 | MIT | tak | <https://react.dev/> | runtime | tak |
| `react-force-graph-2d` | 1.29.2 | MIT | nie | <https://github.com/vasturiano/react-force-graph> | runtime | tak |
| `react-force-graph-3d` | 1.29.2 | MIT | nie | <https://github.com/vasturiano/react-force-graph> | runtime | tak |
| `react-powerglitch` | 1.1.0 | MIT (tekst w pliku LICENSE) | tak | — | runtime | tak |
| `react-spinners` | 0.17.1 | MIT | tak | <https://www.davidhu.io/react-spinners/> | runtime | tak |
| `tailwindcss` | 4.3.5 | MIT | tak | <https://tailwindcss.com> | runtime | tak |
| `three` | 0.187.0 | MIT | tak | <https://threejs.org/> | runtime | tak |
| `three-stdlib` | 2.36.1 | MIT | tak | <https://github.com/pmndrs/three-stdlib> | runtime | tak |
| `three-vanta` (alias `three`) | 0.134.0 | MIT | tak | <https://threejs.org/> | runtime | tak |
| `use-sound` | 5.0.0 | MIT | tak | <github:joshwcomeau/use-sound> | runtime | tak |
| `vanta` | 0.5.24 | MIT | tak | <https://github.com/tengbao/vanta> | runtime | tak |
| `zustand` | 5.1.0 | MIT | tak | <https://github.com/pmndrs/zustand> | runtime | tak |

### Zależności deweloperskie (`devDependencies`)

| Pakiet | Wersja | Licencja (pole `license`) | Plik LICENSE | Strona / repozytorium | Typ | Import w `src/` |
|---|---|---|---|---|---|---|
| `@types/howler` | 2.2.13 | MIT | tak | <https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/howler> | dev | nie |
| `@types/node` | 24.19.2 | MIT | tak | <https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/node> | dev | nie |
| `@types/react` | 19.3.0 | MIT | tak | <https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/react> | dev | nie |
| `@types/react-dom` | 19.3.0 | MIT | tak | <https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/react-dom> | dev | nie |
| `@types/three` | 0.187.0 | MIT | tak | <https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/three> | dev | nie |
| `@vitejs/plugin-react` | 6.3.0 | MIT | tak | <https://github.com/vitejs/vite-plugin-react/tree/main/packages/plugin-react#readme> | dev | tak |
| `oxlint` | 1.93.0 | MIT | tak | <https://oxc.rs/docs/guide/usage/linter> | dev | nie |
| `typescript` | 7.0.2 | Apache-2.0 | tak | <https://www.typescriptlang.org/> | dev | nie |
| `vite` | 8.3.8 | MIT | tak | <https://vite.dev> | dev | tak |

### Importowane bez deklaracji w package.json

_Brak – każdy import z `src/` i `vite.config.ts` jest zadeklarowany w package.json._

### Zadeklarowane bez importu w `src/` i `vite.config.ts`

| Pakiet | Wersja | Licencja (pole `license`) | Plik LICENSE | Strona / repozytorium | Typ | Import w `src/` |
|---|---|---|---|---|---|---|
| `@iconify-json/game-icons` | 1.2.4 | CC-BY-3.0 ⚠ | nie | <https://icon-sets.iconify.design/game-icons/> | runtime | nie |
| `@types/howler` | 2.2.13 | MIT | tak | <https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/howler> | dev | nie |
| `@types/node` | 24.19.2 | MIT | tak | <https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/node> | dev | nie |
| `@types/react` | 19.3.0 | MIT | tak | <https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/react> | dev | nie |
| `@types/react-dom` | 19.3.0 | MIT | tak | <https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/react-dom> | dev | nie |
| `@types/three` | 0.187.0 | MIT | tak | <https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/three> | dev | nie |
| `material-symbols` | 0.49.0 | Apache-2.0 | tak | <https://marella.github.io/material-symbols/demo/> | runtime | nie |
| `motion-v10` (alias `motion`) | 10.18.0 | MIT | tak | — | runtime | nie |
| `oxlint` | 1.93.0 | MIT | tak | <https://oxc.rs/docs/guide/usage/linter> | dev | nie |
| `typescript` | 7.0.2 | Apache-2.0 | tak | <https://www.typescriptlang.org/> | dev | nie |

Te pakiety nie trafiają do paczki aplikacji bezpośrednio: są narzędziami (typy, lint, build), generatorem (`@iconify-json/game-icons` – źródło podzbioru ikon, patrz `docs/ARCHITECTURE.md` §11; `material-symbols` – źródło podzbioru czcionki, `scripts/subset-material-symbols.py`) albo aliasem przeładowanym w `vite.config.ts` (`motion-v10`).
<!-- AUTO:DEPENDENCIES:END -->
