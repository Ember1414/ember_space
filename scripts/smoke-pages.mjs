import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { cp, copyFile, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { basename, join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const wranglerEntry = join(projectRoot, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const pagesDirectory = join(projectRoot, 'dist-pages');
const workerEntry = join(pagesDirectory, '_worker.js');
const temporaryPrefix = 'ember-pages-smoke-';
const requestTimeoutMs = 15_000;

function usage() {
  console.log(`Usage: node scripts/smoke-pages.mjs [--port PORT]

Runs the Cloudflare Pages/D1 smoke suite against an isolated temporary local
Wrangler state directory. Run \`npm run build\` first so dist-pages is current.`);
}

function parseArguments(argv) {
  let port;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--help' || argument === '-h') {
      usage();
      process.exit(0);
    }
    if (argument === '--port') {
      const value = Number(argv[index + 1]);
      if (!Number.isSafeInteger(value) || value < 1 || value > 65_535) {
        throw new Error('--port must be an integer between 1 and 65535.');
      }
      port = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }
  return { port };
}

function randomSecret(bytes = 32) {
  return randomBytes(bytes).toString('base64url');
}

function appendLog(current, chunk) {
  const next = current + chunk.toString();
  return next.length > 40_000 ? next.slice(-40_000) : next;
}

async function runProcess(command, args, label, options = {}) {
  const child = spawn(command, args, {
    cwd: projectRoot,
    env: { ...process.env, CI: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    ...options,
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output = appendLog(output, chunk); });
  child.stderr.on('data', (chunk) => { output = appendLog(output, chunk); });

  const exitCode = await new Promise((resolveExit, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => resolveExit(code ?? signal ?? 'unknown'));
  });
  if (exitCode !== 0) {
    throw new Error(`${label} failed (${exitCode}).\n${output.trim()}`);
  }
  return output;
}

function runWrangler(args, label, options) {
  return runProcess(process.execPath, [wranglerEntry, ...args], label, options);
}

async function availablePort(requestedPort) {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.unref();
    server.once('error', reject);
    server.listen(requestedPort ?? 0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : null;
      server.close((error) => {
        if (error) reject(error);
        else if (port) resolvePort(port);
        else reject(new Error('Could not reserve a local port.'));
      });
    });
  });
}

function startPagesServer({ port, inspectorPort, stateDirectory, runtimeDirectory }) {
  const args = [
    wranglerEntry,
    'pages',
    'dev',
    pagesDirectory,
    '--ip',
    '127.0.0.1',
    '--port',
    String(port),
    '--inspector-port',
    String(inspectorPort),
    '--persist-to',
    stateDirectory,
    '--log-level',
    'warn',
  ];
  const child = spawn(process.execPath, args, {
    cwd: runtimeDirectory,
    env: { ...process.env, CI: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output = appendLog(output, chunk); });
  child.stderr.on('data', (chunk) => { output = appendLog(output, chunk); });
  child.on('error', (error) => { output = appendLog(output, `${error.stack ?? error.message}\n`); });
  child.serverOutput = () => output.trim();
  return child;
}

async function stopPagesServer(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;

  const exited = new Promise((resolveExit) => child.once('exit', resolveExit));
  child.kill('SIGTERM');
  const graceful = await Promise.race([
    exited.then(() => true),
    new Promise((resolveWait) => setTimeout(() => resolveWait(false), 5_000)),
  ]);
  if (graceful || child.exitCode !== null || child.signalCode !== null) return;

  if (process.platform === 'win32' && child.pid) {
    await runProcess('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], 'Stopping Wrangler').catch(() => undefined);
  } else {
    child.kill('SIGKILL');
  }
  await Promise.race([exited, new Promise((resolveWait) => setTimeout(resolveWait, 5_000))]);
}

async function waitForServer(baseUrl, child) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`Wrangler exited before becoming ready.\n${child.serverOutput()}`);
    }
    try {
      const response = await fetch(new URL('/_worker.js', baseUrl), {
        signal: AbortSignal.timeout(1_000),
        redirect: 'manual',
      });
      if (response.status === 404) return;
    } catch {
      // The socket is expected to reject until workerd is listening.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 150));
  }
  throw new Error(`Wrangler did not become ready within 30 seconds.\n${child.serverOutput()}`);
}

function cookieFrom(response) {
  const setCookie = response.headers.get('set-cookie');
  const cookie = setCookie?.match(/^([^=;]+=[^;]*)/)?.[1];
  assert.ok(cookie, 'Login response did not set a session cookie.');
  return cookie;
}

async function request(baseUrl, pathname, options = {}) {
  const method = options.method ?? 'GET';
  const headers = new Headers(options.headers);
  headers.set('accept', options.accept ?? '*/*');
  if (options.cookie) headers.set('cookie', options.cookie);
  if (options.csrf) headers.set('x-csrf-token', options.csrf);
  if (!['GET', 'HEAD'].includes(method) && options.origin !== false) {
    headers.set('origin', options.origin ?? new URL(baseUrl).origin);
  }
  let body;
  if (options.json !== undefined) {
    headers.set('content-type', 'application/json');
    body = JSON.stringify(options.json);
  }

  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers,
    body,
    redirect: options.redirect ?? 'follow',
    signal: AbortSignal.timeout(requestTimeoutMs),
  });
  const text = await response.text();
  let data;
  if (response.headers.get('content-type')?.includes('application/json')) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`${method} ${pathname} returned invalid JSON: ${text.slice(0, 500)}`);
    }
  }
  return { response, status: response.status, text, data };
}

function expectStatus(result, expected, label) {
  assert.equal(
    result.status,
    expected,
    `${label}: expected HTTP ${expected}, received ${result.status}. Body: ${result.text.slice(0, 500)}`,
  );
}

async function check(label, action) {
  await action();
  console.log(`[smoke] ok - ${label}`);
}

function postInput({ slug, title, body, status = 'draft' }) {
  return {
    slug,
    title,
    description: `Description for ${title}`,
    body,
    pubDate: new Date().toISOString().slice(0, 10),
    tags: ['smoke-test'],
    lang: 'zh',
    featured: false,
    status,
  };
}

async function runSmoke(baseUrl, fixture) {
  const state = {
    editorId: null,
    editorPostId: null,
    editorPostVersion: null,
    ownerPostId: null,
    ownerPostVersion: null,
  };
  let owner;
  let editor;

  await check('private build paths return 404', async () => {
    for (const pathname of [
      '/_worker.js',
      '/_server',
      '/_server/',
      '/_server/entry.mjs',
      '/%5fserver/entry.mjs',
      '/_server%2fentry.mjs',
      '//_server/entry.mjs',
    ]) {
      const result = await request(baseUrl, pathname, { redirect: 'manual' });
      expectStatus(result, 404, pathname);
      assert.doesNotMatch(result.text, /import\s+application|export\s+default/);
    }
  });

  await check('admin pages deny framing', async () => {
    const result = await request(baseUrl, '/admin/login/');
    expectStatus(result, 200, 'admin login page');
    assert.equal(result.response.headers.get('content-security-policy'), "frame-ancestors 'none'");
    assert.equal(result.response.headers.get('x-frame-options'), 'DENY');
  });

  await check('setup rejects an untrusted origin without side effects', async () => {
    const result = await request(baseUrl, '/api/auth/setup', {
      method: 'POST',
      origin: 'https://attacker.invalid',
      json: fixture.ownerSetup,
    });
    expectStatus(result, 403, 'untrusted setup origin');
  });

  await check('owner setup succeeds once and then becomes unavailable', async () => {
    const created = await request(baseUrl, '/api/auth/setup', { method: 'POST', json: fixture.ownerSetup });
    expectStatus(created, 201, 'owner setup');
    assert.equal(created.data?.user?.role, 'owner');
    assert.equal(created.data?.user?.email, fixture.ownerEmail);

    const repeated = await request(baseUrl, '/api/auth/setup', {
      method: 'POST',
      json: {
        ...fixture.ownerSetup,
        username: `second-owner-${fixture.runId}@example.test`,
        displayName: 'Second Smoke Owner',
        password: `Second-${randomSecret(18)}!1a`,
      },
    });
    expectStatus(repeated, 409, 'repeated owner setup');
  });

  await check('owner login creates an authenticated CSRF session', async () => {
    const result = await request(baseUrl, '/api/auth/login', {
      method: 'POST',
      json: { username: fixture.ownerEmail, password: fixture.ownerPassword },
    });
    expectStatus(result, 200, 'owner login');
    assert.equal(result.data?.user?.role, 'owner');
    assert.ok(result.data?.csrfToken);
    owner = { cookie: cookieFrom(result.response), csrf: result.data.csrfToken };
  });

  await check('authenticated writes reject missing CSRF and mismatched Origin', async () => {
    const body = { email: fixture.editorEmail, expiresIn: 3600 };
    const missingCsrf = await request(baseUrl, '/api/invites', {
      method: 'POST',
      cookie: owner.cookie,
      json: body,
    });
    expectStatus(missingCsrf, 403, 'missing CSRF');

    const wrongOrigin = await request(baseUrl, '/api/invites', {
      method: 'POST',
      cookie: owner.cookie,
      csrf: owner.csrf,
      origin: 'https://attacker.invalid',
      json: body,
    });
    expectStatus(wrongOrigin, 403, 'mismatched Origin');
  });

  let inviteToken;
  await check('owner creates an editor invitation', async () => {
    const result = await request(baseUrl, '/api/invites', {
      method: 'POST',
      cookie: owner.cookie,
      csrf: owner.csrf,
      json: { email: fixture.editorEmail, expiresIn: 3600 },
    });
    expectStatus(result, 201, 'create invitation');
    assert.equal(result.data?.invite?.email, fixture.editorEmail);
    assert.ok(result.data?.token);
    inviteToken = result.data.token;
  });

  await check('invitation can be accepted exactly once', async () => {
    const pathname = `/api/invites/${encodeURIComponent(inviteToken)}/accept`;
    const body = {
      email: fixture.editorEmail,
      displayName: fixture.editorDisplayName,
      password: fixture.editorPassword,
    };
    const accepted = await request(baseUrl, pathname, { method: 'POST', json: body });
    expectStatus(accepted, 201, 'accept invitation');
    assert.equal(accepted.data?.user?.role, 'editor');
    state.editorId = accepted.data.user.id;

    const repeated = await request(baseUrl, pathname, { method: 'POST', json: body });
    expectStatus(repeated, 410, 'reuse invitation');
  });

  await check('editor login succeeds', async () => {
    const result = await request(baseUrl, '/api/auth/login', {
      method: 'POST',
      json: { username: fixture.editorEmail, password: fixture.editorPassword },
    });
    expectStatus(result, 200, 'editor login');
    assert.equal(result.data?.user?.role, 'editor');
    editor = { cookie: cookieFrom(result.response), csrf: result.data.csrfToken };
  });

  await check('editor cannot use owner-only member or invitation APIs', async () => {
    const members = await request(baseUrl, '/api/members', { cookie: editor.cookie });
    expectStatus(members, 403, 'editor member listing');

    const invite = await request(baseUrl, '/api/invites', {
      method: 'POST',
      cookie: editor.cookie,
      csrf: editor.csrf,
      json: { email: fixture.unauthorizedInviteEmail, expiresIn: 3600 },
    });
    expectStatus(invite, 403, 'editor invitation creation');
  });

  await check('post API rejects non-canonical publication timestamps', async () => {
    const result = await request(baseUrl, '/api/posts', {
      method: 'POST',
      cookie: owner.cookie,
      csrf: owner.csrf,
      json: {
        ...postInput({
          slug: `invalid-date-${fixture.runId}`,
          title: `Invalid date ${fixture.runId}`,
          body: '# Invalid publication date',
        }),
        pubDate: '2026-09-11T00:00:00.000Z',
      },
    });
    expectStatus(result, 400, 'timestamp publication date');
  });

  await check('owner and editor can create their own drafts', async () => {
    const ownerPost = await request(baseUrl, '/api/posts', {
      method: 'POST',
      cookie: owner.cookie,
      csrf: owner.csrf,
      json: postInput({
        slug: fixture.ownerPostSlug,
        title: fixture.ownerPostTitle,
        body: '# Owner-only draft',
      }),
    });
    expectStatus(ownerPost, 201, 'owner draft creation');
    assert.equal(ownerPost.data?.post?.updatedDate, null, 'New owner draft must not have an update timestamp.');
    assert.equal(ownerPost.data?.post?.version, 1, 'A new owner draft must start at version 1.');
    state.ownerPostId = ownerPost.data.id;
    state.ownerPostVersion = ownerPost.data.post.version;

    const editorPost = await request(baseUrl, '/api/posts', {
      method: 'POST',
      cookie: editor.cookie,
      csrf: editor.csrf,
      json: postInput({
        slug: fixture.editorPostSlug,
        title: fixture.editorPostTitle,
        body: `# ${fixture.bodyMarker}\n\nPublished from the smoke suite.`,
      }),
    });
    expectStatus(editorPost, 201, 'editor draft creation');
    assert.equal(editorPost.data?.post?.updatedDate, null, 'New editor draft must not have an update timestamp.');
    assert.equal(editorPost.data?.post?.version, 1, 'A new editor draft must start at version 1.');
    state.editorPostId = editorPost.data.id;
    state.editorPostVersion = editorPost.data.post.version;

    const storedDraft = await request(baseUrl, `/api/posts/${state.editorPostId}`, { cookie: editor.cookie });
    expectStatus(storedDraft, 200, 'new editor draft read-back');
    assert.equal(storedDraft.data?.post?.updatedDate, null, 'Stored new draft must not have an update timestamp.');
    assert.equal(storedDraft.data?.post?.version, state.editorPostVersion);
  });

  await check('draft stays absent from every public content surface', async () => {
    const detail = await request(baseUrl, `/posts/${fixture.editorPostSlug}/?smoke=${fixture.runId}`);
    expectStatus(detail, 404, 'draft public detail');

    const homepage = await request(baseUrl, `/?smoke=${fixture.runId}`);
    expectStatus(homepage, 200, 'draft homepage');
    assert.ok(!homepage.text.includes(fixture.editorPostTitle), 'Draft leaked onto the homepage.');

    const postIndex = await request(baseUrl, `/posts/?smoke=${fixture.runId}`);
    expectStatus(postIndex, 200, 'draft post index');
    assert.ok(!postIndex.text.includes(fixture.editorPostTitle), 'Draft leaked onto the post index.');

    const tagPage = await request(baseUrl, `/tags/smoke-test/?smoke=${fixture.runId}`);
    expectStatus(tagPage, 200, 'draft tag page');
    assert.ok(!tagPage.text.includes(fixture.editorPostTitle), 'Draft leaked onto the tag page.');

    const rss = await request(baseUrl, `/rss.xml?smoke=${fixture.runId}`);
    expectStatus(rss, 200, 'draft RSS');
    assert.ok(!rss.text.includes(fixture.editorPostSlug), 'Draft leaked into RSS.');

    const sitemap = await request(baseUrl, `/sitemap-posts.xml?smoke=${fixture.runId}`);
    expectStatus(sitemap, 200, 'draft sitemap');
    assert.ok(!sitemap.text.includes(fixture.editorPostSlug), 'Draft leaked into the sitemap.');
  });

  await check('editor permission boundaries protect other posts, archive, and deletion', async () => {
    const editOwnerPost = await request(baseUrl, `/api/posts/${state.ownerPostId}`, {
      method: 'PATCH',
      cookie: editor.cookie,
      csrf: editor.csrf,
      json: { title: `Unauthorized ${fixture.runId}`, expectedVersion: state.ownerPostVersion },
    });
    expectStatus(editOwnerPost, 403, 'editing owner post');

    const archiveOwnPost = await request(baseUrl, `/api/posts/${state.editorPostId}`, {
      method: 'PATCH',
      cookie: editor.cookie,
      csrf: editor.csrf,
      json: { status: 'archived', expectedVersion: state.editorPostVersion },
    });
    expectStatus(archiveOwnPost, 403, 'editor archive');

    const deleteOwnPost = await request(baseUrl, `/api/posts/${state.editorPostId}`, {
      method: 'DELETE',
      cookie: editor.cookie,
      csrf: editor.csrf,
    });
    expectStatus(deleteOwnPost, 403, 'editor delete');
  });

  await check('post updates require a version and reject stale concurrent writes', async () => {
    const missingVersion = await request(baseUrl, `/api/posts/${state.editorPostId}`, {
      method: 'PATCH',
      cookie: editor.cookie,
      csrf: editor.csrf,
      json: { description: `Missing version ${fixture.runId}` },
    });
    expectStatus(missingVersion, 400, 'missing expected post version');

    const snapshotVersion = state.editorPostVersion;
    const winnerDescription = `Concurrent winner ${fixture.runId}`;
    const winner = await request(baseUrl, `/api/posts/${state.editorPostId}`, {
      method: 'PATCH',
      cookie: editor.cookie,
      csrf: editor.csrf,
      json: { description: winnerDescription, expectedVersion: snapshotVersion },
    });
    expectStatus(winner, 200, 'first concurrent post update');
    assert.equal(winner.data?.post?.version, snapshotVersion + 1);
    state.editorPostVersion = winner.data.post.version;

    const stale = await request(baseUrl, `/api/posts/${state.editorPostId}`, {
      method: 'PATCH',
      cookie: editor.cookie,
      csrf: editor.csrf,
      json: { description: `Stale loser ${fixture.runId}`, expectedVersion: snapshotVersion },
    });
    expectStatus(stale, 409, 'stale concurrent post update');

    const stored = await request(baseUrl, `/api/posts/${state.editorPostId}`, { cookie: editor.cookie });
    expectStatus(stored, 200, 'concurrent update read-back');
    assert.equal(stored.data?.post?.description, winnerDescription, 'A stale update overwrote the winning edit.');
    assert.equal(stored.data?.post?.version, state.editorPostVersion);
  });

  await check('editor publishes own post and public surfaces update immediately', async () => {
    const published = await request(baseUrl, `/api/posts/${state.editorPostId}`, {
      method: 'PATCH',
      cookie: editor.cookie,
      csrf: editor.csrf,
      json: { status: 'published', expectedVersion: state.editorPostVersion },
    });
    expectStatus(published, 200, 'editor publish');
    assert.equal(published.data?.post?.status, 'published');
    assert.equal(published.data?.post?.version, state.editorPostVersion + 1);
    state.editorPostVersion = published.data.post.version;
    const firstUpdatedDate = published.data?.post?.updatedDate;
    assert.equal(typeof firstUpdatedDate, 'string', 'First post update must return an ISO update timestamp.');
    assert.equal(new Date(firstUpdatedDate).toISOString(), firstUpdatedDate, 'First post update timestamp must be valid ISO.');
    assert.equal(published.data?.post?.updatedAt, firstUpdatedDate, 'PATCH timestamps must come from the same server time.');

    const savedPost = await request(baseUrl, `/api/posts/${state.editorPostId}`, { cookie: editor.cookie });
    expectStatus(savedPost, 200, 'published post read-back');
    assert.equal(savedPost.data?.post?.updatedDate, firstUpdatedDate, 'Stored update timestamp must match the PATCH response.');
    assert.equal(savedPost.data?.post?.updatedAt, firstUpdatedDate, 'Stored audit timestamp must match the PATCH response.');

    const detail = await request(baseUrl, `/posts/${fixture.editorPostSlug}/?smoke=${fixture.runId}`);
    expectStatus(detail, 200, 'published public detail');
    assert.ok(detail.text.includes(fixture.bodyMarker), 'Published body is absent from the public detail page.');

    const homepage = await request(baseUrl, `/?smoke=${fixture.runId}`);
    expectStatus(homepage, 200, 'published homepage');
    assert.ok(homepage.text.includes(fixture.editorPostTitle), 'Published title is absent from the homepage.');

    const postIndex = await request(baseUrl, `/posts/?smoke=${fixture.runId}`);
    expectStatus(postIndex, 200, 'published post index');
    assert.ok(postIndex.text.includes(fixture.editorPostTitle), 'Published title is absent from the post index.');

    const tagPage = await request(baseUrl, `/tags/smoke-test/?smoke=${fixture.runId}`);
    expectStatus(tagPage, 200, 'published tag page');
    assert.ok(tagPage.text.includes(fixture.editorPostTitle), 'Published title is absent from the tag page.');

    const rss = await request(baseUrl, `/rss.xml?smoke=${fixture.runId}`);
    expectStatus(rss, 200, 'published RSS');
    assert.ok(rss.text.includes(fixture.editorPostSlug), 'Published post is absent from RSS.');

    const sitemap = await request(baseUrl, `/sitemap-posts.xml?smoke=${fixture.runId}`);
    expectStatus(sitemap, 200, 'published sitemap');
    assert.ok(sitemap.text.includes(fixture.editorPostSlug), 'Published post is absent from the sitemap.');
  });

  await check('owner withdraws another author post and public surfaces update immediately', async () => {
    const archived = await request(baseUrl, `/api/posts/${state.editorPostId}`, {
      method: 'PATCH',
      cookie: owner.cookie,
      csrf: owner.csrf,
      json: { status: 'archived', expectedVersion: state.editorPostVersion },
    });
    expectStatus(archived, 200, 'owner archive');
    assert.equal(archived.data?.post?.status, 'archived');
    assert.equal(archived.data?.post?.version, state.editorPostVersion + 1);
    state.editorPostVersion = archived.data.post.version;

    const editorRepublish = await request(baseUrl, `/api/posts/${state.editorPostId}`, {
      method: 'PATCH',
      cookie: editor.cookie,
      csrf: editor.csrf,
      json: { status: 'published', expectedVersion: state.editorPostVersion },
    });
    expectStatus(editorRepublish, 403, 'editor republish after owner archive');

    const detail = await request(baseUrl, `/posts/${fixture.editorPostSlug}/?smoke=${fixture.runId}`);
    expectStatus(detail, 404, 'archived public detail');

    const homepage = await request(baseUrl, `/?smoke=${fixture.runId}`);
    expectStatus(homepage, 200, 'archived homepage');
    assert.ok(!homepage.text.includes(fixture.editorPostTitle), 'Archived post remains on the homepage.');

    const postIndex = await request(baseUrl, `/posts/?smoke=${fixture.runId}`);
    expectStatus(postIndex, 200, 'archived post index');
    assert.ok(!postIndex.text.includes(fixture.editorPostTitle), 'Archived post remains on the post index.');

    const tagPage = await request(baseUrl, `/tags/smoke-test/?smoke=${fixture.runId}`);
    expectStatus(tagPage, 200, 'archived tag page');
    assert.ok(!tagPage.text.includes(fixture.editorPostTitle), 'Archived post remains on the tag page.');

    const rss = await request(baseUrl, `/rss.xml?smoke=${fixture.runId}`);
    expectStatus(rss, 200, 'archived RSS');
    assert.ok(!rss.text.includes(fixture.editorPostSlug), 'Archived post remains in RSS.');

    const sitemap = await request(baseUrl, `/sitemap-posts.xml?smoke=${fixture.runId}`);
    expectStatus(sitemap, 200, 'archived sitemap');
    assert.ok(!sitemap.text.includes(fixture.editorPostSlug), 'Archived post remains in the sitemap.');
  });

  await check('owner deletes both posts', async () => {
    for (const postId of [state.editorPostId, state.ownerPostId]) {
      const deleted = await request(baseUrl, `/api/posts/${postId}`, {
        method: 'DELETE',
        cookie: owner.cookie,
        csrf: owner.csrf,
      });
      expectStatus(deleted, 200, `owner delete ${postId}`);
    }

    const missing = await request(baseUrl, `/api/posts/${state.editorPostId}`, { cookie: owner.cookie });
    expectStatus(missing, 404, 'deleted post lookup');
  });

  await check('owner suspends and restores the editor without reviving an old session', async () => {
    const suspended = await request(baseUrl, `/api/members/${state.editorId}`, {
      method: 'PATCH',
      cookie: owner.cookie,
      csrf: owner.csrf,
      json: { status: 'suspended' },
    });
    expectStatus(suspended, 200, 'owner suspend editor');
    assert.equal(suspended.data?.member?.status, 'suspended');

    const suspendedSession = await request(baseUrl, '/api/auth/me', { cookie: editor.cookie });
    expectStatus(suspendedSession, 401, 'suspended editor session');

    const restored = await request(baseUrl, `/api/members/${state.editorId}`, {
      method: 'PATCH',
      cookie: owner.cookie,
      csrf: owner.csrf,
      json: { status: 'active' },
    });
    expectStatus(restored, 200, 'owner restore editor');
    assert.equal(restored.data?.member?.status, 'active');

    const oldSession = await request(baseUrl, '/api/auth/me', { cookie: editor.cookie });
    expectStatus(oldSession, 401, 'restored editor old session');

    const relogin = await request(baseUrl, '/api/auth/login', {
      method: 'POST',
      json: { username: fixture.editorEmail, password: fixture.editorPassword },
    });
    expectStatus(relogin, 200, 'restored editor login');
    editor = { cookie: cookieFrom(relogin.response), csrf: relogin.data.csrfToken };
  });

  await check('owner deletes the test editor and revokes its session', async () => {
    const deleted = await request(baseUrl, `/api/members/${state.editorId}`, {
      method: 'DELETE',
      cookie: owner.cookie,
      csrf: owner.csrf,
    });
    expectStatus(deleted, 200, 'owner delete editor');

    const staleSession = await request(baseUrl, '/api/auth/me', { cookie: editor.cookie });
    expectStatus(staleSession, 401, 'deleted editor session');
  });

  await check('owner logout revokes its session', async () => {
    const logout = await request(baseUrl, '/api/auth/logout', {
      method: 'POST',
      cookie: owner.cookie,
      csrf: owner.csrf,
    });
    expectStatus(logout, 200, 'owner logout');

    const staleSession = await request(baseUrl, '/api/auth/me', { cookie: owner.cookie });
    expectStatus(staleSession, 401, 'logged-out owner session');
  });

}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

async function cleanupDatabase(stateDirectory, runtimeDirectory, cleanupFile, fixture) {
  const sql = `PRAGMA foreign_keys = ON;
BEGIN TRANSACTION;
DELETE FROM sessions WHERE user_id IN (
  SELECT id FROM users WHERE email IN (${sqlString(fixture.ownerEmail)}, ${sqlString(fixture.editorEmail)})
);
DELETE FROM posts WHERE slug IN (${sqlString(fixture.editorPostSlug)}, ${sqlString(fixture.ownerPostSlug)});
DELETE FROM invites
WHERE invited_email IN (${sqlString(fixture.editorEmail)}, ${sqlString(fixture.unauthorizedInviteEmail)})
   OR created_by IN (
     SELECT id FROM users WHERE email IN (${sqlString(fixture.ownerEmail)}, ${sqlString(fixture.editorEmail)})
   );
DELETE FROM users WHERE email IN (${sqlString(fixture.ownerEmail)}, ${sqlString(fixture.editorEmail)});
DELETE FROM login_attempts WHERE email IN (${sqlString(fixture.ownerEmail)}, ${sqlString(fixture.editorEmail)});
DELETE FROM settings WHERE key = 'setup_completed' AND NOT EXISTS (SELECT 1 FROM users WHERE role = 'owner');
COMMIT;
`;
  await writeFile(cleanupFile, sql, { encoding: 'utf8', mode: 0o600 });
  await runWrangler([
    'd1',
    'execute',
    'ember-db',
    '--local',
    '--persist-to',
    stateDirectory,
    '--file',
    cleanupFile,
  ], 'Smoke database cleanup', { cwd: runtimeDirectory });
}

function assertTemporaryDirectory(pathname) {
  const resolvedPath = resolve(pathname);
  const temporaryRoot = resolve(tmpdir());
  assert.ok(resolvedPath.startsWith(`${temporaryRoot}${sep}`), 'Refusing to remove a path outside the OS temp directory.');
  assert.ok(basename(resolvedPath).startsWith(temporaryPrefix), 'Refusing to remove a non-smoke temporary directory.');
}

async function main() {
  const { port: requestedPort } = parseArguments(process.argv.slice(2));
  if (!existsSync(wranglerEntry)) {
    throw new Error('Wrangler is not installed. Run `npm install` first.');
  }
  if (!existsSync(workerEntry)) {
    throw new Error('dist-pages/_worker.js is missing. Run `npm run build` first.');
  }

  const runId = `${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`;
  const fixture = {
    runId,
    setupKey: randomSecret(24),
    sessionSecret: randomSecret(48),
    ownerEmail: `owner-${runId}@example.test`,
    ownerDisplayName: `Smoke Owner ${runId}`,
    ownerPassword: `Owner-${randomSecret(18)}!1a`,
    editorEmail: `editor-${runId}@example.test`,
    unauthorizedInviteEmail: `other-${runId}@example.test`,
    editorDisplayName: `Smoke Editor ${runId}`,
    editorPassword: `Editor-${randomSecret(18)}!1a`,
    editorPostSlug: `smoke-${runId}-editor-post`,
    editorPostTitle: `Smoke published post ${runId}`,
    ownerPostSlug: `smoke-${runId}-owner-post`,
    ownerPostTitle: `Smoke owner draft ${runId}`,
    bodyMarker: `smoke-body-${runId}`,
  };
  fixture.ownerSetup = {
    setupKey: fixture.setupKey,
    username: fixture.ownerEmail,
    displayName: fixture.ownerDisplayName,
    password: fixture.ownerPassword,
  };

  const temporaryDirectory = await mkdtemp(join(tmpdir(), temporaryPrefix));
  assertTemporaryDirectory(temporaryDirectory);
  const stateDirectory = join(temporaryDirectory, 'wrangler-state');
  const envFile = join(temporaryDirectory, '.dev.vars');
  const cleanupFile = join(temporaryDirectory, 'cleanup.sql');
  await mkdir(stateDirectory, { recursive: true });
  await copyFile(join(projectRoot, 'wrangler.toml'), join(temporaryDirectory, 'wrangler.toml'));
  await cp(join(projectRoot, 'migrations'), join(temporaryDirectory, 'migrations'), { recursive: true });
  await writeFile(
    envFile,
    `INITIAL_SETUP_KEY=${fixture.setupKey}\nSESSION_SECRET=${fixture.sessionSecret}\nENVIRONMENT=production\n`,
    { encoding: 'utf8', mode: 0o600 },
  );

  let pagesServer;
  let databaseReady = false;
  let failure;
  const cleanupFailures = [];
  try {
    console.log(`[smoke] run ${runId}`);
    console.log('[smoke] applying migrations to isolated local D1 state');
    await runWrangler([
      'd1',
      'migrations',
      'apply',
      'ember-db',
      '--local',
      '--persist-to',
      stateDirectory,
    ], 'Local D1 migrations', { cwd: temporaryDirectory });
    databaseReady = true;

    const port = await availablePort(requestedPort);
    let inspectorPort = await availablePort();
    while (inspectorPort === port) inspectorPort = await availablePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    pagesServer = startPagesServer({ port, inspectorPort, stateDirectory, runtimeDirectory: temporaryDirectory });
    await waitForServer(baseUrl, pagesServer);
    console.log(`[smoke] Pages ready at ${baseUrl}`);

    await runSmoke(baseUrl, fixture);
  } catch (error) {
    failure = error;
    if (pagesServer?.serverOutput()) {
      console.error(`[smoke] Wrangler log tail:\n${pagesServer.serverOutput()}`);
    }
  } finally {
    try {
      await stopPagesServer(pagesServer);
    } catch (error) {
      cleanupFailures.push(error);
    }
    if (databaseReady) {
      try {
        await cleanupDatabase(stateDirectory, temporaryDirectory, cleanupFile, fixture);
        console.log('[smoke] exact fixture cleanup completed');
      } catch (error) {
        cleanupFailures.push(error);
      }
    }
    try {
      assertTemporaryDirectory(temporaryDirectory);
      await rm(temporaryDirectory, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch (error) {
      cleanupFailures.push(error);
    }
  }

  if (failure) {
    if (cleanupFailures.length) {
      console.error(`[smoke] cleanup also failed: ${cleanupFailures.map(String).join('; ')}`);
    }
    throw failure;
  }
  if (cleanupFailures.length) throw new AggregateError(cleanupFailures, 'Smoke cleanup failed.');
  console.log('[smoke] PASS - all Cloudflare Pages/D1 checks completed');
}

main().catch((error) => {
  console.error(`[smoke] FAIL - ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
  process.exitCode = 1;
});
