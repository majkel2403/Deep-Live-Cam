/**
 * PORTED from react-cyber-elements (https://github.com/thiswallz/react-cyber-elements), adapted for JARVIS FX.
 *
 *   Frame  <- src/CyberEl53.tsx  (292 x 176 cyber panel: chamfered outline, bars, ribbon, corner tab)
 *   Button <- src/CyberEl48.tsx  (129 x 34 notched tab: notch frame + left plate + bottom ledge)
 *   Input  <- src/CyberEl50.tsx  (99 x 30 slanted bar: chamfered bracket + header band; re-drawn as a
 *             responsive frame with the same chamfer language, ticks are plain elements)
 *
 * Path data is copied from the source; every hard-coded fill is replaced by `currentColor`, so the
 * colour follows the HUD accent (hue). Sizes, layout, states and animation are re-implemented here.
 *
 * License: MIT, Copyright (c) 2022 Mau Joost. Full notice reproduced below, as the licence requires.
 *
 * MIT License
 *
 * Copyright (c) 2022 Mau Joost
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import type { SVGProps } from 'react'

/** CyberEl53 geometry: outline ring (main tone) + bars, ribbon and corner tab (full tone). */
export function CyberFrameShape(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 292 176" aria-hidden="true" focusable="false" {...props}>
      <path d="M62 126h226V49L243 4H16L4 17v18h46l12 12v79zm230 4H59V49L48 38H0V15L15 0h230l47 47v83z" fill="currentColor" fillOpacity={0.55} fillRule="nonzero" />
      <path
        d="M77 172h40l12-11h48l19-19h-89l-30 30zm42 4H67l39-38h99l-26 27h-49l-11 11zM76 86h200V69H76zM76 112h200V95H76zM40 151h-4V73H15v-4h25zM40 65H15v-4h21v-3H15v-4h25zM292 0v25h-4c0-6-2-11-6-15s-9-6-15-6V0h25z"
        fill="currentColor"
        fillRule="nonzero"
      />
    </svg>
  )
}

/** CyberEl48 geometry: notch frame, left plate and bottom ledge. Fill is the caller's `currentColor`. */
export function CyberButtonShape(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 129 34" preserveAspectRatio="none" aria-hidden="true" focusable="false" {...props}>
      <path d="M13 0v8l1-1V1h112v23H53l-1 1h75V0z" fill="currentColor" fillOpacity={0.9} />
      <path d="M16 7v15h37l-5 5H11V11z" fill="currentColor" fillOpacity={0.55} />
      <path d="M68 31H31l-2 2H8V20l1-1v10h60l-1 2z" fill="currentColor" fillOpacity={0.35} />
    </svg>
  )
}

/**
 * CyberEl50 language for the input: a chamfered bracket (top-left and bottom-right cut) with a header
 * band. Drawn with non-scaling strokes so the field can stretch to any width without fat lines.
 */
export function CyberInputShape(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true" focusable="false" {...props}>
      <path d="M0 9 L9 0 H100 V31 L91 40 H0 Z" fill="currentColor" fillOpacity={0.06} stroke="currentColor" strokeOpacity={0.85} strokeWidth={1} vectorEffect="non-scaling-stroke" />
      <path d="M0 9 L9 0 H34 L25 9 Z" fill="currentColor" fillOpacity={0.9} />
      <path d="M100 31 L91 40 H66 L75 31 Z" fill="currentColor" fillOpacity={0.5} />
    </svg>
  )
}
