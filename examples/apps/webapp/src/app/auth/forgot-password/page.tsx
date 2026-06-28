'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  useForgotPassword,
  useConfirmForgotPassword,
} from '@old-st/client-common';
import {
  forgotPasswordRequestSchema,
  confirmForgotPasswordRequestSchema,
  type ForgotPasswordRequest,
  type ConfirmForgotPasswordRequest,
} from '@old-st/contracts/auth';
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

function RequestCodeStep({ onSent }: { onSent: (email: string) => void }) {
  const forgotPassword = useForgotPassword();
  const form = useForm<ForgotPasswordRequest>({
    resolver: zodResolver(forgotPasswordRequestSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (values: ForgotPasswordRequest) => {
    try {
      await forgotPassword.mutateAsync(values);
      onSent(values.email);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to send reset code';
      toast.error(message);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                  placeholder="your@email.com"
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
          disabled={forgotPassword.isPending}
          data-testid="forgot-password-submit"
        >
          {forgotPassword.isPending ? 'Sending...' : 'Send Reset Code'}
        </Button>
        <div className="text-center">
          <a
            href="/auth/login"
            className="text-sm text-muted-foreground hover:underline"
          >
            Back to Sign In
          </a>
        </div>
      </form>
    </Form>
  );
}

function ConfirmCodeStep({
  email,
  onSuccess,
}: {
  email: string;
  onSuccess: () => void;
}) {
  const confirmForgotPassword = useConfirmForgotPassword();
  const form = useForm<ConfirmForgotPasswordRequest>({
    resolver: zodResolver(confirmForgotPasswordRequestSchema),
    defaultValues: { email, code: '', newPassword: '' },
  });

  const onSubmit = async (values: ConfirmForgotPasswordRequest) => {
    try {
      await confirmForgotPassword.mutateAsync(values);
      onSuccess();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to reset password';
      toast.error(message);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Reset Code</FormLabel>
              <FormControl>
                <Input
                  type="text"
                  autoComplete="one-time-code"
                  placeholder="Enter the code"
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
                  placeholder="Minimum 8 characters"
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
          disabled={confirmForgotPassword.isPending}
        >
          {confirmForgotPassword.isPending ? 'Resetting...' : 'Reset Password'}
        </Button>
      </form>
    </Form>
  );
}

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<'request' | 'confirm' | 'success'>(
    'request',
  );
  const [email, setEmail] = useState('');

  return (
    <Card className="w-full" data-testid="forgot-password-form">
      <CardHeader>
        <CardTitle className="text-2xl">
          {step === 'success'
            ? 'Password reset'
            : step === 'request'
              ? 'Forgot Password'
              : 'Reset Password'}
        </CardTitle>
        <CardDescription>
          {step === 'success'
            ? 'You can now sign in with your new password.'
            : step === 'request'
              ? 'Enter your email to receive a reset code'
              : 'Enter the code sent to your email'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {step === 'success' ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-success-text">
              Password reset successfully.
            </p>
            <a
              href="/auth/login"
              className="text-sm text-primary hover:underline"
            >
              Back to Sign In
            </a>
          </div>
        ) : step === 'request' ? (
          <RequestCodeStep
            onSent={(e) => {
              setEmail(e);
              setStep('confirm');
            }}
          />
        ) : (
          <ConfirmCodeStep email={email} onSuccess={() => setStep('success')} />
        )}
      </CardContent>
    </Card>
  );
}
