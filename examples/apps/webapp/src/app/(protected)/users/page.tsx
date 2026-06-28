'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/header';
import { Button, Select } from '@old-st/ui';
import { useUsersByStatus } from '@old-st/client-common';
import { USER_STATUSES } from '@old-st/contracts/user';
import { CreateUserForm } from '@/components/users/create-user-form';
import { UsersTable } from '@/components/users/users-table';

export default function UsersPage() {
  const [status, setStatus] = useState<string>('ACTIVE');
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading, isError, error } = useUsersByStatus({
    userStatus: status,
  });

  return (
    <>
      <Header title="Users" />
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span id="users-status-filter-label" className="text-sm font-medium">Status:</span>
            <Select
              data-testid="status-filter"
              aria-labelledby="users-status-filter-label"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {USER_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
          </div>
          <Button data-testid="create-user-btn" onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? 'Close' : '+ New User'}
          </Button>
        </div>

        {showCreate && <CreateUserForm onClose={() => setShowCreate(false)} />}

        {isLoading && <p className="text-muted-foreground">Loading users...</p>}
        {isError && <p className="text-destructive">{error.message}</p>}

        {data && <UsersTable users={data.data} />}
      </div>
    </>
  );
}
