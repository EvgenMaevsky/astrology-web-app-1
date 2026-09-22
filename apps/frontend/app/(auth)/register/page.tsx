import { GoogleSignInButton } from "@/app/_components/GoogleSignInButton";
import { RegisterForm } from "./_RegisterForm";

// Server component so the Google button can ask the backend whether sign-in
// is configured; the form itself stays a client component.
export default function RegisterPage() {
  return <RegisterForm googleButton={<GoogleSignInButton label="signUp" />} />;
}
