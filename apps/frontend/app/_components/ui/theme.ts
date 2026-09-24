/**
 * Class recipes for the two surfaces of the redesign
 * (docs/plans/2026-09-24-e7-redesign-design.md):
 *
 *   dark  — the marketing surfaces: landing, /natal, sign-in, legal pages
 *   light — the dashboard, a light variant of the same palette
 *
 * Pages take their classes from here instead of spelling them out, so a
 * form looks the same on every page of a surface and the two surfaces
 * cannot drift apart. Every text pair was computed against WCAG AA (card
 * and input backgrounds blended with their alpha over the page colour); the
 * figures are next to each entry. Lowest: 5.2:1.
 *
 * nebula-500 appears only in borders and focus rings on the dark surface.
 * As text on space-950 it is 4.47:1, just under the 4.5:1 minimum.
 */

export type Tone = "dark" | "light";

export interface ThemeRecipes {
  /** Card holding a form or a block of content. */
  card: string;
  /** Display heading on a card or page. */
  heading: string;
  /** Running text. */
  body: string;
  /** Secondary text: hints, captions, helper copy. */
  muted: string;
  label: string;
  input: string;
  primaryButton: string;
  secondaryButton: string;
  link: string;
  error: string;
  success: string;
  /** Thin horizontal rule. */
  divider: string;
  /** Floating list, e.g. city suggestions. */
  dropdown: string;
  dropdownItem: string;
  dropdownItemActive: string;
}

export const THEME: Record<Tone, ThemeRecipes> = {
  dark: {
    card: "rounded-2xl border border-space-700 bg-space-900/70 backdrop-blur",
    // starlight on the card ≈ 14.9:1
    heading: "font-display font-semibold text-starlight",
    body: "text-starlight",
    // dusk on the card ≈ 6.5:1
    muted: "text-dusk",
    label: "block text-sm font-medium text-starlight",
    input:
      "w-full rounded-lg border border-space-600 bg-space-950/60 px-3.5 py-2.5 text-sm text-starlight " +
      "placeholder:text-dusk focus:border-transparent focus:outline-none focus:ring-2 focus:ring-nebula-500 " +
      // Native parts of the control (the date picker's calendar icon, number
      // spinners) otherwise stay dark-on-dark and all but disappear.
      "[color-scheme:dark]",
    // gold-950 on gold-400 ≈ 10.2:1
    primaryButton:
      "rounded-lg bg-gold-400 px-4 py-2.5 text-sm font-semibold text-gold-950 transition " +
      "hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 " +
      "focus-visible:ring-offset-2 focus-visible:ring-offset-space-900 disabled:cursor-not-allowed disabled:opacity-60",
    secondaryButton:
      "rounded-lg border border-space-600 px-4 py-2.5 text-sm font-medium text-starlight transition " +
      "hover:border-dusk disabled:cursor-not-allowed disabled:opacity-60",
    // gold-400 on the card ≈ 11.3:1
    link: "font-medium text-gold-400 transition hover:brightness-110",
    error: "rounded-lg border border-red-400/40 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-200",
    success: "rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-3.5 py-2.5 text-sm text-emerald-200",
    divider: "bg-space-700",
    dropdown: "border border-space-700 bg-space-900 shadow-2xl shadow-black/40",
    dropdownItem: "text-starlight hover:bg-space-800",
    dropdownItemActive: "bg-space-800 text-starlight",
  },
  light: {
    card: "rounded-2xl border border-mist-200 bg-white",
    // ink-900 on white ≈ 16.8:1
    heading: "font-display font-semibold text-ink-900",
    body: "text-ink-900",
    // ink-600 on white ≈ 6.6:1, on mist-50 ≈ 6.1:1
    muted: "text-ink-600",
    label: "block text-sm font-medium text-ink-900",
    input:
      "w-full rounded-lg border border-mist-300 bg-white px-3.5 py-2.5 text-sm text-ink-900 " +
      "placeholder:text-ink-600 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-nebula-600",
    // white on nebula-600 ≈ 5.2:1
    // Hover darkens rather than brightens: a lighter violet would take the
    // white label below 5:1.
    primaryButton:
      "rounded-lg bg-nebula-600 px-4 py-2.5 text-sm font-semibold text-white transition " +
      "hover:bg-nebula-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-nebula-600 " +
      "focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
    secondaryButton:
      "rounded-lg border border-mist-300 bg-white px-4 py-2.5 text-sm font-medium text-ink-900 transition " +
      "hover:bg-mist-50 disabled:cursor-not-allowed disabled:opacity-60",
    // nebula-600 on white ≈ 5.2:1
    link: "font-medium text-nebula-600 transition hover:underline",
    error: "rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700",
    success: "rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700",
    divider: "bg-mist-200",
    dropdown: "border border-mist-200 bg-white shadow-lg",
    dropdownItem: "text-ink-900 hover:bg-mist-50",
    dropdownItemActive: "bg-mist-50 text-ink-900",
  },
};
