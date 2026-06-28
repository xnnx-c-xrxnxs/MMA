import './globals.css';
import { Mulish } from 'next/font/google';
import { Providers } from '@mma/client-common';
import { Toaster } from '@mma/ui';
import { ThemeProvider } from '../components/theme-provider';

// Mulish exposes itself as the `--font-sans` CSS variable. Tailwind v4's
// `@theme` block (in `globals.css` → `tokens.css`) reads `--font-sans` to
// power the `font-sans` utility. The variable is set on `<html>` via
// `mulish.variable`, so the cascade resolves it before Tailwind paints.
const mulish = Mulish({
  subsets: ['latin'],
  weight: ['400', '600', '800'],
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
    <html lang="en" suppressHydrationWarning className={mulish.variable}>
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
