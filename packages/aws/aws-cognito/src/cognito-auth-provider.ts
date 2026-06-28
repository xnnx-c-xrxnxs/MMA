import {
  CognitoIdentityProviderClient,
  AdminInitiateAuthCommand,
  AdminRespondToAuthChallengeCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  ChangePasswordCommand,
  GlobalSignOutCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import type { IAuthProvider, AuthTokens, SignInResult } from './auth-provider.interface';

/**
 * CognitoAuthProvider — Cognito SDK wrapper implementing IAuthProvider.
 *
 * Uses admin-level auth flows (ALLOW_ADMIN_USER_PASSWORD_AUTH) — the app client
 * has no client secret, so AdminInitiateAuth uses only UserPoolId + ClientId.
 *
 * This class is stateless and can be a singleton.
 */
export class CognitoAuthProvider implements IAuthProvider {
  private readonly client: CognitoIdentityProviderClient;

  constructor(
    private readonly userPoolId: string,
    private readonly clientId: string,
    region?: string,
  ) {
    this.client = new CognitoIdentityProviderClient({
      ...(region && { region }),
    });
  }

  async signIn(email: string, password: string): Promise<SignInResult> {
    const response = await this.client.send(
      new AdminInitiateAuthCommand({
        UserPoolId: this.userPoolId,
        ClientId: this.clientId,
        AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password,
        },
      }),
    );

    if (response.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
      return {
        type: 'NEW_PASSWORD_REQUIRED',
        session: response.Session,
      };
    }

    const result = response.AuthenticationResult;
    if (!result) {
      throw new Error('Unexpected empty authentication result from Cognito');
    }

    return {
      type: 'SUCCESS',
      tokens: {
        accessToken: result.AccessToken!,
        idToken: result.IdToken!,
        refreshToken: result.RefreshToken,
        expiresIn: result.ExpiresIn ?? 3600,
      },
    };
  }

  async completeNewPassword(
    email: string,
    newPassword: string,
    session: string,
  ): Promise<AuthTokens> {
    const response = await this.client.send(
      new AdminRespondToAuthChallengeCommand({
        UserPoolId: this.userPoolId,
        ClientId: this.clientId,
        ChallengeName: 'NEW_PASSWORD_REQUIRED',
        ChallengeResponses: {
          USERNAME: email,
          NEW_PASSWORD: newPassword,
        },
        Session: session,
      }),
    );

    const result = response.AuthenticationResult;
    if (!result) {
      throw new Error('Unexpected empty authentication result from Cognito');
    }

    return {
      accessToken: result.AccessToken!,
      idToken: result.IdToken!,
      refreshToken: result.RefreshToken,
      expiresIn: result.ExpiresIn ?? 3600,
    };
  }

  async refreshSession(refreshToken: string): Promise<AuthTokens> {
    const response = await this.client.send(
      new AdminInitiateAuthCommand({
        UserPoolId: this.userPoolId,
        ClientId: this.clientId,
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        AuthParameters: {
          REFRESH_TOKEN: refreshToken,
        },
      }),
    );

    const result = response.AuthenticationResult;
    if (!result) {
      throw new Error('Unexpected empty authentication result from Cognito');
    }

    return {
      accessToken: result.AccessToken!,
      idToken: result.IdToken!,
      // Cognito doesn't return a new refresh token on refresh
      refreshToken: undefined,
      expiresIn: result.ExpiresIn ?? 3600,
    };
  }

  async forgotPassword(email: string): Promise<void> {
    await this.client.send(
      new ForgotPasswordCommand({
        ClientId: this.clientId,
        Username: email,
      }),
    );
  }

  async confirmForgotPassword(
    email: string,
    code: string,
    newPassword: string,
  ): Promise<void> {
    await this.client.send(
      new ConfirmForgotPasswordCommand({
        ClientId: this.clientId,
        Username: email,
        ConfirmationCode: code,
        Password: newPassword,
      }),
    );
  }

  async changePassword(
    accessToken: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<void> {
    await this.client.send(
      new ChangePasswordCommand({
        AccessToken: accessToken,
        PreviousPassword: oldPassword,
        ProposedPassword: newPassword,
      }),
    );
  }

  async signOut(accessToken: string): Promise<void> {
    await this.client.send(
      new GlobalSignOutCommand({
        AccessToken: accessToken,
      }),
    );
  }
}
