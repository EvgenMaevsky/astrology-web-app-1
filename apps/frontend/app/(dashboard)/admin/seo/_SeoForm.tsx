"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { saveSeoSettings } from "@/app/actions/site-settings";
// Type-only: app/lib/site-settings.ts reaches next/headers through auth.ts,
// which cannot be pulled into a client bundle. The image URLs it would build
// arrive as props instead.
import type { SiteSettings } from "@/app/lib/site-settings";

const INPUT_CLASS =
  "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-800 " +
  "focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500";

const CARD_CLASS = "bg-white rounded-xl border border-stone-200 p-6 space-y-4";

const HEADING_CLASS = "text-sm font-semibold text-stone-700 uppercase tracking-wider";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-stone-700">{label}</span>
      {children}
      {hint && <span className="block text-xs text-stone-400">{hint}</span>}
    </label>
  );
}

function ImageField({
  kind,
  label,
  hint,
  currentUrl,
}: {
  kind: "favicon" | "og_image";
  label: string;
  hint: string;
  currentUrl: string | null;
}) {
  const t = useTranslations("admin.seo");

  return (
    <div className="space-y-2">
      <span className="text-sm font-medium text-stone-700">{label}</span>

      {currentUrl && (
        <div className="flex items-center gap-3">
          {/* Served from the API, not from /public — next/image would need
              the backend host whitelisted in next.config, which buys nothing
              for a preview thumbnail. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentUrl}
            alt={label}
            className="h-10 w-10 rounded border border-stone-200 bg-stone-50 object-contain"
          />
          <label className="flex items-center gap-2 text-sm text-stone-600">
            <input type="checkbox" name={`remove_${kind}`} className="accent-amber-600" />
            {t("removeImage")}
          </label>
        </div>
      )}

      <input
        type="file"
        name={kind}
        accept="image/png,image/jpeg,image/x-icon,image/vnd.microsoft.icon,image/webp"
        className="block w-full text-sm text-stone-600 file:mr-3 file:rounded-lg file:border file:border-stone-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-stone-700 hover:file:bg-stone-50"
      />
      <span className="block text-xs text-stone-400">{hint}</span>
    </div>
  );
}

export function SeoForm({
  settings,
  faviconUrl,
  ogImageUrl,
}: {
  settings: SiteSettings;
  faviconUrl: string | null;
  ogImageUrl: string | null;
}) {
  const t = useTranslations("admin.seo");
  const [state, action, pending] = useActionState(saveSeoSettings, undefined);

  return (
    <form action={action} className="space-y-6">
      <div className={CARD_CLASS}>
        <h2 className={HEADING_CLASS}>{t("ukrainian")}</h2>
        <Field label={t("metaTitle")} hint={t("metaTitleHint")}>
          <input
            name="title_uk"
            defaultValue={settings.title_uk ?? ""}
            maxLength={200}
            placeholder={t("placeholderDefault")}
            className={INPUT_CLASS}
          />
        </Field>
        <Field label={t("metaDescription")} hint={t("metaDescriptionHint")}>
          <textarea
            name="description_uk"
            defaultValue={settings.description_uk ?? ""}
            maxLength={1000}
            rows={3}
            placeholder={t("placeholderDefault")}
            className={INPUT_CLASS}
          />
        </Field>
      </div>

      <div className={CARD_CLASS}>
        <h2 className={HEADING_CLASS}>{t("english")}</h2>
        <Field label={t("metaTitle")} hint={t("metaTitleHint")}>
          <input
            name="title_en"
            defaultValue={settings.title_en ?? ""}
            maxLength={200}
            placeholder={t("placeholderDefault")}
            className={INPUT_CLASS}
          />
        </Field>
        <Field label={t("metaDescription")} hint={t("metaDescriptionHint")}>
          <textarea
            name="description_en"
            defaultValue={settings.description_en ?? ""}
            maxLength={1000}
            rows={3}
            placeholder={t("placeholderDefault")}
            className={INPUT_CLASS}
          />
        </Field>
      </div>

      <div className={CARD_CLASS}>
        <h2 className={HEADING_CLASS}>{t("images")}</h2>
        <ImageField
          kind="favicon"
          label={t("favicon")}
          hint={t("faviconHint")}
          currentUrl={faviconUrl}
        />
        <ImageField
          kind="og_image"
          label={t("ogImage")}
          hint={t("ogImageHint")}
          currentUrl={ogImageUrl}
        />
      </div>

      <div className={CARD_CLASS}>
        <h2 className={HEADING_CLASS}>{t("indexing")}</h2>
        <label className="flex items-start gap-2.5 text-sm text-stone-700">
          <input
            type="checkbox"
            name="noindex"
            defaultChecked={settings.noindex}
            className="mt-0.5 accent-amber-600"
          />
          <span>
            {t("noindex")}
            <span className="block text-xs text-stone-400">{t("noindexHint")}</span>
          </span>
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 transition-colors"
        >
          {pending ? t("saving") : t("save")}
        </button>
        {state?.message && <span className="text-sm text-emerald-700">{state.message}</span>}
        {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
