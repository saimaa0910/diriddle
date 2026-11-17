import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class MaintenanceGuard implements CanActivate {
  private static isMaintenanceActive = false;
  private static maintenanceMessage = 'Platform is currently undergoing scheduled maintenance. Please retry shortly.';
  private static allowedRoles = ['SUPER_ADMIN', 'PLATFORM_ADMIN'];

  constructor(private readonly reflector: Reflector) {}

  static setMaintenance(active: boolean, message?: string) {
    MaintenanceGuard.isMaintenanceActive = active;
    if (message) MaintenanceGuard.maintenanceMessage = message;
  }

  static getStatus() {
    return {
      active: MaintenanceGuard.isMaintenanceActive,
      message: MaintenanceGuard.maintenanceMessage,
    };
  }

  canActivate(context: ExecutionContext): boolean {
    if (!MaintenanceGuard.isMaintenanceActive) {
      return true;
    }

    const req = context.switchToHttp().getRequest();
    const path = req.path || req.url || '';

    // Always allow health checks and admin auth
    if (path.includes('/health') || path.includes('/admin/auth')) {
      return true;
    }

    // Allow platform admins to bypass maintenance
    const userRole = req.user?.role;
    if (userRole && MaintenanceGuard.allowedRoles.includes(userRole)) {
      return true;
    }

    throw new ServiceUnavailableException({
      error: 'SERVICE_MAINTENANCE_MODE',
      message: MaintenanceGuard.maintenanceMessage,
      statusCode: 503,
    });
  }
}
