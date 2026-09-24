/**
 * Every landing section is at least one screen tall, content centred
 * vertically — the owner's call, for rhythm: one idea per screen.
 *
 * svh, not vh: on phones vh counts the area under the browser toolbar.
 * No scroll-margin for the fixed header: a menu link brings the section's
 * top edge to the top of the screen, so the section fills it exactly, and
 * each section's own top padding (≥ 96 px) keeps the 64 px header clear of
 * the content.
 */
export const FULL_SCREEN = "flex min-h-[100svh] flex-col justify-center";
