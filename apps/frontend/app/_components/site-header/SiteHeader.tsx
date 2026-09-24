import { getTranslations } from "next-intl/server";
import { hasSession } from "@/app/lib/auth";
import { LanguageSwitcher } from "@/app/_components/LanguageSwitcher";
import { Logo } from "@/app/_components/Logo";
import { SiteHeaderBar } from "./SiteHeaderBar";

/**
 * The header of the dark marketing pages (landing, /natal): fixed to the top
 * of the viewport, with the menu and either sign-in/sign-up or "My dashboard".
 */
export async function SiteHeader() {
  const [t, signedIn] = await Promise.all([getTranslations("siteHeader"), hasSession()]);

  return (
    <SiteHeaderBar
      logo={<Logo tone="dark" />}
      languageSwitcher={<LanguageSwitcher tone="dark" />}
      signedIn={signedIn}
      nav={[
        { href: "/natal", label: t("natal") },
        { href: "/#features", label: t("features") },
        { href: "/#pricing", label: t("pricing") },
        { href: "/#how", label: t("how") },
      ]}
      labels={{
        signIn: t("signIn"),
        signUp: t("signUp"),
        dashboard: t("dashboard"),
        openMenu: t("openMenu"),
        closeMenu: t("closeMenu"),
        menu: t("menu"),
      }}
    />
  );
}
