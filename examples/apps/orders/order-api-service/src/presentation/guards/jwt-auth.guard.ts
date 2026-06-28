import {
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
    if (isPublic) {
      return true;
    }

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
    if (this.isLocal) {
      return this.decodeLocalToken(token);
    }
    return this.verifyWithJwks(token);
  }

  /**
   * Local development only: decode without signature verification.
   * LocalAuthProvider issues unsigned mock JWTs with { alg: 'none' }.
   */
  private decodeLocalToken(token: string): JwtPayload {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new UnauthorizedException('Invalid token');
      }
      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64url').toString('utf-8'),
      ) as JwtPayload;
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) {
        throw new UnauthorizedException('Token expired');
      }
      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid token');
    }
  }

  /**
   * Deployed: verify RS256 signature against the configured JWKS endpoint.
   * Works with any OIDC-compliant provider — set JWT_JWKS_URI and JWT_ISSUER
   * to the appropriate values for your identity provider.
   */
  private verifyWithJwks(token: string): Promise<JwtPayload> {
    if (!this.jwksClient) {
      throw new UnauthorizedException('JWKS not initialised');
    }
    const client = this.jwksClient;
    const issuer = JwtConfig.issuer;
    return new Promise((resolve, reject) => {
      const getKey: jwt.GetPublicKeyOrSecret = (header, callback) => {
        if (!header.kid) {
          return callback(new Error('No kid in token header'));
        }
        client.getSigningKey(header.kid, (err, key) => {
          if (err) return callback(err);
          callback(null, key?.getPublicKey());
        });
      };
      jwt.verify(token, getKey, { algorithms: ['RS256'], issuer }, (err, decoded) => {
        if (err) {
          reject(new UnauthorizedException('Invalid or expired token'));
        } else {
          resolve(decoded as unknown as JwtPayload);
        }
      });
    });
  }
}
