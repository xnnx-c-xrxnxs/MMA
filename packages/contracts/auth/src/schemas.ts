import { z } from 'zod';

// ============================================
// Sign-In Request/Response
// ============================================

export const signInRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const authTokensSchema = z.object({
  accessToken: z.string(),
  idToken: z.string(),
  expiresIn: z.number(),
});

export const signInSuccessSchema = z.object({
  type: z.literal('SUCCESS'),
  tokens: authTokensSchema,
});

export const signInNewPasswordSchema = z.object({
  type: z.literal('NEW_PASSWORD_REQUIRED'),
  session: z.string(),
});

export const signInResponseSchema = z.discriminatedUnion('type', [
  signInSuccessSchema,
  signInNewPasswordSchema,
]);

// ============================================
// New Password Challenge
// ============================================

export const newPasswordRequestSchema = z.object({
  email: z.string().email(),
  newPassword: z.string().min(8),
  session: z.string(),
});

export const newPasswordResponseSchema = authTokensSchema;

// ============================================
// Refresh Session
// ============================================

// No request body — refresh token comes from httpOnly cookie
export const refreshSessionResponseSchema = authTokensSchema;

// ============================================
// Forgot Password
// ============================================

export const forgotPasswordRequestSchema = z.object({
  email: z.string().email(),
});

export const forgotPasswordResponseSchema = z.object({
  message: z.string(),
});

// ============================================
// Confirm Forgot Password
// ============================================

export const confirmForgotPasswordRequestSchema = z.object({
  email: z.string().email(),
  code: z.string().min(1),
  newPassword: z.string().min(8),
});

export const confirmForgotPasswordResponseSchema = z.object({
  message: z.string(),
});

// ============================================
// Change Password (Authenticated)
// ============================================

export const changePasswordRequestSchema = z.object({
  oldPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export const changePasswordResponseSchema = z.object({
  message: z.string(),
});

// ============================================
// Sign Out
// ============================================

export const signOutResponseSchema = z.object({
  message: z.string(),
});

// ============================================
// Me (Current User Info from Token)
// ============================================

export const meResponseSchema = z.object({
  userId: z.string(),
  email: z.string().email(),
  userRole: z.string(),
});

// ============================================
// Inferred Types
// ============================================

export type SignInRequest = z.infer<typeof signInRequestSchema>;
export type SignInResponse = z.infer<typeof signInResponseSchema>;
export type AuthTokens = z.infer<typeof authTokensSchema>;
export type NewPasswordRequest = z.infer<typeof newPasswordRequestSchema>;
export type ForgotPasswordRequest = z.infer<typeof forgotPasswordRequestSchema>;
export type ConfirmForgotPasswordRequest = z.infer<typeof confirmForgotPasswordRequestSchema>;
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;
export type MeResponse = z.infer<typeof meResponseSchema>;
