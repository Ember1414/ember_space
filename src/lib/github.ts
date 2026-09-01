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

function readCache(): Repo[] {
  try {
    return JSON.parse(fs.readFileSync(CACHE, 'utf-8')) as Repo[];
  } catch {
    return [];
  }
}

/**
 * 构建时拉取 GitHub 公开仓库（不含 fork）。
 * 在线拉取成功会同步更新缓存文件；失败（如本地网络无法访问 GitHub）时回退到缓存。
 * 想刷新列表：在能访问 GitHub API 的网络下重新构建，或直接编辑 src/data/github-repos.json。
 */
export async function getGitHubRepos(): Promise<Repo[]> {
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
    return filtered;
  } catch {
    return readCache();
  }
}
