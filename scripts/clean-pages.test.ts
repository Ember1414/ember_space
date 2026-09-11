import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanPagesOutput } from './clean-pages.mjs';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => (
    rm(directory, { recursive: true, force: true })
  )));
});

describe('Pages build cleanup', () => {
  it('removes a stale deploy directory without touching Astro output', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'ember-build-clean-test-'));
    temporaryDirectories.push(projectRoot);
    mkdirSync(join(projectRoot, 'dist-pages'), { recursive: true });
    mkdirSync(join(projectRoot, 'dist'), { recursive: true });
    writeFileSync(join(projectRoot, 'dist-pages', '_worker.js'), 'stale');
    writeFileSync(join(projectRoot, 'dist', 'keep.txt'), 'current');

    cleanPagesOutput(projectRoot);

    expect(existsSync(join(projectRoot, 'dist-pages'))).toBe(false);
    expect(existsSync(join(projectRoot, 'dist', 'keep.txt'))).toBe(true);
  });
});
