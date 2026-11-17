import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, AdminRoleName } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic === true) {
      return true;
    }

    const requiredRoles = this.reflector.getAllAndOverride<AdminRoleName[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user || !user.adminRole) {
      throw new ForbiddenException({
        error: 'FORBIDDEN_ADMIN_ROLE',
        message: 'Insufficient administrative privileges',
      });
    }

    const userRole = user.adminRole.role as AdminRoleName;
    if (userRole === 'SUPER_ADMIN') {
      return true;
    }

    // Check expiry
    if (user.adminRole.expiresAt && new Date(user.adminRole.expiresAt) <= new Date()) {
      throw new ForbiddenException({
        error: 'ADMIN_ROLE_EXPIRED',
        message: 'Your administrative role has expired',
      });
    }

    if (!requiredRoles.includes(userRole)) {
      throw new ForbiddenException({
        error: 'FORBIDDEN_ADMIN_ROLE',
        message: 'Insufficient administrative privileges',
      });
    }
    return true;
  }
}

