'use client';

import {
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@old-st/ui';
import { formatUserStatus } from '@old-st/client-common';
import { userStatusVariant } from '@/lib/status-variants';
import { UserActions } from './user-actions';
import type { UserResponse } from '@old-st/contracts/user';
import Link from 'next/link';

export function UsersTable({ users }: { users: UserResponse[] }) {
  return (
    <Table data-testid="users-table">
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Created</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.userId} data-testid={`user-row-${user.userId}`}>
            <TableCell>
              <Link
                href={`/users/${user.userId}`}
                className="font-medium hover:underline"
              >
                {user.firstName} {user.lastName}
              </Link>
            </TableCell>
            <TableCell>{user.email}</TableCell>
            <TableCell>
              <Badge variant="outline">{user.userRole}</Badge>
            </TableCell>
            <TableCell>
              <Badge variant={userStatusVariant(user.userStatus)}>
                {formatUserStatus(user.userStatus)}
              </Badge>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {new Date(user.dateCreated).toLocaleDateString()}
            </TableCell>
            <TableCell className="text-right">
              <UserActions user={user} />
            </TableCell>
          </TableRow>
        ))}
        {users.length === 0 && (
          <TableRow>
            <TableCell colSpan={6} className="text-center text-muted-foreground">
              No users found
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
