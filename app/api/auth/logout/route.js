import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { clearSessionCookie } from "../../../../lib/auth";

function jsonResponse(payload, init) {
  const response = NextResponse.json(payload, init);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function POST() {
  const cookieStore = await cookies();
  clearSessionCookie(cookieStore);

  return jsonResponse({
    message: "로그아웃되었습니다.",
  });
}
