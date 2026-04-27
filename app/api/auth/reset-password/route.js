import { NextResponse } from "next/server";
import { findUserByEmail, updateUserPassword } from "../../../../lib/db";
import {
  getClientIp,
  hashPassword,
  normalizeEmail,
  takeRateLimitToken,
  validateDisplayName,
  validateEmail,
  validatePassword,
} from "../../../../lib/security";

function jsonResponse(payload, init) {
  const response = NextResponse.json(payload, init);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function POST(request) {
  const body = await request.json().catch(() => null);
  const ip = getClientIp(request);
  const email = normalizeEmail(body?.email || "");
  const rate = takeRateLimitToken(`reset-password:${ip}:${email}`, {
    limit: 6,
    windowMs: 10 * 60 * 1000,
  });

  if (!rate.allowed) {
    return jsonResponse(
      {
        error: `요청이 많습니다. ${rate.retryAfterSeconds}초 뒤 다시 시도해 주세요.`,
      },
      { status: 429 },
    );
  }

  const nameIssue = validateDisplayName(body?.name || "");

  if (nameIssue) {
    return jsonResponse({ error: nameIssue }, { status: 400 });
  }

  if (!validateEmail(email)) {
    return jsonResponse(
      { error: "올바른 이메일 주소를 입력해 주세요." },
      { status: 400 },
    );
  }

  const passwordIssues = validatePassword(body?.password || "");

  if (passwordIssues.length > 0) {
    return jsonResponse({ error: passwordIssues[0] }, { status: 400 });
  }

  const user = await findUserByEmail(email);
  const nameMatches =
    user &&
    String(user.name || "").trim().toLowerCase() ===
      String(body.name || "").trim().toLowerCase();

  if (!user || !nameMatches || user.status !== "active") {
    return jsonResponse(
      { error: "입력한 정보와 일치하는 활성 계정을 찾지 못했습니다." },
      { status: 404 },
    );
  }

  const password = hashPassword(body.password);
  await updateUserPassword(user.id, password);

  return jsonResponse({
    message: "비밀번호가 재설정되었습니다. 새 비밀번호로 로그인해 주세요.",
  });
}
