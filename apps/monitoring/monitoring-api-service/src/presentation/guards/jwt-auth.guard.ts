import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractBearerToken(request);

    if (!token) throw new UnauthorizedException('Missing authentication token');

    try {
      const secret = process.env.MONITORING_JWT_SECRET;
      if (!secret) throw new Error('MONITORING_JWT_SECRET is not configured');

      const payload = this.jwtService.verify(token, { secret });
      (request as Request & { user: unknown }).user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired monitoring token');
    }
  }

  private extractBearerToken(request: Request): string | null {
    const auth = request.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return null;
    return auth.slice(7);
  }
}
