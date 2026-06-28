'use client';

import { use } from 'react';
import { Header } from '@/components/layout/header';
import { useUser } from '@old-st/client-common';
import { UserProfileCard } from '@/components/users/user-profile-card';
import { UserActions } from '@/components/users/user-actions';

export default function UserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = use(params);
  const { data: user, isLoading, isError, error } = useUser(userId);

  if (isLoading) {
    return <p className="p-6 text-muted-foreground">Loading...</p>;
  }
  if (isError) {
    return <p className="p-6 text-destructive">{error.message}</p>;
  }
  if (!user) {
    return <p className="p-6">User not found</p>;
  }

  return (
    <>
      <Header title={`${user.firstName} ${user.lastName}`} />
      <div className="p-6 space-y-4 max-w-2xl">
        <UserProfileCard user={user} />
        <UserActions user={user} variant="detail" />
      </div>
    </>
  );
}
