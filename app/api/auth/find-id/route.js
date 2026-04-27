import { NextResponse } from "next/server";
import { findUsersByName } from "../../../../lib/db";
import {
  getClientIp,
  takeRateLimitToken,
  validateDisplayName,
} from "../../../../lib/security";

function jsonResponse(payload, init) {
  const response = NextResponse.json(payload, init);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function maskEmail(email = "") {
  const [local = "", domain = ""] = email.split("@");
  const visible = local.slice(0, Math.min(3, local.length));
  const hiddenLength = Math.max(3, local.length - visible.length);

  return `${visible}${"*".repeat(hiddenLength)}@${domain}`;
}

export async function POST(request) {
  const body = await request.json().catch(() => null);
  const ip = getClientIp(request);
  const rate = takeRateLimitToken(`find-id:${ip}`, {
    limit: 8,
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

  const users = await findUsersByName(body.name);

  return jsonResponse({
    matches: users.map((user) => ({
      maskedEmail: maskEmail(user.email),
      role: user.role,
      createdAt: user.createdAt,
    })),
  });
}
