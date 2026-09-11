import type { PostStatus } from '../db';
import {
  createSlug as createSlugCore,
  isPublicStatus as isPublicStatusCore,
  parseExpectedVersion as parseExpectedVersionCore,
  parsePostInput as parsePostInputCore,
} from './input-core.js';

export interface PostInput {
  slug: string;
  title: string;
  description: string;
  body: string;
  pubDate: string;
  updatedDate: string | null;
  tags: string[];
  lang: 'zh' | 'en';
  cover: string | null;
  coverAlt: string | null;
  featured: boolean;
  series: string | null;
  translationKey: string | null;
  status: PostStatus;
}

export type PostInputResult = { ok: true; value: PostInput } | { ok: false; error: string };
export type ExpectedVersionResult = { ok: true; value: number } | { ok: false; error: string };

export function createSlug(value: string): string {
  return createSlugCore(value);
}

export function parseExpectedVersion(value: unknown): ExpectedVersionResult {
  return parseExpectedVersionCore(value);
}

export function parsePostInput(input: Record<string, unknown>): PostInputResult {
  return parsePostInputCore(input) as PostInputResult;
}

export function isPublicStatus(status: PostStatus): boolean {
  return isPublicStatusCore(status);
}
