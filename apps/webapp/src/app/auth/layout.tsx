/**
 * Shared shell for all public auth pages (login, forgot-password, new-password).
 * Two-column layout: form panel on the left and hero image on the right.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mx-auto grid min-h-screen grid-cols-1 gap-8 bg-background p-6 md:grid-cols-2 lg:p-10"
      style={{ maxWidth: '1440px' }}
    >
      {/* ── Left form panel ───────────────────────────────────────── */}
      <div className="flex flex-col">
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full" style={{ maxWidth: '440px' }}>
            {children}
          </div>
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Old ST Labs
        </p>
      </div>

      {/* ── Right image panel ─────────────────────────────────────── */}
      <div className="hidden md:block">
        <div
          aria-label="Fleet hero image"
          className="h-full w-full rounded-4xl bg-cover bg-center"
          style={{
            minHeight: '620px',
            backgroundImage:
              "url('https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=1400&q=80')",
          }}
        />
      </div>
    </div>
  );
}
