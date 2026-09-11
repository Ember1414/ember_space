import type { PostStatus } from '../db';

export interface CorePostInput {
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

export type CorePostInputResult =
  | { ok: true; value: CorePostInput }
  | { ok: false; error: string };

export type ExpectedVersionResult =
  | { ok: true; value: number }
  | { ok: false; error: string };

export function createSlug(value: string): string;
export function parseExpectedVersion(value: unknown): ExpectedVersionResult;
export function parsePostInput(input: Record<string, unknown>): CorePostInputResult;
export function isPublicStatus(status: PostStatus): boolean;
