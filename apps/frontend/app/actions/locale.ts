"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LOCALES, type Locale } from "@/i18n/request";

export async function setLocale(locale: Locale): Promise<void> {
  if (!LOCALES.includes(locale)) return;

  const jar = await cookies();
  jar.set("NEXT_LOCALE", locale, {
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });

  revalidatePath("/", "layout");
}
