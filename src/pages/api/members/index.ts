import type { APIRoute } from 'astro';
import type { Role } from '../../../lib/db';
import { authorizeRead, errorResponse, json } from '../../../lib/auth/http';

export const prerender = false;

interface MemberRow {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  active: number;
  createdAt: string;
  updatedAt: string;
}

export const GET: APIRoute = async (context) => {
  try {
    const auth = await authorizeRead(context, 'owner');
    if (auth instanceof Response) return auth;
    const result = await auth.db.prepare(
      `SELECT id, email, display_name AS displayName, role, active,
        created_at AS createdAt, updated_at AS updatedAt
       FROM users ORDER BY CASE role WHEN 'owner' THEN 0 ELSE 1 END, created_at ASC`,
    ).all<MemberRow>();
    return json({
      members: result.results.map((member) => ({
        ...member,
        username: member.email,
        active: Boolean(member.active),
        status: member.active ? 'active' : 'suspended',
      })),
    });
  } catch {
    return errorResponse(500, '成员列表读取失败。');
  }
};

