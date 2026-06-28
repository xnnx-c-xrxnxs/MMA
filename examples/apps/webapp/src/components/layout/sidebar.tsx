'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@old-st/ui';
import { Button } from '@old-st/ui';
import { useAuth } from '@old-st/client-common';

const navItems = [
  { href: '/', label: 'Dashboard', icon: '◻' },
  { href: '/users', label: 'Users', icon: '👤' },
  { href: '/products', label: 'Products', icon: '📦' },
  { href: '/products/categories', label: 'Categories', icon: '🏷️' },
  { href: '/orders', label: 'Orders', icon: '🛒' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  return (
    <aside data-testid="sidebar" className="flex h-screen w-56 flex-col border-r bg-card">
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/" className="text-lg font-semibold">
          Old ST Admin
        </Link>
      </div>
      <nav className="flex-1 space-y-1 p-2">
        {navItems.map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href) &&
                !navItems.some(
                  (other) =>
                    other.href !== item.href &&
                    other.href.startsWith(item.href) &&
                    pathname.startsWith(other.href),
                );
          return (
            <Link
              key={item.href}
              href={item.href}
              data-testid={`sidebar-link-${item.label.toLowerCase()}`}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      {user && (
        <div className="border-t p-3 space-y-2">
          <div data-testid="user-info-display" className="text-xs text-muted-foreground truncate">
            {user.email}
          </div>
          <Link
            href="/change-password"
            className="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            data-testid="change-password-link"
          >
            🔑 Change Password
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={() => signOut()}
            data-testid="sign-out-btn"
          >
            Sign Out
          </Button>
        </div>
      )}
    </aside>
  );
}
