import { describe, expect, it } from 'vitest';
import type { D1DatabaseLike, D1PreparedStatementLike, D1ResultLike } from '../db';
import {
  completeSuccessfulLogin,
  failedLoginCount,
  reserveLoginAttempt,
} from './login-rate-limit';

function fakeDatabase(options: { count?: number; reservationId?: number | null } = {}) {
  const calls: Array<{ sql: string; bindings: unknown[] }> = [];
  const db: D1DatabaseLike = {
    prepare(sql) {
      const call = { sql, bindings: [] as unknown[] };
      calls.push(call);
      const statement: D1PreparedStatementLike = {
        bind(...values) {
          call.bindings = values;
          return statement;
        },
        async first<T>() {
          return { count: options.count ?? 0 } as T;
        },
        async all<T>() {
          return { results: [] as T[], success: true, meta: {} };
        },
        async run<T>() {
          const results = sql.includes('RETURNING id') && options.reservationId !== null
            ? [{ id: options.reservationId ?? 42 }] as T[]
            : [] as T[];
          return { results, success: true, meta: { changes: results.length || 1 } } as D1ResultLike<T>;
        },
      };
      return statement;
    },
    async batch(statements) {
      return Promise.all(statements.map((statement) => statement.run()));
    },
  };
  return { db, calls };
}

describe('login rate limiting', () => {
  it('checks only the client IP so an attacker cannot lock a named account remotely', async () => {
    const fake = fakeDatabase({ count: 4 });
    await expect(failedLoginCount(fake.db, 'ip-hash', '2026-09-11T00:00:00.000Z')).resolves.toBe(4);

    expect(fake.calls[0].sql).toContain('ip_hash = ?');
    expect(fake.calls[0].sql).not.toContain('OR email = ?');
    expect(fake.calls[0].bindings).toEqual(['2026-09-11T00:00:00.000Z', 'ip-hash']);
  });

  it('reserves an attempt with an atomic threshold check before password hashing', async () => {
    const fake = fakeDatabase({ reservationId: 42 });
    await expect(reserveLoginAttempt(fake.db, {
      ipHash: 'ip-hash',
      email: 'owner@example.test',
      attemptedAt: '2026-09-11T00:15:00.000Z',
      windowStart: '2026-09-11T00:00:00.000Z',
      cleanupBefore: '2026-09-10T00:15:00.000Z',
      maximum: 5,
    })).resolves.toBe(42);

    expect(fake.calls[0].sql).toContain('INSERT INTO login_attempts');
    expect(fake.calls[0].sql).toContain('SELECT ?, ?, ?, 0');
    expect(fake.calls[0].sql).toContain('COUNT(*)');
    expect(fake.calls[0].sql).toContain('RETURNING id');
    expect(fake.calls[0].bindings).toEqual([
      'ip-hash',
      'owner@example.test',
      '2026-09-11T00:15:00.000Z',
      '2026-09-11T00:00:00.000Z',
      'ip-hash',
      5,
    ]);
    expect(fake.calls[1].sql).toContain('attempted_at < ?');
  });

  it('does not clear failures after a successful login', async () => {
    const fake = fakeDatabase();
    await completeSuccessfulLogin(fake.db, {
      attemptId: 42,
      attemptedAt: '2026-09-11T00:15:00.000Z',
    });

    expect(fake.calls[0].sql).toContain('SET successful = 1');
    expect(fake.calls[0].bindings).toEqual([42]);
    expect(fake.calls.some((call) => /DELETE[\s\S]+(?:ip_hash|email)\s*=\s*\?/i.test(call.sql))).toBe(false);
    expect(fake.calls.some((call) => call.sql.includes('DELETE FROM sessions'))).toBe(true);
  });
});
