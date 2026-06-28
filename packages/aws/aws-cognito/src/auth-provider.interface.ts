/**
 * IAuthProvider — Authentication provider abstraction.
 *
 * Implemented by CognitoAuthProvider (deployed) and LocalAuthProvider (local dev).
 * The consuming service (auth-api-service) depends only on this interface,
 * never directly on the AWS SDK.
 */

export interface AuthTokens {
  accessToken: string;
  idToken: string;
  refreshToken?: string;
  expiresIn: number;
}

export interface SignInResult {
  type: 'SUCCESS' | 'NEW_PASSWORD_REQUIRED';
  tokens?: AuthTokens;
  session?: string;
}

export interface IAuthProvider {
  /**
   * Authenticate a user with email + password.
   * Returns SUCCESS with tokens, or NEW_PASSWORD_REQUIRED with a session token.
   */
  signIn(email: string, password: string): Promise<SignInResult>;

  /**
   * Complete a NEW_PASSWORD_REQUIRED challenge (first login after admin-created user).
   */
  completeNewPassword(
    email: string,
    newPassword: string,
    session: string,
  ): Promise<AuthTokens>;

  /**
   * Exchange a refresh token for new access + id tokens.
   */
  refreshSession(refreshToken: string): Promise<AuthTokens>;

  /**
   * Initiate forgot-password flow (sends code to email).
   */
  forgotPassword(email: string): Promise<void>;

  /**
   * Confirm forgot-password with the code + new password.
   */
  confirmForgotPassword(
    email: string,
    code: string,
    newPassword: string,
  ): Promise<void>;

  /**
   * Change password for an authenticated user.
   */
  changePassword(
    accessToken: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<void>;

  /**
   * Sign out — revoke refresh tokens.
   */
  signOut(accessToken: string): Promise<void>;
}
