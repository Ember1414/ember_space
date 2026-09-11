import { describe, expect, it } from 'vitest';
import {
  formatRepositoryDate,
  repositoryUrlKey,
  sortRepositoriesByPushDate,
  type Repo,
} from './github';

function repo(name: string, pushedAt: string): Repo {
  return {
    name,
    description: null,
    language: null,
    stargazers_count: 0,
    html_url: `https://github.com/Ember1414/${name}`,
    homepage: null,
    fork: false,
    pushed_at: pushedAt,
  };
}

describe('GitHub project catalog', () => {
  it('matches repository URLs independent of casing, trailing slashes, and .git', () => {
    expect(repositoryUrlKey('https://github.com/Ember1414/ember_space/'))
      .toBe(repositoryUrlKey('https://GITHUB.com/ember1414/EMBER_SPACE.git'));
  });

  it('formats repository timestamps as a stable UTC calendar date', () => {
    expect(formatRepositoryDate('2026-09-09T23:37:06-07:00')).toBe('2026.09.10');
    expect(formatRepositoryDate('not-a-date')).toBeNull();
  });

  it('orders repositories by their latest push without mutating the cache array', () => {
    const cached = [
      repo('older', '2026-08-09T13:46:53Z'),
      repo('newer', '2026-09-09T13:37:06Z'),
    ];

    expect(sortRepositoriesByPushDate(cached).map(({ name }) => name)).toEqual(['newer', 'older']);
    expect(cached.map(({ name }) => name)).toEqual(['older', 'newer']);
  });
});
