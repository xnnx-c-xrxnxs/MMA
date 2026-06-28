'use client';

import { useAuth } from '@old-st/client-common';
import { signInRequestSchema, type SignInRequest } from '@old-st/contracts/auth';
import {
  Button,
  StructuredForm,
  toast,
  type FormStructure
} from '@old-st/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const loginFormStructure: FormStructure<SignInRequest> = [
  {
    title: 'Sign in',
    description: 'Use your account credentials to continue.',
    rows: [
      {
        fields: [
          {
            kind: 'email',
            name: 'email',
            label: 'Email Address',
            placeholder: 'jane@email.com',
          },
        ],
      },
      {
        fields: [
          {
            kind: 'password',
            name: 'password',
            label: 'Password',
            placeholder: '••••••••',
          },
        ],
      },
    ],
  },
];

export function LoginForm() {
  const router = useRouter();
  const { signIn, isAuthenticated } = useAuth();
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, router]);

  if (isAuthenticated) {
    return null;
  }

  const onSubmit = async (values: SignInRequest) => {
    setAuthError(null);
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
      setAuthError(message);
      toast.error(message);
    }
  };

  return (
    <StructuredForm<SignInRequest>
      schema={signInRequestSchema}
      defaultValues={{ email: '', password: '' }}
      structure={loginFormStructure}
      onSubmit={onSubmit}
      className="space-y-4"
      footer={(form) => (
        <>
          {authError && (
            <p className="text-sm text-destructive" data-testid="sign-in-error">
              {authError}
            </p>
          )}
          <Button
            type="submit"
            className="w-full"
            disabled={form.formState.isSubmitting}
            data-testid="sign-in-btn"
          >
            {form.formState.isSubmitting ? 'Logging in...' : 'Log in'}
          </Button>
          <div className="text-center">
            <Link
              href="/auth/forgot-password"
              className="text-sm text-muted-foreground hover:underline"
              data-testid="forgot-password-link"
            >
              Forgot password?
            </Link>
          </div>
          <div className="text-center">
            <Link
              href="/auth/sign-up"
              className="text-sm text-muted-foreground hover:underline"
              data-testid="sign-up-link"
            >
              Don&apos;t have an account? Sign up
            </Link>
          </div>
        </>
      )}
    />
  );
}
