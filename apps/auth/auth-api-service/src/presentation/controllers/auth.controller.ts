import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  Get,
  UsePipes,
  Headers,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiHeader,
  ApiBearerAuth,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import {
  signInRequestSchema,
  newPasswordRequestSchema,
  forgotPasswordRequestSchema,
  confirmForgotPasswordRequestSchema,
  changePasswordRequestSchema,
} from '@old-st/contracts/auth';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';
import { Public } from '../decorators/public.decorator';
import { AuthApplicationService } from '../../application/services/auth-application.service';

const REFRESH_TOKEN_COOKIE = 'refresh_token';
const isLocal = process.env.STAGE === 'local';
const COOKIE_OPTIONS = {
  httpOnly: true,
  // SameSite=None requires Secure=true (enforced by browsers).
  // In non-local environments the API Gateway domain and webapp ALB domain
  // are cross-site, so SameSite=Strict/Lax silently blocks the cookie on
  // every cross-site POST (e.g. /auth/refresh-session), causing auth loss
  // on page refresh. SameSite=None; Secure allows cross-site credentialed
  // requests while keeping the cookie inaccessible to JavaScript.
  // Locally both services share localhost so SameSite=Lax is sufficient and
  // Secure must stay false (HTTP).
  secure: !isLocal,
  sameSite: (isLocal ? 'lax' : 'none') as 'lax' | 'none',
  path: '/',
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
};

// NOTE: Every @Body / @Query / @Param MUST have a matching @ApiBody / @ApiQuery /
// @ApiParam decorator with an explicit
// `schema: { type: 'object' as const, properties: {...}, required: [...] }` block.
// Without this, Swagger UI's "Try it out" panel renders NO input fields — only
// the Execute button — because Zod-inferred types are erased at runtime and
// NestJS reflection sees `@Body() body: SignInInput` as `Object`.
// Enforced by the `swagger-decorators-required` lint check in scripts/lint-standards.ts.
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthApplicationService) {}

  @Public()
  @Post('sign-in')
  @UsePipes(new ZodValidationPipe(signInRequestSchema))
  @ApiOperation({
    summary: 'Sign in with email and password',
    description:
      'Authenticates the user. On success, returns the user DTO + access token and sets the refresh_token httpOnly cookie. If the account requires a new password (force-change flow), returns `{ challengeName: "NEW_PASSWORD_REQUIRED", session }` instead of tokens.',
  })
  @ApiBody({
    description: 'Sign-in credentials',
    schema: {
      type: 'object' as const,
      properties: {
        email: { type: 'string', format: 'email', example: 'admin@test.com' },
        password: { type: 'string', minLength: 8, example: 'Password123!' },
      },
      required: ['email', 'password'],
    },
  })
  @ApiOkResponse({
    description:
      'Authenticated. Returns user DTO + access token (or a NEW_PASSWORD_REQUIRED challenge).',
  })
  @ApiBadRequestResponse({ description: 'Validation error (missing or invalid fields).' })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password.' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
  async signIn(
    @Body() body: { email: string; password: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const { dto, refreshToken } = await this.authService.signIn(
      body.email,
      body.password,
    );

    if (refreshToken) {
      res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, COOKIE_OPTIONS);
    }

    return dto;
  }

  @Public()
  @Post('new-password')
  @UsePipes(new ZodValidationPipe(newPasswordRequestSchema))
  @ApiOperation({
    summary: 'Complete the force-new-password challenge',
    description:
      'Used after a sign-in that returned `NEW_PASSWORD_REQUIRED`. Submit the `session` value from that response together with the new password to finalise authentication.',
  })
  @ApiBody({
    description: 'New password + challenge session',
    schema: {
      type: 'object' as const,
      properties: {
        email: { type: 'string', format: 'email' },
        newPassword: { type: 'string', minLength: 8 },
        session: {
          type: 'string',
          description:
            'Opaque session token returned by sign-in when force-change is required.',
        },
      },
      required: ['email', 'newPassword', 'session'],
    },
  })
  @ApiOkResponse({ description: 'Password updated. Returns user DTO + tokens.' })
  @ApiBadRequestResponse({ description: 'Validation error or invalid session.' })
  @ApiUnauthorizedResponse({ description: 'Session expired or invalid.' })
  async completeNewPassword(
    @Body() body: { email: string; newPassword: string; session: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const { dto, refreshToken } = await this.authService.completeNewPassword(
      body.email,
      body.newPassword,
      body.session,
    );

    if (refreshToken) {
      res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, COOKIE_OPTIONS);
    }

    return dto;
  }

  @Public()
  @Post('refresh-session')
  @ApiOperation({
    summary: 'Refresh the access token using the refresh_token cookie',
    description:
      'Reads the `refresh_token` httpOnly cookie set by sign-in / new-password and returns a fresh access token + user DTO. Also rotates the refresh_token cookie. No request body — the browser sends the cookie automatically when `credentials: "include"` is set.',
  })
  @ApiOkResponse({ description: 'New access token issued. Refresh cookie rotated.' })
  @ApiUnauthorizedResponse({
    description: 'No refresh_token cookie or refresh token expired.',
  })
  async refreshSession(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
    if (!refreshToken) {
      res.status(401).json({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'No refresh token provided',
      });
      return;
    }

    const { dto, refreshToken: newRefreshToken } =
      await this.authService.refreshSession(refreshToken);

    if (newRefreshToken) {
      res.cookie(REFRESH_TOKEN_COOKIE, newRefreshToken, COOKIE_OPTIONS);
    }

    return dto;
  }

  @Public()
  @Post('forgot-password')
  @UsePipes(new ZodValidationPipe(forgotPasswordRequestSchema))
  @ApiOperation({
    summary: 'Send a password-reset code to the account email',
    description:
      'Always returns 200 regardless of whether the email exists (to avoid account enumeration). The user receives an email with a one-time code that is used by /confirm-forgot-password.',
  })
  @ApiBody({
    description: 'Email of the account to reset',
    schema: {
      type: 'object' as const,
      properties: {
        email: { type: 'string', format: 'email' },
      },
      required: ['email'],
    },
  })
  @ApiOkResponse({
    description: 'Reset email dispatched (or silently ignored if the email is unknown).',
  })
  @ApiBadRequestResponse({ description: 'Validation error (invalid email format).' })
  async forgotPassword(@Body() body: { email: string }) {
    return this.authService.forgotPassword(body.email);
  }

  @Public()
  @Post('confirm-forgot-password')
  @UsePipes(new ZodValidationPipe(confirmForgotPasswordRequestSchema))
  @ApiOperation({
    summary: 'Confirm the password-reset code and set a new password',
  })
  @ApiBody({
    description: 'Reset code + new password',
    schema: {
      type: 'object' as const,
      properties: {
        email: { type: 'string', format: 'email' },
        code: { type: 'string', description: 'One-time code from the reset email.' },
        newPassword: { type: 'string', minLength: 8 },
      },
      required: ['email', 'code', 'newPassword'],
    },
  })
  @ApiOkResponse({
    description: 'Password updated. User can now sign in with the new password.',
  })
  @ApiBadRequestResponse({ description: 'Invalid code or password does not meet policy.' })
  async confirmForgotPassword(
    @Body() body: { email: string; code: string; newPassword: string },
  ) {
    return this.authService.confirmForgotPassword(
      body.email,
      body.code,
      body.newPassword,
    );
  }

  @Post('change-password')
  @UsePipes(new ZodValidationPipe(changePasswordRequestSchema))
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Change the current user’s password',
    description: 'Requires a valid access token in the Authorization header.',
  })
  @ApiHeader({
    name: 'authorization',
    required: true,
    description: 'Bearer access token, e.g. `Bearer eyJraWQ...`.',
  })
  @ApiBody({
    description: 'Current and new password',
    schema: {
      type: 'object' as const,
      properties: {
        oldPassword: { type: 'string', minLength: 8 },
        newPassword: { type: 'string', minLength: 8 },
      },
      required: ['oldPassword', 'newPassword'],
    },
  })
  @ApiOkResponse({ description: 'Password changed.' })
  @ApiBadRequestResponse({ description: 'Validation error or old password incorrect.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  async changePassword(
    @Headers('authorization') authHeader: string,
    @Body() body: { oldPassword: string; newPassword: string },
  ) {
    const accessToken = authHeader?.replace('Bearer ', '');
    if (!accessToken) {
      return {
        statusCode: 401,
        error: 'Unauthorized',
        message: 'No access token',
      };
    }
    return this.authService.changePassword(
      accessToken,
      body.oldPassword,
      body.newPassword,
    );
  }

  @Post('sign-out')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Sign out the current user',
    description:
      'Revokes the access token at the auth provider and clears the refresh_token httpOnly cookie.',
  })
  @ApiHeader({
    name: 'authorization',
    required: true,
    description: 'Bearer access token to revoke.',
  })
  @ApiOkResponse({ description: 'Signed out. Refresh cookie cleared.' })
  @ApiUnauthorizedResponse({ description: 'Missing access token.' })
  async signOut(
    @Headers('authorization') authHeader: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const accessToken = authHeader?.replace('Bearer ', '');
    if (!accessToken) {
      return {
        statusCode: 401,
        error: 'Unauthorized',
        message: 'No access token',
      };
    }
    res.clearCookie(REFRESH_TOKEN_COOKIE, COOKIE_OPTIONS);
    return this.authService.signOut(accessToken);
  }

  @Get('me')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Return the currently authenticated user',
    description:
      'Reads the user identity attached to the request by `JwtAuthGuard`. Returns 401 if no valid access token was supplied.',
  })
  @ApiOkResponse({
    description: 'Current user identity.',
    schema: {
      type: 'object' as const,
      properties: {
        userId: { type: 'string' },
        email: { type: 'string', format: 'email' },
        userRole: { type: 'string' },
      },
      required: ['userId', 'email'],
    },
  })
  @ApiUnauthorizedResponse({ description: 'Not authenticated.' })
  async me(@Req() req: Request) {
    // In a full implementation, the JWT auth guard would decode the token
    // and attach user info to req.user. For now, decode from Authorization header.
    const user = (req as any).user;
    if (!user) {
      return {
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Not authenticated',
      };
    }
    return {
      userId: user.userId,
      email: user.email,
      userRole: user.userRole,
    };
  }
}
