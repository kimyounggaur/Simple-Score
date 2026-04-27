import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { writeSessionCookie } from "../../../../lib/auth";
import { createUser, toPublicUser } from "../../../../lib/db";
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
  const ip = getClientIp(request);
  const rate = takeRateLimitToken(`register:${ip}`, {
    limit: 8,
    windowMs: 10 * 60 * 1000,
  });

  if (!rate.allowed) {
    return jsonResponse(
      {
        error: `가입 시도가 많습니다. ${rate.retryAfterSeconds}초 뒤 다시 시도해 주세요.`,
      },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);

  if (!body) {
    return jsonResponse({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }

  const nameIssue = validateDisplayName(body.name);
  const email = normalizeEmail(body.email);
  const passwordIssues = validatePassword(body.password);

  if (nameIssue) {
    return jsonResponse({ error: nameIssue }, { status: 400 });
  }

  if (!validateEmail(email)) {
    return jsonResponse(
      { error: "올바른 이메일 주소를 입력해 주세요." },
      { status: 400 },
    );
  }

  if (passwordIssues.length > 0) {
    return jsonResponse({ error: passwordIssues[0] }, { status: 400 });
  }

  try {
    const { passwordHash, passwordSalt } = hashPassword(body.password);
    const user = await createUser({
      name: body.name,
      email,
      passwordHash,
      passwordSalt,
      role: "member",
      status: "active",
      accessTier: "member",
    });
    const cookieStore = await cookies();

    await writeSessionCookie(cookieStore, user);

    return jsonResponse(
      {
        message: "회원가입이 완료되었습니다.",
        user: toPublicUser(user),
      },
      { status: 201 },
    );
  } catch (error) {
    if (error.message === "EMAIL_IN_USE") {
      return jsonResponse(
        { error: "이미 가입된 이메일입니다." },
        { status: 409 },
      );
    }

    console.error(error);
    return jsonResponse(
      { error: "회원가입 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
