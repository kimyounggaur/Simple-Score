import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../lib/auth";
import {
  getBillingUrls,
  getStripeServerClient,
  isStripeConfigured,
} from "../../../../lib/stripe";

export const runtime = "nodejs";

function jsonResponse(payload, init) {
  const response = NextResponse.json(payload, init);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function POST(request) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return jsonResponse({ error: "로그인이 필요합니다." }, { status: 401 });
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
    const { returnUrl } = getBillingUrls(request);
    const session = await stripe.billingPortal.sessions.create({
      customer: currentUser.stripeCustomerId,
      return_url: returnUrl,
    });

    return jsonResponse({
      url: session.url,
    });
  } catch (error) {
    console.error(error);
    return jsonResponse(
      { error: "결제 관리 페이지를 열지 못했습니다." },
      { status: 500 },
    );
  }
}
