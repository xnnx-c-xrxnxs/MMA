import type { IAuthProvider } from '@mma/aws-cognito';
import { createLogger } from '@mma/telemetry';
import {
  signInResponseSchema,
  authTokensSchema,
  forgotPasswordResponseSchema,
  confirmForgotPasswordResponseSchema,
  changePasswordResponseSchema,
  signOutResponseSchema,
  type SignInResponse,
  type AuthTokens,
} from '@mma/contracts/auth';

const logger = createLogger('auth-api-service');

export class AuthApplicationService {
  constructor(private readonly authProvider: IAuthProvider) {}

  async signIn(
    email: string,
    password: string,
  ): Promise<{ dto: SignInResponse; refreshToken?: string }> {
    logger.info('Sign-in attempt', { email });
    const result = await this.authProvider.signIn(email, password);

    if (result.type === 'NEW_PASSWORD_REQUIRED') {
      logger.info('Sign-in requires new password', { email });
      const dto = signInResponseSchema.parse({
        type: 'NEW_PASSWORD_REQUIRED',
        session: result.session,
      });
      return { dto };
    }

    logger.info('Sign-in successful', { email });
    const dto = signInResponseSchema.parse({
      type: 'SUCCESS',
      tokens: {
        accessToken: result.tokens!.accessToken,
        idToken: result.tokens!.idToken,
        expiresIn: result.tokens!.expiresIn,
      },
    });
    return { dto, refreshToken: result.tokens?.refreshToken };
  }

  async completeNewPassword(
    email: string,
    newPassword: string,
    session: string,
  ): Promise<{ dto: AuthTokens; refreshToken?: string }> {
    logger.info('Completing new password challenge', { email });
    const tokens = await this.authProvider.completeNewPassword(
      email,
      newPassword,
      session,
    );
    logger.info('New password challenge completed', { email });
    const dto = authTokensSchema.parse({
      accessToken: tokens.accessToken,
      idToken: tokens.idToken,
      expiresIn: tokens.expiresIn,
    });
    return { dto, refreshToken: tokens.refreshToken };
  }

  async refreshSession(
    refreshToken: string,
  ): Promise<{ dto: AuthTokens; refreshToken?: string }> {
    logger.info('Refreshing session');
    const tokens = await this.authProvider.refreshSession(refreshToken);
    logger.info('Session refreshed');
    const dto = authTokensSchema.parse({
      accessToken: tokens.accessToken,
      idToken: tokens.idToken,
      expiresIn: tokens.expiresIn,
    });
    return { dto, refreshToken: tokens.refreshToken };
  }

  async forgotPassword(email: string) {
    logger.info('Forgot password request', { email });
    await this.authProvider.forgotPassword(email);
    logger.info('Password reset code sent', { email });
    return forgotPasswordResponseSchema.parse({
      message: 'Password reset code sent to email',
    });
  }

  async confirmForgotPassword(
    email: string,
    code: string,
    newPassword: string,
  ) {
    logger.info('Confirming forgot password', { email });
    await this.authProvider.confirmForgotPassword(email, code, newPassword);
    logger.info('Password reset confirmed', { email });
    return confirmForgotPasswordResponseSchema.parse({
      message: 'Password reset successfully',
    });
  }

  async changePassword(
    accessToken: string,
    oldPassword: string,
    newPassword: string,
  ) {
    logger.info('Changing password');
    await this.authProvider.changePassword(accessToken, oldPassword, newPassword);
    logger.info('Password changed');
    return changePasswordResponseSchema.parse({
      message: 'Password changed successfully',
    });
  }

  async signOut(accessToken: string) {
    logger.info('Signing out');
    await this.authProvider.signOut(accessToken);
    logger.info('Signed out');
    return signOutResponseSchema.parse({
      message: 'Signed out successfully',
    });
  }
}
