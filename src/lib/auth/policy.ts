import type { Role } from '../db';

export interface AuthenticatedUser {
  id: string;
  role: Role;
  active: boolean;
}

export interface OwnedPost {
  authorId: string | null;
  status: WritablePostStatus;
}

export type WritablePostStatus = 'draft' | 'published' | 'archived';

export function canManageMembers(user: AuthenticatedUser): boolean {
  return user.active && user.role === 'owner';
}

export function canCreatePost(user: AuthenticatedUser): boolean {
  return user.active && (user.role === 'owner' || user.role === 'editor');
}

export function canEditPost(user: AuthenticatedUser, post: OwnedPost): boolean {
  return user.active && (
    user.role === 'owner'
    || (post.authorId === user.id && post.status !== 'archived')
  );
}

export const canPublishPost = canEditPost;

export function canSetPostStatus(
  user: AuthenticatedUser,
  post: OwnedPost,
  status: WritablePostStatus,
): boolean {
  if (!canEditPost(user, post)) return false;
  return status !== 'archived' || user.role === 'owner';
}

export function canDeletePost(user: AuthenticatedUser, _post: OwnedPost): boolean {
  return user.active && user.role === 'owner';
}
