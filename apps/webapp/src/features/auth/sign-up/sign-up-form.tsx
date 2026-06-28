'use client';

import { useAuth, useSignUp } from '@old-st/client-common';
import { Button, StructuredForm, toast, type FormStructure } from '@old-st/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { z } from 'zod';

const signUpSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Valid email is required'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
});

type SignUpInput = z.infer<typeof signUpSchema>;

const signUpFormStructure: FormStructure<SignUpInput> = [
    {
        title: 'Sign up',
        description: 'Create your account to continue.',
        rows: [
            {
                fields: [
                    {
                        kind: 'text',
                        name: 'name',
                        label: 'Full Name',
                        placeholder: 'Jane Doe',
                    },
                ],
            },
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
                        placeholder: 'Minimum 8 characters',
                    },
                ],
            },
        ],
    },
];

export function SignUpForm() {
    const router = useRouter();
    const { isAuthenticated } = useAuth();
    const signUp = useSignUp({
        onSuccess: () => {
            toast.success('Account created. Please sign in.');
            router.replace('/auth/login');
        },
        onError: (error) => {
            const message = error instanceof Error ? error.message : 'Sign up failed';
            toast.error(message);
        },
    });

    useEffect(() => {
        if (isAuthenticated) {
            router.replace('/');
        }
    }, [isAuthenticated, router]);

    if (isAuthenticated) {
        return null;
    }

    const onSubmit = async (values: SignUpInput) => {
        signUp.mutateAsync(values);
    };

    return (
        <StructuredForm<SignUpInput>
            schema={signUpSchema}
            defaultValues={{ name: '', email: '', password: '' }}
            structure={signUpFormStructure}
            onSubmit={onSubmit}
            className="space-y-4"
            footer={(form) => (
                <>
                    {signUp.isError && (
                        <p className="text-sm text-destructive" data-testid="sign-up-error">
                            {signUp.error instanceof Error ? signUp.error.message : 'Sign up failed'}
                        </p>
                    )}
                    <Button
                        type="submit"
                        className="w-full"
                        disabled={signUp.isPending}
                        data-testid="sign-up-btn"
                    >
                        {signUp.isPending ? 'Creating account...' : 'Create account'}
                    </Button>
                    <div className="text-center">
                        <Link
                            href="/auth/login"
                            className="text-sm text-muted-foreground hover:underline"
                            data-testid="back-to-sign-in-link"
                        >
                            Already have an account? Sign in
                        </Link>
                    </div>
                </>
            )}
        />
    );
}
