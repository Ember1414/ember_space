import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import matter from 'gray-matter';
import yaml from 'js-yaml';
import { parsePostInput } from '../src/lib/posts/input-core.js';

const postsDir = fileURLToPath(new URL('../src/content/posts/', import.meta.url));
const quote = (value) => `'${String(value ?? '').replaceAll("'", "''")}'`;

function dateText(value, field, file, fallback = null) {
  if (value === undefined || value === null || value === '') return fallback;
  if (!(value instanceof Date)) return String(value).trim();
  if (!Number.isFinite(value.getTime())) throw new Error(`${file}: ${field} must be a valid date`);
  return value.toISOString().slice(0, 10);
}

function booleanValue(value, field, file, fallback = false) {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'boolean') throw new Error(`${file}: ${field} must be a boolean`);
  return value;
}

export function parseImportedMarkdown(raw, file) {
  const parsed = matter(raw, {
    engines: {
      yaml: {
        parse: (source) => yaml.load(source, { schema: yaml.JSON_SCHEMA }),
      },
    },
  });
  if (parsed.isEmpty || Object.keys(parsed.data).length === 0) throw new Error(`${file}: missing frontmatter`);
  return { slug: basename(file, '.md'), file, data: parsed.data, body: parsed.content.trim() };
}

function readMarkdown(file) {
  const raw = readFileSync(join(postsDir, file), 'utf8').replace(/^\uFEFF/, '');
  return parseImportedMarkdown(raw, file);
}

export function parseImportedPost({ slug, file, data, body }) {
  const draft = booleanValue(data.draft, 'draft', file);
  const featured = booleanValue(data.featured, 'featured', file);
  const parsed = parsePostInput({
    slug,
    title: data.title,
    description: data.description,
    body,
    pubDate: dateText(data.pubDate, 'pubDate', file, new Date().toISOString().slice(0, 10)),
    updatedDate: dateText(data.updatedDate, 'updatedDate', file),
    tags: data.tags ?? [],
    lang: data.lang ?? 'zh',
    cover: data.cover ?? null,
    coverAlt: data.coverAlt ?? null,
    featured,
    series: data.series ?? null,
    translationKey: data.translationKey ?? null,
    status: draft ? 'draft' : 'published',
  });
  if (!parsed.ok) throw new Error(`${file}: ${parsed.error}`);
  return parsed.value;
}

export function postStatement(post, now) {
  return `INSERT INTO posts (id, slug, title, description, body, pub_date, updated_date, tags, lang, cover, cover_alt, featured, series, translation_key, status, author_id, created_at, updated_at)
VALUES (${quote(crypto.randomUUID())}, ${quote(post.slug)}, ${quote(post.title)}, ${quote(post.description)}, ${quote(post.body)}, ${quote(post.pubDate)}, ${post.updatedDate ? quote(post.updatedDate) : 'NULL'}, ${quote(JSON.stringify(post.tags))}, ${quote(post.lang)}, ${post.cover ? quote(post.cover) : 'NULL'}, ${post.coverAlt ? quote(post.coverAlt) : 'NULL'}, ${post.featured ? 1 : 0}, ${post.series ? quote(post.series) : 'NULL'}, ${post.translationKey ? quote(post.translationKey) : 'NULL'}, ${quote(post.status)}, NULL, ${quote(now)}, ${quote(now)})
ON CONFLICT(slug) DO UPDATE SET title=excluded.title, description=excluded.description, body=excluded.body, pub_date=excluded.pub_date, updated_date=excluded.updated_date, tags=excluded.tags, lang=excluded.lang, cover=excluded.cover, cover_alt=excluded.cover_alt, featured=excluded.featured, series=excluded.series, translation_key=excluded.translation_key, status=excluded.status, updated_at=excluded.updated_at, version=posts.version + 1;`;
}

function main() {
  const args = new Set(process.argv.slice(2));
  const unknownArguments = [...args].filter((argument) => argument !== '--remote');
  if (unknownArguments.length) throw new Error(`Unknown argument: ${unknownArguments[0]}`);
  const remote = args.has('--remote');
  const now = new Date().toISOString();
  const statements = readdirSync(postsDir)
    .filter((file) => file.endsWith('.md'))
    .sort()
    .map(readMarkdown)
    .map(parseImportedPost)
    .map((post) => postStatement(post, now));

  const sqlDirectory = mkdtempSync(join(tmpdir(), 'ember-content-import-'));
  const sqlPath = join(sqlDirectory, 'content.sql');
  try {
    writeFileSync(sqlPath, `${statements.join('\n\n')}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    const wrangler = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url));
    execFileSync(
      process.execPath,
      [wrangler, 'd1', 'execute', 'ember-db', remote ? '--remote' : '--local', '--file', sqlPath],
      { stdio: 'inherit' },
    );
    console.log(`Imported ${statements.length} posts into ${remote ? 'remote' : 'local'} D1.`);
  } finally {
    rmSync(sqlDirectory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

const invokedUrl = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (invokedUrl === import.meta.url) main();
