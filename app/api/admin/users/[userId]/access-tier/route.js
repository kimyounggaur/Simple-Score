import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../../../lib/auth";
import { updateUserAccessTier } from "../../../../../../lib/db";

function jsonResponse(payload, init) {
  const response = NextResponse.json(payload, init);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

async function requireAdmin() {
  const currentUser = await getCurrentUser();
  return currentUser && currentUser.role === "admin" ? currentUser : null;
}

export async function PATCH(request, context) {
  const admin = await requireAdmin();

  if (!admin) {
    return jsonResponse({ error: "FORBIDDEN" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const accessTier = body?.accessTier === "paid" ? "paid" : "member";
  const { userId } = await context.params;

  try {
    const user = await updateUserAccessTier(userId, accessTier);
    return jsonResponse({
      message: "이용 등급이 변경되었습니다.",
      user,
    });
  } catch (error) {
    if (error.message === "USER_NOT_FOUND") {
      return jsonResponse({ error: "대상 사용자를 찾을 수 없습니다." }, { status: 404 });
    }

    console.error(error);
    return jsonResponse(
      { error: "이용 등급 변경 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
