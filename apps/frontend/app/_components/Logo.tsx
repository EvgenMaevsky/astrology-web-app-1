import { getSiteSettings, siteImageUrl } from "@/app/lib/site-settings";
import type { Tone } from "@/app/_components/ui/theme";

const SIZES = {
  sm: { text: "text-xl", image: "h-7" },
  md: { text: "text-2xl", image: "h-9" },
} as const;

const TEXT_COLOUR: Record<Tone, string> = {
  dark: "text-starlight",
  light: "text-ink-900",
};

/**
 * The site's logo: the image uploaded in the admin panel for this surface,
 * or the text wordmark when there is none (or the backend is unreachable).
 *
 * Two uploads rather than one because the marketing pages are dark and the
 * dashboard is light — a single image rarely reads well on both.
 *
 * Renders only the mark; the caller wraps it in a link where it wants one.
 */
export async function Logo({ tone, size = "md" }: { tone: Tone; size?: keyof typeof SIZES }) {
  const settings = await getSiteSettings();
  const file = tone === "dark" ? settings?.logo_dark : settings?.logo_light;

  if (file) {
    return (
      // Served from the API host, so next/image would need it whitelisted in
      // next.config for no gain on an image this small.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={siteImageUrl(file)} alt="Astrodite" className={`${SIZES[size].image} w-auto max-w-[200px] object-contain`} />
    );
  }

  return (
    <span className={`font-display font-semibold tracking-wide ${SIZES[size].text} ${TEXT_COLOUR[tone]}`}>
      Astrodite
    </span>
  );
}
