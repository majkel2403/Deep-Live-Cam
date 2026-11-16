# Licencje i noty stron trzecich — JARVIS FX · Mission Control

Ten plik zbiera noty licencyjne wszystkiego, co trafia do aplikacji: pakietów npm, kodu przeniesionego
(„ported/adapted”) z innych projektów, fontów, ikon, dźwięków i danych. Te same informacje są dostępne w
interfejsie: **Arsenał → Rejestr** (`#/arsenal`), dane w `src/data/resources.ts`.

- Kod samej aplikacji JARVIS FX: MIT (o ile nie zaznaczono inaczej w nagłówku pliku).
- Tabele zależności na końcu pliku są **generowane** z `node_modules` skryptem `node docs/gen-licenses.mjs`
  (czyta pole `license` z `package.json` każdego zainstalowanego pakietu, a gdy go brak — rozpoznaje tekst
  pliku LICENSE). Po każdej zmianie zależności uruchom skrypt ponownie.

## Zasady

| Flaga | Znaczenie | Przykłady |
|---|---|---|
| **OK** | Licencja permisywna; wystarczy zachować notę licencyjną. | MIT, ISC, BSD-2-Clause, Apache-2.0, Zlib, Unlicense, OFL-1.1, CC0-1.0 |
| **UWAGA** | Dozwolona z warunkami (atrybucja, zakaz odsprzedaży, licencja własnościowa, licencja per plik). | GSAP Standard License, MIT + Commons Clause, CC BY 3.0, Mixkit, Freesound, ZapSplat |
| **STOP** | Niekomercyjna, copyleft lub niejasna — **żadnego kopiowanego kodu**, najwyżej inspiracja wizualna. | LYGIA (Prosperity), Shadertoy (CC BY-NC-SA 3.0), eDEX-UI (GPL-3.0), Aceternity UI |

Każdy przeniesiony fragment ma w nagłówku pliku: adres źródła, licencję, autora i opis zmian.

## Kod przeniesiony lub zaadaptowany

| Źródło | Licencja | Gdzie w repozytorium | Uwagi |
|---|---|---|---|
| [Uiverse.io — Galaxy](https://github.com/uiverse-io/galaxy) · loadery autorów: mrhyddenn, aadium, Smit-Prajapati, gagan-gv, TemRevil, mobinkakei | MIT, © 2023 Uiverse.io | `src/fx/effects/loader-uiverse-pack/uiverse.css`, `index.tsx` | Autor i plik źródłowy podane przy każdym bloku CSS. |
| [Magic UI](https://github.com/magicuidesign/magicui) — Number Ticker, Orbiting Circles, Retro Grid | MIT, © Magic UI | `src/fx/effects/motion-number-ticker/`, `motion-orbiting-circles/`, `motion-retro-grid/` | Przepisane na Motion 14 i tokeny HUD. |
| [React Bits](https://github.com/DavidHDev/react-bits) — Threads, Faulty Terminal | **MIT + Commons Clause**, © David Haz | `src/fx/effects/bg-reactbits-threads/`, `bg-reactbits-faulty-terminal/` | Shadery GLSL skopiowane, renderer przepisany na czysty WebGL2. Commons Clause: komponentów nie wolno sprzedawać jako takich. |
| [Tremor](https://github.com/tremorlabs/tremor) — Tracker v1.0.0 | Apache-2.0, © Tremor Labs | `src/views/agents/detail/UptimeTracker.tsx` | Radix HoverCard → Tooltip, kolory HUD, obsługa klawiatury. |

Wzorce zastosowane **bez kopiowania kodu** (inspiracja): shadcn/ui „Command Dialog” (paleta poleceń),
shadcn-admin i TailAdmin (układ paneli), eDEX-UI i jego forki (kierunek wizualny), jarvis-ui
(masterdeepak15, kariimmoalla1-source), openclaw-jarvis-ui, SwiftFUI, Kit FUI, Kenney UI Pack Sci-Fi.

## Dane i zasoby binarne

| Zasób | Licencja | Gdzie | Uwagi |
|---|---|---|---|
| [Natural Earth](https://www.naturalearthdata.com) 1:110m land (`ne_110m_land.geojson`) | domena publiczna | `src/fx/effects/r3f-holo-globe/landmask.ts` | Zrasteryzowane do maski bitowej 360 × 180. |
| Atlas MSDF z fontu [Chakra Petch](https://github.com/google/fonts/tree/main/ofl/chakrapetch) SemiBold | SIL OFL 1.1 | `src/fx/effects/r3f-uikit-panel/chakra-petch-msdf.{json,png}` + `ChakraPetch-OFL.txt` | Wygenerowany narzędziem uikit (@zappar/msdf-generator); tekst licencji dołączony obok. |
| Animacja orbu Lottie | MIT (własna) | `src/fx/effects/loader-lottie-orb/orb.ts` | JSON Bodymovin generowany w kodzie — bez plików z LottieFiles. |
| Podzbiory ikon [game-icons.net](https://game-icons.net) | **CC BY 3.0** | `src/fx/effects/hud-icon-matrix/gameIcons.ts`, `src/data/gameIconsArsenal.ts` | Wyciągnięte offline z `@iconify-json/game-icons`. Atrybucja poniżej. |
| Dźwięki WAV `public/sounds/synth/*.wav` | CC0 1.0 (własne) | `scripts/render-sounds.mjs` | Synteza offline; te same receptury co syntezator WebAudio. |

### Wymagana atrybucja — game-icons.net

> Icons by **Lorc, Delapouite & contributors** — <https://game-icons.net> — licensed under
> [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).

Podpis jest widoczny w interfejsie przy każdym miejscu użycia (efekt „Matryca ikon”, Arsenał → Ikony).

## Fonty

Wszystkie 12 krojów jest hostowanych lokalnie przez [Fontsource](https://fontsource.org) (pakiety MIT) i
objętych licencją **SIL Open Font License 1.1** (pełny tekst w `node_modules/@fontsource*/<font>/LICENSE`):

Orbitron · Michroma · Oxanium · Rajdhani · Chakra Petch · Exo 2 · Audiowide · Share Tech Mono ·
JetBrains Mono · IBM Plex Mono · Space Grotesk · Space Mono

Uwaga praktyczna: **Orbitron** i **Share Tech Mono** mają w Fontsource tylko podzbiór `latin` — brak
polskich znaków. Tekst z diakrytykami składamy Michromą, Oxanium, Chakra Petch lub JetBrains Mono.

## Ikony

| Zestaw | Licencja | Pakiet |
|---|---|---|
| Tabler Icons | MIT | `@tabler/icons-react` |
| Lucide | ISC | `lucide-react` |
| Phosphor | MIT | `@phosphor-icons/react` |
| Material Symbols | Apache-2.0 | `material-symbols` |
| game-icons.net (przez Iconify) | CC BY 3.0 — atrybucja wymagana | `@iconify/react` (MIT) + `@iconify-json/game-icons` |

## Dźwięki

| Źródło | Licencja | Status |
|---|---|---|
| Synteza WebAudio (`src/lib/sound/synth.ts`) | CC0 1.0 (własna) | zawsze dostępna |
| WAV-y `public/sounds/synth/` | CC0 1.0 (własne) | w repozytorium (~164 KB) |
| [Kenney Interface Sounds](https://kenney.nl/assets/interface-sounds), [Kenney Sci-fi Sounds](https://kenney.nl/assets/sci-fi-sounds) | CC0 1.0 | **opcjonalne**, instalowane lokalnie skryptem `scripts/fetch-kenney.mjs`, nie są w repozytorium |
| Kenney UI Audio | CC0 1.0 | referencja; można dopisać ręcznie do manifestu |
| Mixkit | Mixkit Sound Effects Free License | **nieużywane** — zakaz redystrybucji plików |
| Freesound | licencja per plik (CC0 / CC BY / CC BY-NC) | **nieużywane** — dopuszczalne wyłącznie pliki CC0 |
| ZapSplat | ZapSplat Standard License | **nieużywane** — atrybucja i zakaz redystrybucji |
| ARWES bleeps (`@arwes/bleeps`) | MIT | przejęte tylko nazewnictwo bleepów; pakiet niezaimportowany |
| howler.js, use-sound | MIT | biblioteki odtwarzania |

## Zastrzeżenia (flagi „UWAGA” i „STOP”)

- **GSAP** (`gsap`, `@gsap/react`) — *GSAP Standard „no charge” License* (Webflow). Darmowa, także komercyjnie,
  łącznie ze wszystkimi wtyczkami (SplitText, DrawSVG, MorphSVG, ScrambleText…), ale **to nie jest licencja
  open source**: nie wolno używać GSAP w narzędziu konkurencyjnym wobec Webflow. Pakiety nie zawierają pliku
  LICENSE — treść: <https://gsap.com/standard-license>.
- **React Bits** — MIT + Commons Clause: porty wolno używać w produktach, nie wolno sprzedawać samych komponentów.
- **game-icons.net** — CC BY 3.0: atrybucja obowiązkowa (patrz wyżej).
- **Vanta.js** (MIT) — wymaga three.js r134; instalujemy go pod aliasem `three-vanta` (`npm:three@^0.134`) obok
  three 0.187. Dwie kopie three.js w paczce; efekty TOPOLOGY i TRUNK pominięto (p5.js, LGPL).
- **ARWES** (MIT) — projekt nieutrzymywany, pakiety React wspierają tylko React 18. Używamy wyłącznie pakietów
  vanilla (`@arwes/frames`, `text`, `bgs`, `animator`); ich import `motion` jest przekierowany na `motion-v10`
  (`npm:motion@^10`) wtyczką w `vite.config.ts`.
- **Theatre.js** — `@theatre/core` jest na Apache-2.0 (używany); `@theatre/studio` jest na **AGPL-3.0** i
  świadomie go nie instalujemy.
- **Motion** — biblioteka MIT; płatnego Motion+ nie używamy.
- **jarvis-ui (kariimmoalla1-source)** — licencja MIT zadeklarowana tylko w README (brak pliku LICENSE i pola
  `license`); traktujemy wyłącznie jako inspirację.
- **LYGIA** (Prosperity 3.0 + Patron), **Shadertoy** (domyślnie CC BY-NC-SA 3.0), **eDEX-UI** i forki (GPL-3.0),
  **Aceternity UI** (licencja niejasna per komponent) — **zero skopiowanego kodu**. Shadery w projekcie są własne.

### Zweryfikowane licencje repozytoriów referencyjnych

| Repozytorium | Wynik weryfikacji |
|---|---|
| [thiswallz/react-cyber-elements](https://github.com/thiswallz/react-cyber-elements) | `LICENSE`: MIT © 2022 Mau Joost; npm `react-cyber-elements@1.0.2`: `"license": "MIT"` |
| [masterdeepak15/jarvis-ui](https://github.com/masterdeepak15/jarvis-ui) | `packages/jarvis-ui/LICENSE`: MIT © 2026 Deepak Chougale (brak pliku w katalogu głównym monorepo) |
| [kariimmoalla1-source/jarvis-ui](https://github.com/kariimmoalla1-source/jarvis-ui) | README: „MIT License”; brak pliku LICENSE (gałęzie main/master), `package.json` bez pola `license` |
| [jincocodev/openclaw-jarvis-ui](https://github.com/jincocodev/openclaw-jarvis-ui) | `LICENSE`: ISC © 2026 JincocoDev |
| [GitSquared/edex-ui](https://github.com/GitSquared/edex-ui) | GPL-3.0, repozytorium zarchiwizowane |
| [gdy208/edex-ui-modern](https://github.com/gdy208/edex-ui-modern) | GPL-3.0 (fork eDEX-UI) |

## Zależności npm

<!-- AUTO:DEPENDENCIES:START -->
Wygenerowano z `node_modules` (66 zależności + 9 deweloperskich). Podsumowanie: MIT × 50 · OFL-1.1 × 12 · Apache-2.0 × 4 · MIT (tekst w pliku LICENSE) × 2 · SEE LICENSE AT https://gsap.com/standard-license × 1 · CC-BY-3.0 × 1 · BSD-2-Clause × 1 · Standard 'no charge' license: https://gsap.com/standard-license. × 1 · ISC × 1 · Unlicense × 1 · Zlib × 1.
⚠ = licencja spoza listy permisywnych SPDX – opis w sekcji „Zastrzeżenia”.

### Zależności (`dependencies`)

| Pakiet | Wersja | Licencja (pole `license`) | Plik LICENSE | Strona / repozytorium | Typ |
|---|---|---|---|---|---|
| `@arwes/animated` | 1.0.0-next.25020502 | MIT | tak | <https://arwes.dev> | runtime |
| `@arwes/animator` | 1.0.0-next.25020502 | MIT | tak | <https://arwes.dev> | runtime |
| `@arwes/bgs` | 1.0.0-next.25020502 | MIT | tak | <https://arwes.dev> | runtime |
| `@arwes/bleeps` | 1.0.0-next.25020502 | MIT | tak | <https://arwes.dev> | runtime |
| `@arwes/frames` | 1.0.0-next.25020502 | MIT | tak | <https://arwes.dev> | runtime |
| `@arwes/text` | 1.0.0-next.25020502 | MIT | tak | <https://arwes.dev> | runtime |
| `@fontsource-variable/exo-2` | 5.3.0 | OFL-1.1 | tak | <https://fontsource.org/fonts/exo-2> | runtime |
| `@fontsource-variable/space-grotesk` | 5.3.0 | OFL-1.1 | tak | <https://fontsource.org/fonts/space-grotesk> | runtime |
| `@fontsource/audiowide` | 5.3.0 | OFL-1.1 | tak | <https://fontsource.org/fonts/audiowide> | runtime |
| `@fontsource/chakra-petch` | 5.3.0 | OFL-1.1 | tak | <https://fontsource.org/fonts/chakra-petch> | runtime |
| `@fontsource/ibm-plex-mono` | 5.3.0 | OFL-1.1 | tak | <https://fontsource.org/fonts/ibm-plex-mono> | runtime |
| `@fontsource/jetbrains-mono` | 5.3.0 | OFL-1.1 | tak | <https://fontsource.org/fonts/jetbrains-mono> | runtime |
| `@fontsource/michroma` | 5.3.0 | OFL-1.1 | tak | <https://fontsource.org/fonts/michroma> | runtime |
| `@fontsource/orbitron` | 5.3.0 | OFL-1.1 | tak | <https://fontsource.org/fonts/orbitron> | runtime |
| `@fontsource/oxanium` | 5.3.0 | OFL-1.1 | tak | <https://fontsource.org/fonts/oxanium> | runtime |
| `@fontsource/rajdhani` | 5.3.0 | OFL-1.1 | tak | <https://fontsource.org/fonts/rajdhani> | runtime |
| `@fontsource/share-tech-mono` | 5.3.0 | OFL-1.1 | tak | <https://fontsource.org/fonts/share-tech-mono> | runtime |
| `@fontsource/space-mono` | 5.3.0 | OFL-1.1 | tak | <https://fontsource.org/fonts/space-mono> | runtime |
| `@gsap/react` | 2.1.2 | SEE LICENSE AT https://gsap.com/standard-license ⚠ | nie | <https://github.com/greensock/react#readme> | runtime |
| `@iconify-json/game-icons` | 1.2.4 | CC-BY-3.0 ⚠ | nie | <https://icon-sets.iconify.design/game-icons/> | runtime |
| `@iconify/react` | 6.0.4 | MIT | tak | <https://iconify.design/> | runtime |
| `@phosphor-icons/react` | 2.1.10 | MIT | tak | <https://phosphoricons.com> | runtime |
| `@radix-ui/react-dialog` | 1.3.1 | MIT | tak | <https://radix-ui.com/primitives> | runtime |
| `@radix-ui/react-tooltip` | 1.4.1 | MIT | tak | <https://radix-ui.com/primitives> | runtime |
| `@react-spring/three` | 10.1.2 | MIT | tak | <https://github.com/pmndrs/react-spring#readme> | runtime |
| `@react-three/drei` | 10.7.9 | MIT | tak | <https://github.com/pmndrs/drei> | runtime |
| `@react-three/fiber` | 9.8.2 | MIT | nie | <https://github.com/pmndrs/react-three-fiber#readme> | runtime |
| `@react-three/postprocessing` | 3.2.2 | MIT | tak | <https://github.com/pmndrs/react-postprocessing#readme> | runtime |
| `@react-three/uikit` | 1.0.78 | MIT (tekst w pliku LICENSE) | tak | <https://github.com/pmndrs/uikit> | runtime |
| `@tabler/icons-react` | 3.52.0 | MIT | tak | <https://tabler.io/icons> | runtime |
| `@tailwindcss/vite` | 4.3.5 | MIT | tak | <https://tailwindcss.com> | runtime |
| `@theatre/core` | 0.7.2 | Apache-2.0 | tak | <https://github.com/AriaMinaei/theatre> | runtime |
| `@tsparticles/engine` | 4.6.0 | MIT | tak | <https://particles.js.org> | runtime |
| `@tsparticles/react` | 4.6.0 | MIT | nie | <https://github.com/tsparticles/tsparticles> | runtime |
| `@tsparticles/slim` | 4.6.0 | MIT | tak | <https://particles.js.org> | runtime |
| `@visx/group` | 4.0.0 | MIT | tak | <https://github.com/airbnb/visx#readme> | runtime |
| `@visx/responsive` | 4.0.0 | MIT | tak | <https://github.com/airbnb/visx#readme> | runtime |
| `@visx/scale` | 4.0.0 | MIT | tak | <https://github.com/airbnb/visx#readme> | runtime |
| `@visx/shape` | 4.0.0 | MIT | tak | <https://github.com/airbnb/visx> | runtime |
| `animejs` | 4.5.0 | MIT | tak | <https://animejs.com> | runtime |
| `augmented-ui` | 2.0.0 | BSD-2-Clause | tak | <http://augmented-ui.com> | runtime |
| `cmdk` | 1.1.1 | MIT | tak | <https://github.com/pacocoursey/cmdk#readme> | runtime |
| `echarts` | 6.1.0 | Apache-2.0 | tak | <https://echarts.apache.org> | runtime |
| `echarts-for-react` | 3.0.6 | MIT | tak | <https://github.com/hustcc/echarts-for-react> | runtime |
| `gsap` | 3.15.1 | Standard 'no charge' license: https://gsap.com/standard-license. ⚠ | nie | <https://gsap.com> | runtime |
| `howler` | 2.2.4 | MIT | tak | <https://howlerjs.com> | runtime |
| `leva` | 0.10.1 | MIT | tak | <https://github.com/pmndrs/leva> | runtime |
| `lottie-react` | 3.1.2 | MIT | tak | <https://lottiereact.com> | runtime |
| `lucide-react` | 1.73.0 | ISC | tak | <https://lucide.dev> | runtime |
| `material-symbols` | 0.49.0 | Apache-2.0 | tak | <https://marella.github.io/material-symbols/demo/> | runtime |
| `motion` | 14.14.0 | MIT | tak | <https://github.com/motiondivision/motion> | runtime |
| `motion-v10` (alias `motion`) | 10.18.0 | MIT | tak | — | runtime |
| `ogl` | 1.0.11 | Unlicense | nie | <https://github.com/oframe/ogl#readme> | runtime |
| `postprocessing` | 6.39.6 | Zlib | tak | <https://github.com/pmndrs/postprocessing> | runtime |
| `react` | 19.3.1 | MIT | tak | <https://react.dev/> | runtime |
| `react-dom` | 19.3.1 | MIT | tak | <https://react.dev/> | runtime |
| `react-force-graph-2d` | 1.29.2 | MIT | nie | <https://github.com/vasturiano/react-force-graph> | runtime |
| `react-force-graph-3d` | 1.29.2 | MIT | nie | <https://github.com/vasturiano/react-force-graph> | runtime |
| `react-powerglitch` | 1.1.0 | MIT (tekst w pliku LICENSE) | tak | — | runtime |
| `react-spinners` | 0.17.1 | MIT | tak | <https://www.davidhu.io/react-spinners/> | runtime |
| `tailwindcss` | 4.3.5 | MIT | tak | <https://tailwindcss.com> | runtime |
| `three` | 0.187.0 | MIT | tak | <https://threejs.org/> | runtime |
| `three-vanta` (alias `three`) | 0.134.0 | MIT | tak | <https://threejs.org/> | runtime |
| `use-sound` | 5.0.0 | MIT | tak | <github:joshwcomeau/use-sound> | runtime |
| `vanta` | 0.5.24 | MIT | tak | <https://github.com/tengbao/vanta> | runtime |
| `zustand` | 5.1.0 | MIT | tak | <https://github.com/pmndrs/zustand> | runtime |

### Zależności deweloperskie (`devDependencies`)

| Pakiet | Wersja | Licencja (pole `license`) | Plik LICENSE | Strona / repozytorium | Typ |
|---|---|---|---|---|---|
| `@types/howler` | 2.2.13 | MIT | tak | <https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/howler> | dev |
| `@types/node` | 24.19.2 | MIT | tak | <https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/node> | dev |
| `@types/react` | 19.3.0 | MIT | tak | <https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/react> | dev |
| `@types/react-dom` | 19.3.0 | MIT | tak | <https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/react-dom> | dev |
| `@types/three` | 0.187.0 | MIT | tak | <https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/three> | dev |
| `@vitejs/plugin-react` | 6.3.0 | MIT | tak | <https://github.com/vitejs/vite-plugin-react/tree/main/packages/plugin-react#readme> | dev |
| `oxlint` | 1.93.0 | MIT | tak | <https://oxc.rs/docs/guide/usage/linter> | dev |
| `typescript` | 7.0.2 | Apache-2.0 | tak | <https://www.typescriptlang.org/> | dev |
| `vite` | 8.3.8 | MIT | tak | <https://vite.dev> | dev |

### Importowane bezpośrednio, obecne tylko przechodnio

| Pakiet | Wersja | Licencja (pole `license`) | Plik LICENSE | Strona / repozytorium | Typ |
|---|---|---|---|---|---|
| `powerglitch` | 2.5.0 | MIT (tekst w pliku LICENSE) | tak | <https://github.com/7PH/powerglitch> | przechodnia |
| `three-stdlib` | 2.36.1 | MIT | tak | <https://github.com/pmndrs/three-stdlib> | przechodnia |
<!-- AUTO:DEPENDENCIES:END -->
