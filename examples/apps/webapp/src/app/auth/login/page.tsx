'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@old-st/client-common';
import {
  signInRequestSchema,
  type SignInRequest,
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

export default function LoginPage() {
  const router = useRouter();
  const { signIn, isAuthenticated } = useAuth();

  const form = useForm<SignInRequest>({
    resolver: zodResolver(signInRequestSchema),
    defaultValues: { email: '', password: '' },
  });

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, router]);

  if (isAuthenticated) {
    return null;
  }

  const onSubmit = async (values: SignInRequest) => {
    try {
      const result = await signIn(values.email, values.password);
      if (result.type === 'NEW_PASSWORD_REQUIRED') {
        const session = result.session;
        router.push(
          `/auth/new-password?email=${encodeURIComponent(values.email)}&session=${encodeURIComponent(session)}`,
        );
      } else {
        router.replace('/');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sign in failed';
      toast.error(message);
    }
  };

  return (
    <Card className="w-full" data-testid="sign-in-form">
      <CardHeader>
        <CardTitle className="text-2xl">Sign in</CardTitle>
        <CardDescription>
          Enter your credentials to access the dashboard
        </CardDescription>
      </CardHeader>
      <CardContent>
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
                      placeholder="admin@test.com"
                      data-testid="email-input"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="current-password"
                      placeholder="••••••••"
                      data-testid="password-input"
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
              data-testid="sign-in-btn"
            >
              {form.formState.isSubmitting ? 'Signing in...' : 'Sign In'}
            </Button>
            <div className="text-center">
              <a
                href="/auth/forgot-password"
                className="text-sm text-muted-foreground hover:underline"
                data-testid="forgot-password-link"
              >
                Forgot password?
              </a>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

