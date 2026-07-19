import { LanguageSwitcher } from "@/app/_components/LanguageSwitcher";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-[radial-gradient(ellipse_at_top,#f5e6c8_0%,#ede0cc_50%,#e5d5b8_100%)] flex items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      {children}
    </div>
  );
}
