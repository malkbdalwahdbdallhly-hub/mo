import { UserRole, AuditOperation } from '../types';

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  OWNER: 4,
  ADMIN: 3,
  OPERATOR: 2,
  VIEWER: 1,
};

export const DANGEROUS_OPERATIONS: AuditOperation[] = [
  'RESTORE_STARTED',
  'RESTORE_COMPLETED',
  'REBUILD_EXECUTED',
  'CLEANUP_EXECUTED',
  'REBOOT_REQUESTED',
];

export function hasPermission(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export function canPerformOperation(userRole: UserRole, operation: AuditOperation): boolean {
  if (DANGEROUS_OPERATIONS.includes(operation)) {
    return userRole === 'OWNER' || userRole === 'ADMIN';
  }

  if (operation === 'CARD_GENERATION' || operation === 'USER_DISCONNECTED' || operation === 'POS_CREATED') {
    return userRole === 'OWNER' || userRole === 'ADMIN' || userRole === 'OPERATOR';
  }

  return true;
}
