'use client';

import { Button, Card, CardContent, CardHeader, CardTitle, Select } from '@old-st/ui';
import {
  useDeleteUser,
  useActivateUser,
  useDeactivateUser,
  useVerifyUserEmail,
  useUpdateUserRole,
} from '@old-st/client-common';
import { USER_ROLES, UserStatusEnum } from '@old-st/contracts/user';
import type { UserResponse } from '@old-st/contracts/user';

export interface UserActionsProps {
  user: UserResponse;
  /**
   * `list` (default) — compact ghost buttons for the table action column.
   * `detail` — full-width action card used on the user detail page,
   * including the role selector.
   */
  variant?: 'list' | 'detail';
}

export function UserActions({ user, variant = 'list' }: UserActionsProps) {
  const deleteUser = useDeleteUser();
  const activateUser = useActivateUser();
  const deactivateUser = useDeactivateUser();
  const verifyEmail = useVerifyUserEmail();
  const updateRole = useUpdateUserRole();

  const isDetail = variant === 'detail';
  const buttonSize = isDetail ? undefined : ('sm' as const);
  const buttonVariant = isDetail ? ('outline' as const) : ('ghost' as const);

  const buttons = (
    <>
      {user.userStatus === UserStatusEnum.PENDING && (
        <Button
          size={buttonSize}
          variant={buttonVariant}
          onClick={() => verifyEmail.mutate(user.userId)}
        >
          {isDetail ? 'Verify Email' : 'Verify'}
        </Button>
      )}
      {(user.userStatus === UserStatusEnum.PENDING ||
        user.userStatus === UserStatusEnum.INACTIVE) && (
        <Button
          size={buttonSize}
          variant={buttonVariant}
          onClick={() => activateUser.mutate(user.userId)}
        >
          Activate
        </Button>
      )}
      {user.userStatus === UserStatusEnum.ACTIVE && (
        <Button
          size={buttonSize}
          variant={buttonVariant}
          onClick={() => deactivateUser.mutate(user.userId)}
        >
          Deactivate
        </Button>
      )}
      {user.userStatus !== UserStatusEnum.DELETED && (
        <Button
          size={buttonSize}
          variant={isDetail ? 'destructive' : 'ghost'}
          className={isDetail ? undefined : 'text-destructive'}
          onClick={() => deleteUser.mutate(user.userId)}
        >
          Delete
        </Button>
      )}
    </>
  );

  if (!isDetail) {
    return <div className="flex gap-1">{buttons}</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Actions</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Select
          className="w-auto"
          value={user.userRole}
          onChange={(e) =>
            updateRole.mutate({
              userId: user.userId,
              data: {
                userRole: e.target.value as (typeof USER_ROLES)[number],
              },
            })
          }
        >
          {USER_ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </Select>
        {buttons}
      </CardContent>
    </Card>
  );
}
