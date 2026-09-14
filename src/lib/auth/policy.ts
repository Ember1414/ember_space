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

/** 文章配图上传只面向内容作者；reader 头像走 /api/avatar，不在此列。 */
export const canUploadImages = canCreatePost;

/** 网址收藏管理同样只面向内容作者（owner/editor）。 */
export const canManageLinks = canCreatePost;

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

/** 所有者可以删除任何文章；编辑只能删除自己名下的文章（含已被撤回的）。 */
export function canDeletePost(user: AuthenticatedUser, post: OwnedPost): boolean {
  return user.active && (user.role === 'owner' || post.authorId === user.id);
}
