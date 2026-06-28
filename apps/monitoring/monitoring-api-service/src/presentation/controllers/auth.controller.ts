import { Controller, Get, Query, Redirect, Res, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { AuthService } from '../../application/services/auth.service';
import { Public } from '../guards/jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Step 1 — redirect browser to GitHub OAuth
  @Public()
  @Get('github')
  @Redirect()
  @ApiOperation({
    summary: 'Begin the GitHub OAuth sign-in flow',
    description: 'Redirects the browser to GitHub with the OAuth state token. Not callable from Swagger UI directly.',
  })
  initiateOAuth() {
    const state = this.authService.generateStateToken();
    const url = this.authService.getOAuthRedirectUrl(state);
    return { url, statusCode: 302 };
  }

  // Step 2 — GitHub redirects back with authorization code
  @Public()
  @Get('github/callback')
  @ApiOperation({
    summary: 'OAuth callback — exchange code for token and redirect to webapp',
  })
  @ApiQuery({
    name: 'code',
    required: true,
    description: 'Authorization code returned by GitHub.',
  })
  @ApiQuery({
    name: 'state',
    required: true,
    description: 'CSRF state token originally issued by /auth/github.',
  })
  async oauthCallback(
    @Query('code') code: string,
    @Query('state') _state: string,
    @Res() res: Response,
  ) {
    if (!code) throw new UnauthorizedException('Missing authorization code');

    const token = await this.authService.exchangeCodeForToken(code);
    const webappUrl = process.env.MONITORING_WEBAPP_URL ?? 'http://localhost:4300';

    // Redirect to webapp with JWT as query param — webapp stores it in memory
    res.redirect(302, `${webappUrl}/auth/callback?token=${token}`);
  }
}
