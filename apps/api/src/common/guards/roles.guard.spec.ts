import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  function createMockContext(user?: any): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  }

  it('allows access if no required roles are defined', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(null);
    const context = createMockContext({ id: 'u1' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('throws FORBIDDEN_ADMIN_ROLE when user has no adminRole', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['MODERATOR']);
    const context = createMockContext({ id: 'u1' });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    try {
      guard.canActivate(context);
    } catch (err: any) {
      expect(err.getResponse()).toEqual({
        error: 'FORBIDDEN_ADMIN_ROLE',
        message: 'Insufficient administrative privileges',
      });
    }
  });

  it('returns true when user has active admin role with future expiresAt', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['MODERATOR']);
    const futureDate = new Date(Date.now() + 1000 * 60 * 60);
    const context = createMockContext({
      id: 'u1',
      adminRole: {
        role: 'MODERATOR',
        expiresAt: futureDate,
      },
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('returns true when user has active admin role with null expiresAt (no expiry)', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['MODERATOR']);
    const context = createMockContext({
      id: 'u1',
      adminRole: {
        role: 'MODERATOR',
        expiresAt: null,
      },
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('throws ADMIN_ROLE_EXPIRED when admin role has expired in the past', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['MODERATOR']);
    const pastDate = new Date(Date.now() - 1000 * 60);
    const context = createMockContext({
      id: 'u1',
      adminRole: {
        role: 'MODERATOR',
        expiresAt: pastDate,
      },
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    try {
      guard.canActivate(context);
    } catch (err: any) {
      expect(err.getResponse()).toEqual({
        error: 'ADMIN_ROLE_EXPIRED',
        message: 'Your administrative role has expired',
      });
    }
  });

  it('allows SUPER_ADMIN even if expired date is in the past', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['MODERATOR']);
    const pastDate = new Date(Date.now() - 1000 * 60);
    const context = createMockContext({
      id: 'u1',
      adminRole: {
        role: 'SUPER_ADMIN',
        expiresAt: pastDate,
      },
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('throws FORBIDDEN_ADMIN_ROLE when user role is not in requiredRoles', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['SUPER_ADMIN', 'TRUST_SAFETY_LEAD']);
    const context = createMockContext({
      id: 'u1',
      adminRole: {
        role: 'MODERATOR',
        expiresAt: null,
      },
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    try {
      guard.canActivate(context);
    } catch (err: any) {
      expect(err.getResponse()).toEqual({
        error: 'FORBIDDEN_ADMIN_ROLE',
        message: 'Insufficient administrative privileges',
      });
    }
  });
});
