# Dźwięki interfejsu (bleepy) — JARVIS FX

Wszystkie dźwięki UI przechodzą przez jedno API: `playBleep(name)` z `src/lib/sound`.
Nazwy (11): `click`, `hover`, `open`, `close`, `type`, `success`, `error`, `alert`, `scan`, `boot`, `toggle`.

Backend wybierany jest dla każdego bleepa osobno (Laboratorium dźwięku → „Źródło”):

| Priorytet | Backend | Pliki | Licencja | Status w repozytorium |
|---|---|---|---|---|
| 1 | **Kenney** (opcjonalnie) | `kenney/**` + `kenney/manifest.json` | CC0 1.0 | nie dołączony — instaluje go użytkownik skryptem |
| 2 | **WAV** (howler) | `synth/*.wav` + `synth/manifest.json` | CC0 1.0 (nasze) | dołączony, ~164 KB |
| 3 | **Synteza WebAudio** | brak plików — oscylatory w `src/lib/sound/synth.ts` | CC0 1.0 (nasze) | zawsze dostępna, także jako fallback w trakcie ładowania |

`index.json` to rejestr paczek — aplikacja czyta tylko paczki w nim wymienione (żadnego zgadywania
ścieżek, więc zero błędów 404 w konsoli). Oba skrypty aktualizują go automatycznie.

## Nasze pliki WAV (`synth/`)

Wygenerowane przez `node scripts/render-sounds.mjs` (Node ≥ 18, bez zależności): oscylatory z
anty-aliasingiem (PolyBLEP), obwiednie wykładnicze, krótki szum „kliku”, filtr dolnoprzepustowy.
16-bit PCM, mono, 44,1 kHz. Receptury odpowiadają syntezatorowi WebAudio (te same wysokości,
glissanda i poziomy szczytowe), więc przełączenie backendu nie zmienia głośności ani charakteru.

Utwory są oryginalne i udostępnione jako **CC0 1.0** (domena publiczna) — bez wymogu atrybucji.
Po zmianie receptur uruchom skrypt ponownie i zatwierdź pliki `.wav`.

## Kenney (opcjonalnie, `kenney/`)

Paczki [Interface Sounds](https://kenney.nl/assets/interface-sounds) i
[Sci-fi Sounds](https://kenney.nl/assets/sci-fi-sounds) autorstwa Kenney — **CC0 1.0**
(<https://kenney.nl/support>; podziękowanie mile widziane, niewymagane).

```bash
node scripts/fetch-kenney.mjs                          # pobierz z kenney.nl, rozpakuj, zmapuj
node scripts/fetch-kenney.mjs --from-dir ~/Downloads    # użyj ręcznie pobranych kenney_*.zip
node scripts/fetch-kenney.mjs --zip a.zip --zip b.zip   # wskaż konkretne archiwa
node scripts/fetch-kenney.mjs --remap                  # tylko przebuduj manifest
node scripts/fetch-kenney.mjs --remove                 # odinstaluj
```

Skrypt rozpakowuje wyłącznie pliki audio i licencję, odczytuje rzeczywistą długość każdego pliku
(nagłówki Ogg/WAV), wybiera najkrótsze pasujące warianty (do 3 na bleep — aplikacja losuje) i
ustawia ciche wzmocnienie (`gain`), bo pliki Kenneya są masterowane głośno. Mapowanie można
poprawić ręcznie w `kenney/manifest.json`.

Za firmowym proxy: Node ≥ 24 z `NODE_USE_ENV_PROXY=1` albo pobierz ZIP-y w przeglądarce i użyj
`--from-dir`. Nie dołączamy plików Kenneya do repozytorium — każdy instaluje je lokalnie.

## Format manifestu (własne paczki)

```json
{
  "title": "Nazwa paczki",
  "license": "CC0-1.0",
  "licenseUrl": "https://…",
  "sourceUrl": "https://…",
  "bleeps": {
    "click": { "files": ["click_a.ogg", "click_b.ogg"], "gain": 0.35 },
    "success": { "files": ["ok.wav"], "gain": 0.45, "durationMs": 140 }
  }
}
```

Ścieżki w `files` są względne wobec katalogu manifestu. Brakujące bleepy spadają na nasze WAV-y,
a potem na syntezę. Obsługiwane formaty: WAV, OGG (Vorbis/Opus), MP3 — zależnie od przeglądarki.

## Inne źródła — zasady licencyjne (obecnie NIEużywane)

| Źródło | Licencja | Co trzeba zrobić |
|---|---|---|
| [Mixkit](https://mixkit.co/free-sound-effects/) | Mixkit Sound Effects Free License | Użycie komercyjne i niekomercyjne bez atrybucji; **nie wolno** redystrybuować samych plików (np. jako paczki dźwięków). Sprawdź aktualną treść licencji na mixkit.co/license. |
| [Freesound](https://freesound.org) | licencja **per plik**: CC0, CC BY 4.0, CC BY-NC 4.0 (starsze: CC BY 3.0, Sampling+) | Zapisz autora, link i licencję każdego pliku. CC BY → atrybucja w aplikacji. **CC BY-NC → tylko projekty niekomercyjne** — unikaj. |
| [ZapSplat](https://www.zapsplat.com) | ZapSplat Standard License (konto darmowe) | **Wymagana atrybucja**, np. „Sound effects obtained from https://www.zapsplat.com”. Bez prawa do redystrybucji samych plików. Licencja Premium (płatna) znosi wymóg atrybucji. |

Zasada projektu: dołączamy do repozytorium wyłącznie dźwięki o licencji permisywnej (CC0 lub
naszego autorstwa). Każdy nowy plik z zewnątrz → wpis w tej tabeli + autor/link/licencja w manifeście.

## Polityka dźwięku

- bleepy UI trwają **< 150 ms** (wyjątki: `boot` ≈ 0,7 s, sekwencja rozruchu; `error`/`alert` to podwójne sygnały ≈ 0,2 s — zmierzone na żywo w Laboratorium dźwięku),
- domyślna głośność **35%**, szczyty plików 0,03–0,21 FS — dźwięk ma podpowiadać, nie dominować,
- użytkownik może w każdej chwili **wyciszyć** dźwięk (ikona głośnika w nagłówku, Laboratorium dźwięku) lub zmienić głośność,
- nic nie gra przed pierwszą interakcją (polityka autoplay przeglądarek), a powtarzane dźwięki są ograniczane (`type` co ≥ 30 ms, `hover` co ≥ 60 ms).
