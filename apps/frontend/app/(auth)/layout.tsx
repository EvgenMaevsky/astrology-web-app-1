export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,#f5e6c8_0%,#ede0cc_50%,#e5d5b8_100%)] flex items-center justify-center p-4">
      {children}
    </div>
  );
}
