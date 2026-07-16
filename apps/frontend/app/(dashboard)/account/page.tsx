import { getAccessToken, API_URL } from "@/app/lib/auth";
import { EmailSection } from "./_EmailSection";
import { DangerZone } from "./_DangerZone";

export const metadata = { title: "Account — Zorya" };

async function fetchMe(token: string) {
  try {
    const res = await fetch(`${API_URL}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json() as Promise<{ email: string; plan: string; email_verified: boolean }>;
  } catch {
    return null;
  }
}

export default async function AccountPage() {
  const token = await getAccessToken();
  const user = token ? await fetchMe(token) : null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-stone-800">Account</h1>
        <p className="text-sm text-stone-500 pb-2">Manage your email and account settings.</p>
      </div>

      {user && <EmailSection email={user.email} verified={user.email_verified} />}

      <DangerZone />
    </div>
  );
}
