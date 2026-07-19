import { getTranslations } from "next-intl/server";
import { VerifyEmailAction } from "./_VerifyEmailAction";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const t = await getTranslations("auth.verifyEmail");

  return (
    <div className="w-full max-w-md">
      <div className="rounded-2xl bg-white/80 backdrop-blur shadow-xl shadow-amber-900/10 border border-stone-200 p-8">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold tracking-widest text-amber-700 uppercase mb-2">
            Zorya
          </p>
          <h1 className="text-2xl font-semibold text-stone-900">{t("title")}</h1>
          <p className="mt-2 text-sm text-stone-500">
            {t("subtitle")}
          </p>
        </div>
        <VerifyEmailAction token={token ?? ""} />
      </div>
    </div>
  );
}
