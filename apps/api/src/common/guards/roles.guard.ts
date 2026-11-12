import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, AdminRoleName } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
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

    if (!requiredRoles.includes(userRole)) {
      throw new ForbiddenException({
        error: 'FORBIDDEN_ADMIN_ROLE',
        message: 'Insufficient administrative privileges',
      });
    }
    return true;
  }
}
