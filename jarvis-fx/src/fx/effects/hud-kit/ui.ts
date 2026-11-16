/**
 * `.jx-label` lives in unlayered CSS, so Tailwind colour / size utilities on the same element lose
 * the cascade. Effects that need a coloured or resized label use this utility-only equivalent.
 */
export const LBL = 'font-label font-semibold uppercase tracking-[0.14em] text-jx-dim'
