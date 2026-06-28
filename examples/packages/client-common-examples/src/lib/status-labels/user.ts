import { UserStatusEnum, type UserStatus } from '@old-st/contracts/user';
import { formatStatus } from '../format-status';

/**
 * Override labels for User statuses where the default Title Case formatter
 * does not produce the desired copy. Only declare entries here when the
 * default ("Active", "Pending", ...) is wrong.
 *
 * The Record is exhaustive over UserStatus — adding a new status to the enum
 * forces a TypeScript error here until it is mapped (or explicitly defaulted).
 */
const labels: Record<UserStatus, string> = {
  [UserStatusEnum.ACTIVE]: 'Active',
  [UserStatusEnum.PENDING]: 'Pending',
  [UserStatusEnum.INACTIVE]: 'Inactive',
  [UserStatusEnum.DELETED]: 'Deleted',
};

export function formatUserStatus(status: UserStatus): string {
  return formatStatus(status, labels);
}
