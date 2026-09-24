"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { API_URL, getAccessToken } from "@/app/lib/auth";

type SeoState = { message?: string; error?: string } | undefined;

type ErrorDetail = { code?: string } | string | undefined;

type ImageKind = "favicon" | "og_image" | "logo_dark" | "logo_light";

async function errorMessage(res: Response): Promise<string> {
  const t = await getTranslations("admin.seo.errors");
  if (res.status === 403) return t("notAdmin");

  const body = await res.json().catch(() => ({}));
  const detail: ErrorDetail = body?.detail;
  const code = typeof detail === "object" ? detail?.code : undefined;

  switch (code) {
    case "file_too_large":
      return t("fileTooLarge");
    case "unsupported_image":
      return t("unsupportedImage");
    default:
      return t("saveFailed");
  }
}

/** Returns an error message, or null on success. */
async function applyImageChange(
  token: string,
  kind: ImageKind,
  formData: FormData
): Promise<string | null> {
  if (formData.get(`remove_${kind}`) === "on") {
    const res = await fetch(`${API_URL}/api/v1/site-settings/image/${kind}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok ? null : await errorMessage(res);
  }

  const file = formData.get(kind);
  // An untouched file input still submits an empty File, which must not be
  // mistaken for an upload.
  if (!(file instanceof File) || file.size === 0) return null;

  const payload = new FormData();
  payload.set("kind", kind);
  payload.set("file", file);

  const res = await fetch(`${API_URL}/api/v1/site-settings/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: payload,
  });
  return res.ok ? null : await errorMessage(res);
}

export async function saveSeoSettings(
  _state: SeoState,
  formData: FormData
): Promise<SeoState> {
  const t = await getTranslations("admin.seo");
  const token = await getAccessToken();
  if (!token) return { error: t("errors.notAuthenticated") };

  try {
    // Images first: if one fails we stop and say so, rather than reporting
    // success for a save that only half happened.
    for (const kind of ["favicon", "og_image", "logo_dark", "logo_light"] as const) {
      const failure = await applyImageChange(token, kind, formData);
      if (failure) return { error: failure };
    }

    const res = await fetch(`${API_URL}/api/v1/site-settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        title_uk: formData.get("title_uk"),
        title_en: formData.get("title_en"),
        description_uk: formData.get("description_uk"),
        description_en: formData.get("description_en"),
        noindex: formData.get("noindex") === "on",
      }),
    });
    if (!res.ok) return { error: await errorMessage(res) };
  } catch {
    return { error: t("errors.cannotConnect") };
  }

  // The root layout reads these on every render, so refresh the whole tree —
  // otherwise the admin saves a title and still sees the old browser tab.
  revalidatePath("/", "layout");
  return { message: t("saved") };
}
