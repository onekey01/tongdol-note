import { db } from "./db";

const SESSION_DAYS = 30;

export type SessionUser = {
  id: number;
  login_id: string;
  name: string;
  role: string;
  /** 한 사람이 역할을 여럿 가질 수 있습니다. JSON 배열 문자열. */
  roles: string | null;
};

export async function hashPassword(pw: string) {
  return Bun.password.hash(pw);
}

export async function verifyPassword(pw: string, hash: string) {
  try {
    return await Bun.password.verify(pw, hash);
  } catch {
    return false;
  }
}

export function createSession(userId: number): string {
  const token = crypto.randomUUID() + crypto.randomUUID().replaceAll("-", "");
  const now = new Date();
  const exp = new Date(now.getTime() + SESSION_DAYS * 86400_000);
  db.run(
    "INSERT INTO session (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
    [token, userId, now.toISOString(), exp.toISOString()]
  );
  return token;
}

export function destroySession(token: string) {
  db.run("DELETE FROM session WHERE token = ?", [token]);
}

/** 만료된 세션을 치웁니다. 서버가 뜰 때 한 번 부릅니다. */
export function purgeExpiredSessions() {
  db.run("DELETE FROM session WHERE expires_at < ?", [new Date().toISOString()]);
}

export function readCookie(req: Request, name: string): string | null {
  const raw = req.headers.get("cookie");
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

export function currentUser(req: Request): SessionUser | null {
  const token = readCookie(req, "ck_session");
  if (!token) return null;

  const row = db
    .query<
      { id: number; login_id: string; name: string; role: string; roles: string | null; expires_at: string; status: string },
      [string]
    >(
      `SELECT u.id, u.login_id, u.name, u.role, u.roles, u.status, s.expires_at
         FROM session s JOIN app_user u ON u.id = s.user_id
        WHERE s.token = ?`
    )
    .get(token);

  if (!row) return null;
  if (row.status !== "active") return null;
  if (new Date(row.expires_at) < new Date()) {
    destroySession(token);
    return null;
  }
  return { id: row.id, login_id: row.login_id, name: row.name, role: row.role, roles: row.roles };
}

export function sessionCookie(token: string) {
  const maxAge = SESSION_DAYS * 86400;
  // 로컬(127.0.0.1)에서만 도는 프로그램이라 Secure 는 붙이지 않습니다.
  return `ck_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

export const CLEAR_COOKIE = "ck_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";
