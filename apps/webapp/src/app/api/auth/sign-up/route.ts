import { NextResponse } from 'next/server';
import { z } from 'zod';

const signUpMockRequestSchema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(8),
});

export async function POST(request: Request) {
    const body = await request.json().catch(() => null);
    const parsed = signUpMockRequestSchema.safeParse(body);

    if (!parsed.success) {
        return NextResponse.json(
            {
                statusCode: 400,
                error: 'BadRequest',
                message: 'Invalid sign-up payload',
                issues: parsed.error.issues,
            },
            { status: 400 },
        );
    }

    const { name, email } = parsed.data;

    return NextResponse.json(
        {
            message: 'Mock sign-up accepted',
            user: {
                userId: `mock-${Date.now()}`,
                name,
                email,
            },
        },
        { status: 201 },
    );
}
