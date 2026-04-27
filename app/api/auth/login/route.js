import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { writeSessionCookie } from "../../../../lib/auth";
import {
  findUserByEmail,
  hasAdminUser,
  promoteUserToAdmin,
  toPublicUser,
  touchUserLastLogin,
} from "../../../../lib/db";
import {
  getClientIp,
  normalizeEmail,
  takeRateLimitToken,
  verifyPassword,
} from "../../../../lib/security";

function jsonResponse(payload, init) {
  const response = NextResponse.json(payload, init);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function POST(request) {
  const body = await request.json().catch(() => null);

  if (!body?.email || !body?.password) {
    return jsonResponse(
      { error: "이메일과 비밀번호를 입력해 주세요." },
      { status: 400 },
    );
  }

  const email = normalizeEmail(body.email);
  const loginType = body.loginType === "admin" ? "admin" : "member";
  const ip = getClientIp(request);
  const rate = takeRateLimitToken(`login:${loginType}:${ip}:${email}`, {
    limit: 6,
    windowMs: 10 * 60 * 1000,
  });

  if (!rate.allowed) {
    return jsonResponse(
      {
        error: `로그인 시도가 많습니다. ${rate.retryAfterSeconds}초 뒤 다시 시도해 주세요.`,
      },
      { status: 429 },
    );
  }

  let user = await findUserByEmail(email);

  if (!user || !verifyPassword(body.password, user.passwordHash, user.passwordSalt)) {
    return jsonResponse(
      { error: "이메일 또는 비밀번호가 올바르지 않습니다." },
      { status: 401 },
    );
  }

  if (user.status !== "active") {
    return jsonResponse(
      { error: "비활성화된 계정입니다. 관리자에게 문의해 주세요." },
      { status: 403 },
    );
  }

  if (loginType === "admin" && user.role !== "admin") {
    if (await hasAdminUser()) {
      return jsonResponse(
        { error: "관리자 권한이 없는 계정입니다." },
        { status: 403 },
      );
    }

    user = await promoteUserToAdmin(user.id);
  }

  const updatedUser = await touchUserLastLogin(user.id);
  const cookieStore = await cookies();
  await writeSessionCookie(cookieStore, updatedUser);

  return jsonResponse({
    message: "로그인되었습니다.",
    user: toPublicUser(updatedUser),
  });
}
