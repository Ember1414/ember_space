import { describe, expect, it } from 'vitest';
import { canCreatePost, canDeletePost, canEditPost, canManageMembers, canPublishPost, canSetPostStatus } from './policy';

describe('authorization policy', () => {
  const owner = { id: 'owner', role: 'owner' as const, active: true };
  const editor = { id: 'editor', role: 'editor' as const, active: true };
  const suspended = { id: 'suspended', role: 'editor' as const, active: false };
  const ownPost = { authorId: 'editor' };
  const otherPost = { authorId: 'someone-else' };

  it('gives member management only to the active owner', () => {
    expect(canManageMembers(owner)).toBe(true);
    expect(canManageMembers(editor)).toBe(false);
    expect(canManageMembers(suspended)).toBe(false);
  });

  it('allows editors to create, edit, and publish only their own posts', () => {
    expect(canCreatePost(editor)).toBe(true);
    expect(canEditPost(editor, ownPost)).toBe(true);
    expect(canPublishPost(editor, ownPost)).toBe(true);
    expect(canSetPostStatus(editor, ownPost, 'draft')).toBe(true);
    expect(canSetPostStatus(editor, ownPost, 'published')).toBe(true);
    expect(canSetPostStatus(editor, ownPost, 'archived')).toBe(false);
    expect(canEditPost(editor, otherPost)).toBe(false);
    expect(canPublishPost(editor, otherPost)).toBe(false);
    expect(canDeletePost(editor, ownPost)).toBe(false);
  });

  it('allows the owner to manage every post', () => {
    expect(canEditPost(owner, otherPost)).toBe(true);
    expect(canPublishPost(owner, otherPost)).toBe(true);
    expect(canDeletePost(owner, otherPost)).toBe(true);
    expect(canSetPostStatus(owner, otherPost, 'archived')).toBe(true);
  });

  it('denies all authoring actions to a suspended editor', () => {
    expect(canCreatePost(suspended)).toBe(false);
    expect(canEditPost(suspended, ownPost)).toBe(false);
    expect(canPublishPost(suspended, ownPost)).toBe(false);
    expect(canDeletePost(suspended, ownPost)).toBe(false);
  });
});
