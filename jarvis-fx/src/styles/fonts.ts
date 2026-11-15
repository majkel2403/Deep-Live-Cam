/**
 * Self-hosted fonts (Fontsource, all SIL Open Font License 1.1) – no Google CDN calls.
 * Roles: display Orbitron/Michroma · panel titles Oxanium · labels Rajdhani · UI Chakra Petch
 * logs JetBrains Mono · terminal Share Tech Mono · telemetry IBM Plex Mono · extras.
 */
import '@fontsource/orbitron/500.css'
import '@fontsource/orbitron/700.css'
import '@fontsource/orbitron/900.css'
import '@fontsource/michroma/400.css'
import '@fontsource/oxanium/400.css'
import '@fontsource/oxanium/600.css'
import '@fontsource/oxanium/700.css'
import '@fontsource/rajdhani/500.css'
import '@fontsource/rajdhani/600.css'
import '@fontsource/rajdhani/700.css'
import '@fontsource/chakra-petch/400.css'
import '@fontsource/chakra-petch/500.css'
import '@fontsource/chakra-petch/600.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/600.css'
import '@fontsource/share-tech-mono/400.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/600.css'
import '@fontsource-variable/exo-2'
import '@fontsource-variable/space-grotesk'
import '@fontsource/space-mono/400.css'
import '@fontsource/audiowide/400.css'

export const FONT_ROLES = [
  { family: 'Orbitron', role: 'Nagłówki / znak JARVIS', cssVar: '--jx-font-display', license: 'OFL-1.1' },
  { family: 'Michroma', role: 'Nagłówki centrum dowodzenia', cssVar: '--jx-font-cmd', license: 'OFL-1.1' },
  { family: 'Oxanium', role: 'Tytuły paneli (HUD statku)', cssVar: '--jx-font-head', license: 'OFL-1.1' },
  { family: 'Rajdhani', role: 'Etykiety, gęste odczyty', cssVar: '--jx-font-label', license: 'OFL-1.1' },
  { family: 'Chakra Petch', role: 'Tekst interfejsu', cssVar: '--jx-font-ui', license: 'OFL-1.1' },
  { family: 'Exo 2', role: 'Uniwersalny futurystyczny sans', cssVar: '--jx-font-exo', license: 'OFL-1.1' },
  { family: 'Audiowide', role: 'Akcenty display', cssVar: '--jx-font-audiowide', license: 'OFL-1.1' },
  { family: 'Share Tech Mono', role: 'Terminal / strumień logów', cssVar: '--jx-font-term', license: 'OFL-1.1' },
  { family: 'JetBrains Mono', role: 'Logi agentów, liczby tabelaryczne', cssVar: '--jx-font-mono', license: 'OFL-1.1' },
  { family: 'IBM Plex Mono', role: 'Neutralna telemetria', cssVar: '--jx-font-plex', license: 'OFL-1.1' },
  { family: 'Space Grotesk', role: 'Nowoczesny tekst', cssVar: '--jx-font-space', license: 'OFL-1.1' },
  { family: 'Space Mono', role: 'Para mono do Space Grotesk', cssVar: '--jx-font-spacemono', license: 'OFL-1.1' },
] as const
