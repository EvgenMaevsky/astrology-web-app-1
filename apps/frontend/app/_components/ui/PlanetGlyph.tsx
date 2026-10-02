import { PLANET_GLYPHS } from "@/app/_components/chart-wheel/constants";

/**
 * The wheel's glyph for a body, placed before its name in result tables so
 * rows can be matched to the wheel at a glance. Decorative: the name next to
 * it is what a screen reader reads. Fixed width keeps names aligned.
 * nebula-600 on white ≈ 5.2:1.
 */
export function PlanetGlyph({ name }: { name: string }) {
  const glyph = PLANET_GLYPHS[name];
  if (!glyph) return null;
  return (
    <span aria-hidden="true" className="mr-2 inline-block w-4 text-center font-normal text-nebula-600">
      {glyph}
    </span>
  );
}
