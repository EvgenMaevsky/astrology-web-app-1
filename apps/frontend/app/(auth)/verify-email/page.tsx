import { getTranslations } from "next-intl/server";
import { VerifyEmailAction } from "./_VerifyEmailAction";
import { THEME } from "@/app/_components/ui/theme";

// Dark marketing surface — docs/plans/2026-09-24-e7-redesign-design.md §5.
const ui = THEME.dark;

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const t = await getTranslations("auth.verifyEmail");

  return (
    <div className="w-full max-w-md">
      <div className={`${ui.card} p-8 shadow-2xl shadow-black/40`}>
        <div className="mb-8 text-center">
          <h1 className={`${ui.heading} text-3xl`}>{t("title")}</h1>
          <p className="mt-2 text-sm text-dusk">
            {t("subtitle")}
          </p>
        </div>
        <VerifyEmailAction token={token ?? ""} />
      </div>
    </div>
  );
}
