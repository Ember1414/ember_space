/**
 * GitHub 贡献热力图数据：构建期抓取（与 github.ts 仓库缓存同一模式），
 * 失败时回退到 src/data/github-contributions.json 缓存。
 * 数据源：github-contributions-api.jogruber.de（公开、免鉴权）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { SITE } from '../consts';

const CACHE = path.resolve('src/data/github-contributions.json');

export interface ContributionDay {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export interface ContributionsData {
  total: number;
  /** 按周分列（列 = 一周，行 = 周日至周六）；null 为对齐首周的占位 */
  weeks: (ContributionDay | null)[][];
  firstDate: string;
  lastDate: string;
}

interface CacheShape {
  fetchedAt: string;
  total: number;
  days: ContributionDay[];
}

function readCache(): CacheShape | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(CACHE, 'utf-8')) as CacheShape;
    return Array.isArray(parsed.days) && parsed.days.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function buildWeeks(days: ContributionDay[]): (ContributionDay | null)[][] {
  if (!days.length) return [];
  const first = new Date(`${days[0].date}T00:00:00Z`);
  const pad = Number.isFinite(first.valueOf()) ? first.getUTCDay() : 0;
  const cells: (ContributionDay | null)[] = [...Array<null>(pad).fill(null), ...days];
  const weeks: (ContributionDay | null)[][] = [];
  for (let index = 0; index < cells.length; index += 7) weeks.push(cells.slice(index, index + 7));
  return weeks;
}

function toData(total: number, days: ContributionDay[]): ContributionsData {
  return {
    total,
    weeks: buildWeeks(days),
    firstDate: days[0]?.date ?? '',
    lastDate: days[days.length - 1]?.date ?? '',
  };
}

let contributionsRequest: Promise<ContributionsData | null> | undefined;

async function load(): Promise<ContributionsData | null> {
  const username = SITE.social.github.split('/').pop() ?? '';
  if (!username) return toDataFromCache();
  try {
    const response = await fetch(`https://github-contributions-api.jogruber.de/v4/${username}?y=last`, {
      headers: { 'User-Agent': 'ember-blog-build' },
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) throw new Error(`contributions API ${response.status}`);
    const raw = (await response.json()) as {
      total?: Record<string, unknown>;
      contributions?: Array<{ date?: unknown; count?: unknown; level?: unknown }>;
    };
    const days: ContributionDay[] = (raw.contributions ?? [])
      .filter((day): day is { date: string; count: number; level: number } =>
        typeof day.date === 'string' && typeof day.count === 'number' && typeof day.level === 'number')
      .map((day) => ({
        date: day.date,
        count: Math.max(0, Math.round(day.count)),
        level: Math.min(4, Math.max(0, Math.round(day.level))) as ContributionDay['level'],
      }));
    if (!days.length) throw new Error('empty contributions');
    const total = days.reduce((sum, day) => sum + day.count, 0);
    try {
      fs.writeFileSync(CACHE, JSON.stringify({ fetchedAt: new Date().toISOString(), total, days }, null, 2));
    } catch {
      /* 缓存写入失败不影响构建 */
    }
    return toData(total, days);
  } catch {
    return toDataFromCache();
  }
}

function toDataFromCache(): ContributionsData | null {
  const cache = readCache();
  return cache ? toData(cache.total, cache.days) : null;
}

export function getContributions(): Promise<ContributionsData | null> {
  contributionsRequest ??= load();
  return contributionsRequest;
}
