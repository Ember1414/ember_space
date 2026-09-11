import fs from 'node:fs';
import path from 'node:path';
import { SITE } from '../consts';

export interface Repo {
  name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  html_url: string;
  homepage: string | null;
  fork: boolean;
  pushed_at: string;
}

const CACHE = path.resolve('src/data/github-repos.json');

export function repositoryUrlKey(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const pathname = url.pathname.replace(/\.git$/i, '').replace(/\/+$/, '').toLowerCase();
    return pathname ? `${url.hostname.toLowerCase()}${pathname}` : null;
  } catch {
    return null;
  }
}

export function formatRepositoryDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.valueOf())) return null;
  const year = String(date.getUTCFullYear()).padStart(4, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}.${month}.${day}`;
}

export function sortRepositoriesByPushDate(repositories: readonly Repo[]): Repo[] {
  return [...repositories].sort((left, right) => {
    const difference = Date.parse(right.pushed_at) - Date.parse(left.pushed_at);
    return Number.isFinite(difference) && difference !== 0
      ? difference
      : left.name.localeCompare(right.name, 'en');
  });
}

function readCache(): Repo[] {
  try {
    return sortRepositoriesByPushDate(JSON.parse(fs.readFileSync(CACHE, 'utf-8')) as Repo[]);
  } catch {
    return [];
  }
}

/**
 * 构建时拉取 GitHub 公开仓库（不含 fork）。
 * 在线拉取成功会同步更新缓存文件；失败（如本地网络无法访问 GitHub）时回退到缓存。
 * 想刷新列表：在能访问 GitHub API 的网络下重新构建，或直接编辑 src/data/github-repos.json。
 */
let repositoryRequest: Promise<Repo[]> | undefined;

async function loadGitHubRepos(): Promise<Repo[]> {
  const username = SITE.social.github.split('/').pop() ?? '';
  if (!username) return readCache();
  try {
    const res = await fetch(
      `https://api.github.com/users/${username}/repos?sort=updated&per_page=30`,
      {
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'ember-blog-build' },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);
    const repos = (await res.json()) as Repo[];
    const filtered = repos
      .filter((r) => !r.fork)
      .map((r) => ({
        name: r.name,
        description: r.description,
        language: r.language,
        stargazers_count: r.stargazers_count,
        html_url: r.html_url,
        homepage: r.homepage,
        fork: r.fork,
        pushed_at: r.pushed_at,
      }));
    try {
      fs.writeFileSync(CACHE, JSON.stringify(filtered, null, 2));
    } catch {
      /* 缓存写入失败不影响构建 */
    }
    return sortRepositoriesByPushDate(filtered);
  } catch {
    return readCache();
  }
}

export function getGitHubRepos(): Promise<Repo[]> {
  repositoryRequest ??= loadGitHubRepos();
  return repositoryRequest;
}
