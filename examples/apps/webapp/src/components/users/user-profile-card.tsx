'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  toast,
} from '@old-st/ui';
import { useUpdateUserProfile, formatUserStatus } from '@old-st/client-common';
import { updateUserSchema } from '@old-st/contracts/user';
import type { UpdateUserInput, UserResponse } from '@old-st/contracts/user';
import { userStatusVariant } from '@/lib/status-variants';

export function UserProfileCard({ user }: { user: UserResponse }) {
  const [editing, setEditing] = useState(false);
  const updateProfile = useUpdateUserProfile();

  const form = useForm<UpdateUserInput>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: { firstName: user.firstName, lastName: user.lastName },
  });

  const onSubmit = async (values: UpdateUserInput) => {
    try {
      await updateProfile.mutateAsync({ userId: user.userId, data: values });
      toast.success('Profile updated');
      setEditing(false);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to update profile';
      toast.error(message);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Profile</span>
          <Badge
            data-testid="user-status-badge"
            variant={userStatusVariant(user.userStatus)}
          >
            {formatUserStatus(user.userStatus)}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {editing ? (
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="grid gap-3 sm:grid-cols-2"
            >
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First name</FormLabel>
                    <FormControl>
                      <Input
                        autoComplete="given-name"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last name</FormLabel>
                    <FormControl>
                      <Input
                        autoComplete="family-name"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex gap-2 sm:col-span-2">
                <Button
                  type="submit"
                  disabled={form.formState.isSubmitting}
                >
                  Save
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditing(false);
                    form.reset();
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        ) : (
          <div className="grid gap-2 text-sm">
            <Row label="Email" value={user.email} />
            <Row label="First name" value={user.firstName} />
            <Row label="Last name" value={user.lastName} />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Role</span>
              <Badge variant="outline">{user.userRole}</Badge>
            </div>
            <Row
              label="Created"
              value={new Date(user.dateCreated).toLocaleString()}
            />
            <Row
              label="Updated"
              value={new Date(user.updatedAt).toLocaleString()}
            />
            <div className="pt-2">
              <Button
                data-testid="edit-profile-btn"
                variant="outline"
                onClick={() => setEditing(true)}
              >
                Edit Profile
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
