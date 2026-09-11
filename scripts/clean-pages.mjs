import { rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));

export function cleanPagesOutput(root = projectRoot) {
  rmSync(join(root, 'dist-pages'), { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

const invokedUrl = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (invokedUrl === import.meta.url) cleanPagesOutput();
