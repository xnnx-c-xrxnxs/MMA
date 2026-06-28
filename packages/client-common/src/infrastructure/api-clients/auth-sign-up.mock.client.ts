import { z } from 'zod';
import { getApiConfig } from '../config';
import { apiRequest } from './base-api.client';

// TEMPORARY: remove this mock client when backend /auth/sign-up is available.
const signUpMockRequestSchema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(8),
});

const signUpMockResponseSchema = z.object({
    message: z.string(),
    user: z.object({
        userId: z.string(),
        name: z.string(),
        email: z.string().email(),
    }),
});

export type SignUpMockInput = z.infer<typeof signUpMockRequestSchema>;
export type SignUpMockResponse = z.infer<typeof signUpMockResponseSchema>;

const signUpMockBaseUrl = () => getApiConfig().mockApiUrl;

export const authSignUpMockApiClient = {
    signUp(input: SignUpMockInput): Promise<SignUpMockResponse> {
        return apiRequest(signUpMockBaseUrl(), '/api/auth/sign-up', {
            method: 'POST',
            body: signUpMockRequestSchema.parse(input),
            schema: signUpMockResponseSchema,
        });
    },
};
