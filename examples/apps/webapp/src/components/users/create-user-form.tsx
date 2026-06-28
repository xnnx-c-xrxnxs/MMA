'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
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
  Select,
  toast,
} from '@old-st/ui';
import { useCreateUser } from '@old-st/client-common';
import {
  createUserSchema,
  USER_ROLES,
  type CreateUserInput,
} from '@old-st/contracts/user';

export function CreateUserForm({ onClose }: { onClose: () => void }) {
  const createUser = useCreateUser();

  const form = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      email: '',
      firstName: '',
      lastName: '',
      userRole: 'USER',
    },
  });

  const onSubmit = async (values: CreateUserInput) => {
    try {
      await createUser.mutateAsync(values);
      toast.success('User created');
      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to create user';
      toast.error(message);
    }
  };

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>Create User</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            data-testid="create-user-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="grid gap-3 sm:grid-cols-2"
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      autoComplete="email"
                      placeholder="user@example.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="userRole"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <FormControl>
                    <Select {...field}>
                      {USER_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First name</FormLabel>
                  <FormControl>
                    <Input autoComplete="given-name" {...field} />
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
                    <Input autoComplete="family-name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Creating...' : 'Create'}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
