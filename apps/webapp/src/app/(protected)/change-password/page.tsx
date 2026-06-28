'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useChangePassword } from '@mma/client-common';
import { changePasswordRequestSchema } from '@mma/contracts/auth';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
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
} from '@mma/ui';

// UI-only schema: extends the contract with `confirmPassword` + cross-field
// match check. Core rules (oldPassword + newPassword) come from the contract.
const changePasswordFormSchema = changePasswordRequestSchema
  .extend({ confirmPassword: z.string().min(8) })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'New passwords do not match',
  });

type ChangePasswordFormValues = z.infer<typeof changePasswordFormSchema>;

export default function ChangePasswordPage() {
  const router = useRouter();
  const changePassword = useChangePassword();

  const form = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordFormSchema),
    defaultValues: { oldPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = async (values: ChangePasswordFormValues) => {
    try {
      await changePassword.mutateAsync({
        oldPassword: values.oldPassword,
        newPassword: values.newPassword,
      });
      toast.success('Password changed successfully');
      form.reset();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to change password';
      toast.error(message);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)] bg-background">
      <Card className="w-full max-w-md" data-testid="change-password-form">
        <CardHeader>
          <CardTitle className="text-2xl">Change Password</CardTitle>
          <CardDescription>Update your account password</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="oldPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="current-password"
                        placeholder="••••••••"
                        data-testid="old-password-input"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="new-password"
                        placeholder="••••••••"
                        data-testid="new-password-input"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm New Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="new-password"
                        placeholder="••••••••"
                        data-testid="confirm-password-input"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => router.back()}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={form.formState.isSubmitting}
                  data-testid="change-password-btn"
                >
                  {form.formState.isSubmitting
                    ? 'Saving...'
                    : 'Change Password'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
