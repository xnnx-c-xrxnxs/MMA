import './globals.css';
import { Inter } from 'next/font/google';
import { Providers } from '@old-st/client-common';
import { Toaster } from '@old-st/ui';
import { ThemeProvider } from '../components/theme-provider';

// Inter exposes itself as the `--font-sans` CSS variable. Tailwind v4's
// `@theme` block (in `globals.css` → `tokens.css`) reads `--font-sans` to
// power the `font-sans` utility. The variable is set on `<html>` via
// `inter.variable`, so the cascade resolves it before Tailwind paints.
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata = {
  title: 'Old ST Admin',
  description: 'Admin dashboard for Old ST microservices',
};

const apiConfig = {
  userApiUrl: process.env.NEXT_PUBLIC_API_USER_URL,
  productApiUrl: process.env.NEXT_PUBLIC_API_PRODUCT_URL,
  orderApiUrl: process.env.NEXT_PUBLIC_API_ORDER_URL,
  authApiUrl: process.env.NEXT_PUBLIC_API_AUTH_URL,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body className="font-sans">
        <ThemeProvider>
          <Providers apiConfig={apiConfig}>
            {children}
            <Toaster />
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
