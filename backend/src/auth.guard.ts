/**
 * Optional Bearer token auth guard.
 *
 * When the PATENTFORGE_TOKEN environment variable is set, all API requests
 * must include `Authorization: Bearer <token>` with a matching value.
 *
 * When PATENTFORGE_TOKEN is not set, auth is disabled and all requests pass.
 * This preserves backward compatibility for single-user local deployments.
 */

import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly token: string | undefined;

  constructor() {
    this.token = process.env.PATENTFORGE_TOKEN;
    if (this.token) {
      console.log('[Auth] Token-based authentication enabled (PATENTFORGE_TOKEN is set)');
    }
  }

  canActivate(context: ExecutionContext): boolean {
    // No token configured — auth disabled
    if (!this.token) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('Authentication required. Set Authorization: Bearer <token> header.');
    }

    const [scheme, value] = authHeader.split(' ');
    if (scheme !== 'Bearer' || value !== this.token) {
      throw new UnauthorizedException('Invalid authentication token.');
    }

    return true;
  }
}
