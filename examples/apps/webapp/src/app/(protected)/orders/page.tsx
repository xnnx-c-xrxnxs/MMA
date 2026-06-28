'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/header';
import { Button, Select } from '@old-st/ui';
import { useOrdersByStatus } from '@old-st/client-common';
import { ORDER_STATUSES } from '@old-st/contracts/order';
import { CreateOrderForm } from '@/components/orders/create-order-form';
import { OrdersTable } from '@/components/orders/orders-table';

export default function OrdersPage() {
  const [status, setStatus] = useState<string>('DRAFT');
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading, isError, error } = useOrdersByStatus({
    orderStatus: status,
  });

  return (
    <>
      <Header title="Orders" />
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span id="orders-status-filter-label" className="text-sm font-medium">Status:</span>
            <Select
              data-testid="status-filter"
              aria-labelledby="orders-status-filter-label"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
          </div>
          <Button data-testid="create-order-btn" onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? 'Close' : '+ New Order'}
          </Button>
        </div>

        {showCreate && <CreateOrderForm onClose={() => setShowCreate(false)} />}

        {isLoading && <p className="text-muted-foreground">Loading orders...</p>}
        {isError && <p className="text-destructive">{error.message}</p>}

        {data && (
          <>
            <OrdersTable orders={data.data} />
            <div data-testid="pagination-info" className="text-sm text-muted-foreground">
              Page {data.page} of {data.totalPages} ({data.total} total)
            </div>
          </>
        )}
      </div>
    </>
  );
}
