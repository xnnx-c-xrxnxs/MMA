import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@mma/ui';

export default function DashboardPage() {
  return (
    <>
      <Header title="Dashboard" />
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold tracking-tight">
            Welcome to Mma Admin
          </h2>
          <p className="text-muted-foreground">
            This is your application dashboard. Add domain section cards below as you
            build out your features.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-2xl">📝</span>
                Reference implementation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                See <code>examples/apps/webapp/src/app/(protected)/</code> for a
                complete example dashboard with users, products, and orders
                pages, components, and React Query hooks wired end-to-end.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
