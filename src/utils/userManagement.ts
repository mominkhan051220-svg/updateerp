import { UserAccount } from '../types';

export interface DeleteUserDecision {
  allowed: boolean;
  reason?: 'FORBIDDEN' | 'NOT_FOUND' | 'AT_LEAST_ONE_ADMIN_REQUIRED';
  message?: string;
}

export function canDeleteUser(
  users: ReadonlyArray<Pick<UserAccount, 'id' | 'role' | 'username'>>,
  actor: Pick<UserAccount, 'id' | 'role'>,
  targetUserId: string
): DeleteUserDecision {
  if (actor.role !== 'admin') {
    return {
      allowed: false,
      reason: 'FORBIDDEN',
      message: 'Only admin can delete users.',
    };
  }

  const target = users.find((u) => u.id === targetUserId);
  if (!target) {
    return {
      allowed: false,
      reason: 'NOT_FOUND',
      message: 'User not found.',
    };
  }

  if (target.role === 'admin') {
    const remainingAdmins = users.filter((u) => u.role === 'admin' && u.id !== targetUserId);
    if (remainingAdmins.length === 0) {
      return {
        allowed: false,
        reason: 'AT_LEAST_ONE_ADMIN_REQUIRED',
        message: 'At least one admin account must remain. Create another admin user first.',
      };
    }
  }

  return { allowed: true };
}
