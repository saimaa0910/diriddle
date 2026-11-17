import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class AgeVerifiedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user || !user.ageVerified) {
      throw new ForbiddenException({
        error: 'AGE_VERIFICATION_REQUIRED',
        message: 'You must complete age verification (18+) before posting or reacting',
      });
    }
    return true;
  }
}
