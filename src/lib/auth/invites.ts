export interface InviteValidity {
  expiresAt: string;
  usedAt: string | null;
}

export type InviteState = 'pending' | 'expired' | 'used';

export function inviteState(invite: InviteValidity, now = new Date()): InviteState {
  if (invite.usedAt) return 'used';
  return Date.parse(invite.expiresAt) > now.getTime() ? 'pending' : 'expired';
}

export function canConsumeInvite(invite: InviteValidity, now = new Date()): boolean {
  return inviteState(invite, now) === 'pending';
}

