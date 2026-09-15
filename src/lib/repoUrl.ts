/** 仓库地址规范化：用于项目条目与 GitHub 仓库去重合并。纯函数，构建期与运行时共用。 */
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
