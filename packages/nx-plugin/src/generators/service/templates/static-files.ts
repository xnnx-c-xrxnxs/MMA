/**
 * Service generator — files whose contents do NOT depend on the domain.
 * These are byte-for-byte copies that every service ships with.
 */

export const PUBLIC_DECORATOR = `import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
`;

export const CURRENT_USER_DECORATOR = `import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  userRole?: string;
}

export const CurrentUser = createParamDecorator(
  (field: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user) {
      throw new Error(
        'CurrentUser decorator used on a route without an authenticated user. ' +
          'Ensure JwtAuthGuard is wired as APP_GUARD and the route is not @Public().',
      );
    }
    return field ? user[field] : user;
  },
);
`;

export const EXPRESS_DTS = `import type { AuthenticatedUser } from '../decorators/current-user.decorator';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export {};
`;

export const ZOD_PIPE = `import { PipeTransform, BadRequestException } from '@nestjs/common';
import { ZodSchema } from 'zod';

export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException(result.error.issues);
    }
    return result.data;
  }
}
`;

export const JWT_CONFIG = `/**
 * JwtConfig — provider-agnostic JWT verification configuration.
 * Reads generic env vars that work with any OIDC-compliant provider.
 */
export class JwtConfig {
  static readonly jwksUri = process.env.JWT_JWKS_URI ?? '';
  static readonly issuer = process.env.JWT_ISSUER ?? '';
  static readonly userIdClaim = process.env.JWT_USER_ID_CLAIM ?? 'custom:userId';
  static readonly userRoleClaim = process.env.JWT_USER_ROLE_CLAIM ?? 'custom:userRole';

  static validate(): void {
    if (!this.jwksUri) {
      throw new Error('JWT_JWKS_URI must be set in non-local environments');
    }
    if (!this.issuer) {
      throw new Error('JWT_ISSUER must be set in non-local environments');
    }
  }
}
`;

export const JWT_AUTH_GUARD = `import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as jwt from 'jsonwebtoken';
import { JwksClient } from 'jwks-rsa';
import { JwtConfig } from '../../infrastructure/config/jwt.config';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

interface JwtPayload {
  sub: string;
  email: string;
  exp: number;
  iat: number;
  [key: string]: unknown;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly isLocal = process.env.STAGE === 'local';
  private readonly jwksClient: JwksClient | null;

  constructor(private readonly reflector: Reflector) {
    if (!this.isLocal) {
      JwtConfig.validate();
      this.jwksClient = new JwksClient({
        jwksUri: JwtConfig.jwksUri,
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
      });
    } else {
      this.jwksClient = null;
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.slice(7);
    const payload = await this.verifyToken(token);

    const userIdValue = payload[JwtConfig.userIdClaim] as string | undefined;
    request.user = {
      userId: userIdValue || payload.sub,
      email: payload.email,
      userRole: payload[JwtConfig.userRoleClaim] as string | undefined,
    };
    return true;
  }

  private async verifyToken(token: string): Promise<JwtPayload> {
    if (this.isLocal) return this.decodeLocalToken(token);
    return this.verifyWithJwks(token);
  }

  private decodeLocalToken(token: string): JwtPayload {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) throw new UnauthorizedException('Invalid token');
      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64url').toString('utf-8'),
      ) as JwtPayload;
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) {
        throw new UnauthorizedException('Token expired');
      }
      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid token');
    }
  }

  private verifyWithJwks(token: string): Promise<JwtPayload> {
    if (!this.jwksClient) throw new UnauthorizedException('JWKS not initialised');
    const client = this.jwksClient;
    const issuer = JwtConfig.issuer;
    return new Promise((resolve, reject) => {
      const getKey: jwt.GetPublicKeyOrSecret = (header, callback) => {
        if (!header.kid) return callback(new Error('No kid in token header'));
        client.getSigningKey(header.kid, (err, key) => {
          if (err) return callback(err);
          callback(null, key?.getPublicKey());
        });
      };
      jwt.verify(token, getKey, { algorithms: ['RS256'], issuer }, (err, decoded) => {
        if (err) reject(new UnauthorizedException('Invalid or expired token'));
        else resolve(decoded as unknown as JwtPayload);
      });
    });
  }
}
`;

export const DYNAMODB_CONFIG = `import { Table } from 'dynamodb-onetable';
import type { Dynamo } from 'dynamodb-onetable/Dynamo';
import {
  createDynamoLocalClient,
  createAWSClient,
  createTable,
} from '@mma/dynamodb-onetable';

export class DynamoDBConfig {
  private static client: Dynamo;
  private static tables = new Map<string, Table>();

  static getClient(): Dynamo {
    if (!this.client) {
      const isLocal =
        process.env.STAGE === 'local' || !!process.env.DYNAMODB_ENDPOINT;
      this.client = isLocal
        ? createDynamoLocalClient()
        : createAWSClient(process.env.AWS_REGION || 'us-east-1');
    }
    return this.client;
  }

  static getTable(name: string, schema: object): Table {
    if (!this.tables.has(name)) {
      this.tables.set(
        name,
        createTable({ client: this.getClient(), name, schema }),
      );
    }
    const table = this.tables.get(name);
    if (!table) throw new Error(\`Failed to initialise DynamoDB table: \${name}\`);
    return table;
  }
}
`;

export const APP_CONTROLLER = `import { Controller, Get } from '@nestjs/common';
import { Public } from '../presentation/decorators/public.decorator';

@Controller()
export class AppController {
  @Public()
  @Get('health')
  health() {
    return { status: 'ok' };
  }
}
`;

export const APP_CONTROLLER_SPEC = `import { AppController } from './app.controller';

describe('AppController', () => {
  it('returns ok on health', () => {
    expect(new AppController().health()).toEqual({ status: 'ok' });
  });
});
`;

export const ZOD_PIPE_SPEC = `import { ZodValidationPipe } from './zod-validation.pipe';
import { z } from 'zod';
import { BadRequestException } from '@nestjs/common';

describe('ZodValidationPipe', () => {
  it('returns parsed data on success', () => {
    const pipe = new ZodValidationPipe(z.object({ a: z.string() }));
    expect(pipe.transform({ a: 'x' })).toEqual({ a: 'x' });
  });

  it('throws BadRequestException on failure', () => {
    const pipe = new ZodValidationPipe(z.object({ a: z.string() }));
    expect(() => pipe.transform({ a: 1 })).toThrow(BadRequestException);
  });
});
`;
