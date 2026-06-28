import type { Metadata } from 'next';
import { Suspense } from 'react';
import './globals.css';
import { AuthProvider } from '../lib/auth-provider';
import { Navbar } from '../components/layout/navbar';

export const metadata: Metadata = {
  title: 'Monitoring Dashboard',
  description: 'Internal observability dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <Suspense>
            <Navbar />
          </Suspense>
          <main className="container">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
