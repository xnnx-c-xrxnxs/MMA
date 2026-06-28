import Link from 'next/link';

/**
 * Shared shell for all public auth pages (login, forgot-password, new-password).
 * Two-column layout: branded left panel + form right panel.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* ── Left branding panel ────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-card border-r p-10">
        <Link href="/" className="text-xl font-semibold">
          Old ST Admin
        </Link>
        <div className="space-y-3">
          <blockquote className="text-2xl font-semibold leading-snug">
            "Manage your platform with confidence."
          </blockquote>
          <p className="text-sm text-muted-foreground">
            Users · Products · Orders · Files
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Old ST Labs
        </p>
      </div>

      {/* ── Right form panel ───────────────────────────────────────── */}
      <div className="flex flex-1 items-center justify-center bg-background p-8">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
