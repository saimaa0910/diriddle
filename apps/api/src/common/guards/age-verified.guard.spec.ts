import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AgeVerifiedGuard } from './age-verified.guard';

describe('AgeVerifiedGuard', () => {
  let guard: AgeVerifiedGuard;

  beforeEach(() => {
    guard = new AgeVerifiedGuard();
  });

  function createMockContext(user?: any): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  }

  it('allows access when user is ageVerified', () => {
    const context = createMockContext({ id: 'u1', ageVerified: true });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('throws AGE_VERIFICATION_REQUIRED when user is missing', () => {
    const context = createMockContext(undefined);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    try {
      guard.canActivate(context);
    } catch (err: any) {
      expect(err.getResponse()).toEqual({
        error: 'AGE_VERIFICATION_REQUIRED',
        message: 'You must complete age verification (18+) before posting or reacting',
      });
    }
  });

  it('throws AGE_VERIFICATION_REQUIRED when user.ageVerified is false', () => {
    const context = createMockContext({ id: 'u1', ageVerified: false });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    try {
      guard.canActivate(context);
    } catch (err: any) {
      expect(err.getResponse()).toEqual({
        error: 'AGE_VERIFICATION_REQUIRED',
        message: 'You must complete age verification (18+) before posting or reacting',
      });
    }
  });
});
