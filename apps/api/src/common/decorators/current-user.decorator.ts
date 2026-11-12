import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface RequestUser {
  id: string;
  authId: string;
  status: string;
  ageVerified: boolean;
  adminRole?: {
    role: string;
    scope?: string | null;
    scopeId?: string | null;
  } | null;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
