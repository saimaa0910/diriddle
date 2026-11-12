import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export type AdminRoleName =
  | 'SUPER_ADMIN'
  | 'TRUST_SAFETY_LEAD'
  | 'TRUST_SAFETY'
  | 'MODERATION_LEAD'
  | 'MODERATOR'
  | 'COMMUNITY_MANAGER'
  | 'ANALYST';

export const Roles = (...roles: AdminRoleName[]) => SetMetadata(ROLES_KEY, roles);
