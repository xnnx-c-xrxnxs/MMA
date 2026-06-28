'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@old-st/client-common';
import { newPasswordRequestSchema } from '@old-st/contracts/auth';
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
} from '@old-st/ui';

// UI-only schema: extends the contract with a confirm-password field and a
// cross-field refinement. The core `newPassword` rule still comes from
// `@old-st/contracts/auth` (Golden Rule #23a).
const newPasswordFormSchema = newPasswordRequestSchema
  .pick({ newPassword: true })
  .extend({
    confirmPassword: z.string().min(8),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

type NewPasswordFormValues = z.infer<typeof newPasswordFormSchema>;

function NewPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { completeNewPassword } = useAuth();

  const email = searchParams.get('email') || '';
  const session = searchParams.get('session') || '';

  const form = useForm<NewPasswordFormValues>({
    resolver: zodResolver(newPasswordFormSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  if (!email || !session) {
    router.replace('/auth/login');
    return null;
  }

  const onSubmit = async (values: NewPasswordFormValues) => {
    try {
      await completeNewPassword(email, values.newPassword, session);
      router.replace('/');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to set new password';
      toast.error(message);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-2xl">Set new password</CardTitle>
        <CardDescription>Your account requires a new password</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                      placeholder="Minimum 8 characters"
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
                  <FormLabel>Confirm Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      placeholder="Repeat your new password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting
                ? 'Setting password...'
                : 'Set Password'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

export default function NewPasswordPage() {
  return (
    <Suspense>
      <NewPasswordForm />
    </Suspense>
  );
}

