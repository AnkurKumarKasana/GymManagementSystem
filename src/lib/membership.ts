import { getIndiaDateKey } from './dates';
import type { MembershipStatus, Member } from '../types';

export function getCurrentMembershipStatus(
  member: Pick<Member, 'isActive' | 'status' | 'membershipExpiryDate'>,
  today = getIndiaDateKey(new Date()),
): MembershipStatus {
  if (!member.isActive || member.status === 'Cancelled') return 'Cancelled';
  if (member.status === 'Paused') return 'Paused';

  const expiryDate = member.membershipExpiryDate.slice(0, 10);
  if (expiryDate < today) return 'Expired';

  const expiryLimit = new Date(new Date(`${today}T00:00:00Z`).getTime() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  return expiryDate <= expiryLimit ? 'Expiring Soon' : 'Active';
}
