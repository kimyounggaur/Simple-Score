import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../lib/auth";
import { updateUserBillingProfile } from "../../../../lib/db";
import {
  buildBillingProfileFromCustomer,
  getStripeServerClient,
  isStripeConfigured,
} from "../../../../lib/stripe";

export const runtime = "nodejs";

function jsonResponse(payload, init) {
  const response = NextResponse.json(payload, init);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function POST() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return jsonResponse({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  if (currentUser.role === "admin") {
    return jsonResponse(
      { error: "관리자 계정은 결제 동기화 대상이 아닙니다." },
      { status: 400 },
    );
  }

  if (!isStripeConfigured()) {
    return jsonResponse(
      { error: "Stripe 설정이 아직 완료되지 않았습니다." },
      { status: 503 },
    );
  }

  if (!currentUser.stripeCustomerId) {
    return jsonResponse(
      { error: "연결된 결제 고객 정보가 없습니다." },
      { status: 400 },
    );
  }

  try {
    const stripe = getStripeServerClient();
    const billingProfile = await buildBillingProfileFromCustomer(
      currentUser,
      stripe,
    );
    const user = await updateUserBillingProfile(currentUser.id, billingProfile);

    return jsonResponse({
      message: "결제 상태를 새로고침했습니다.",
      user,
    });
  } catch (error) {
    console.error(error);
    return jsonResponse(
      { error: "결제 상태를 동기화하는 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
