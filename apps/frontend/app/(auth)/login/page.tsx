import { getTranslations } from "next-intl/server";
import { GoogleSignInButton } from "@/app/_components/GoogleSignInButton";
import { LoginForm } from "./_LoginForm";

// Server component so the Google button can ask the backend whether sign-in
// is configured; the form itself stays a client component.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ error }, t] = await Promise.all([searchParams, getTranslations("auth.errors")]);

  return (
    <LoginForm
      // The Google routes redirect here on any failure; without this the user
      // would land back on the login page with no idea what went wrong.
      googleError={error === "google" ? t("googleFailed") : undefined}
      googleButton={<GoogleSignInButton label="signIn" />}
    />
  );
}
