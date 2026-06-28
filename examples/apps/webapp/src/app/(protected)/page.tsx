import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@old-st/ui';
import Link from 'next/link';

const sections = [
  {
    title: 'Users',
    href: '/users',
    description: 'Manage user accounts, roles and statuses',
    icon: '👤',
  },
  {
    title: 'Products',
    href: '/products',
    description: 'Manage product catalog, pricing and inventory',
    icon: '📦',
  },
  {
    title: 'Orders',
    href: '/orders',
    description: 'Manage customer orders, payments and fulfillment',
    icon: '🛒',
  },
];

export default function DashboardPage() {
  return (
    <>
      <Header title="Dashboard" />
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold tracking-tight">
            Welcome to Old ST Admin
          </h2>
          <p className="text-muted-foreground">
            Manage your users, products and orders from one place.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {sections.map((section) => (
            <Link key={section.href} href={section.href} data-testid={`dashboard-card-${section.title.toLowerCase()}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-2xl">{section.icon}</span>
                    {section.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {section.description}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
