import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'crypto';
import { createLogger } from '@old-st/telemetry';

interface GitHubTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
}

interface GitHubUser {
  login: string;
  name: string;
  email: string;
  avatar_url: string;
}

interface GitHubOrgMembership {
  state: string;
  role: string;
}

const logger = createLogger('monitoring-api-service');

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  getOAuthRedirectUrl(state: string): string {
    const clientId = process.env.GITHUB_CLIENT_ID;
    if (!clientId) throw new Error('GITHUB_CLIENT_ID is not configured');

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: this.buildCallbackUrl(),
      scope: 'read:org',
      state,
    });

    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string): Promise<string> {
    logger.info('Exchanging GitHub OAuth code for monitoring access');
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    const requiredOrg = process.env.GITHUB_REQUIRED_ORG;

    if (!clientId || !clientSecret) throw new Error('GitHub OAuth credentials not configured');
    if (!requiredOrg) throw new Error('GITHUB_REQUIRED_ORG is not configured');

    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
    });

    if (!tokenResponse.ok) {
      throw new UnauthorizedException('Failed to exchange code for GitHub token');
    }

    const tokenData = (await tokenResponse.json()) as GitHubTokenResponse;
    if (!tokenData.access_token) {
      throw new UnauthorizedException('Invalid GitHub OAuth response');
    }

    // Fetch the authenticated user
    const userResponse = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userResponse.ok) {
      throw new UnauthorizedException('Failed to fetch GitHub user');
    }

    const user = (await userResponse.json()) as GitHubUser;

    // Verify org membership — only members of the required org can access monitoring
    const membershipResponse = await fetch(
      `https://api.github.com/user/memberships/orgs/${requiredOrg}`,
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } },
    );

    if (!membershipResponse.ok) {
      logger.warn('GitHub org membership check failed', {
        login: user.login,
        org: requiredOrg,
        status: membershipResponse.status,
      });
      throw new UnauthorizedException(`You must be a member of ${requiredOrg} to access monitoring`);
    }

    const membership = (await membershipResponse.json()) as GitHubOrgMembership;
    if (membership.state !== 'active') {
      throw new UnauthorizedException(`Your membership in ${requiredOrg} is not active`);
    }

    logger.info('Monitoring access granted', { login: user.login, org: requiredOrg });

    // Issue a short-lived monitoring JWT (1 hour)
    return this.jwtService.sign({
      sub: user.login,
      name: user.name ?? user.login,
      avatarUrl: user.avatar_url,
      org: requiredOrg,
    });
  }

  generateStateToken(): string {
    // CSRF protection — opaque random state for OAuth redirect
    return createHash('sha256')
      .update(crypto.randomUUID())
      .digest('hex')
      .slice(0, 32);
  }

  private buildCallbackUrl(): string {
    const apiBase = process.env.MONITORING_API_BASE_URL ?? 'http://localhost:8080';
    return `${apiBase}/api/auth/github/callback`;
  }
}
