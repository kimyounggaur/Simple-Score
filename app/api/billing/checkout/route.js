import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../lib/auth";
import { updateUserBillingProfile } from "../../../../lib/db";
import {
  getBillingUrls,
  getStripePriceId,
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

  if (currentUser.role === "admin") {
    return jsonResponse(
      { error: "관리자 계정은 결제 없이 전체 기능을 사용할 수 있습니다." },
      { status: 400 },
    );
  }

  if (!isStripeConfigured()) {
    return jsonResponse(
      { error: "Stripe 설정이 아직 완료되지 않았습니다." },
      { status: 503 },
    );
  }

  const stripe = getStripeServerClient();
  const urls = getBillingUrls(request);
  const priceId = getStripePriceId();
  let customerId = currentUser.stripeCustomerId;

  try {
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: currentUser.email,
        name: currentUser.name,
        metadata: {
          userId: currentUser.id,
        },
      });

      customerId = customer.id;
      await updateUserBillingProfile(currentUser.id, {
        stripeCustomerId: customer.id,
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: currentUser.id,
      success_url: urls.successUrl,
      cancel_url: urls.cancelUrl,
      allow_promotion_codes: true,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      metadata: {
        userId: currentUser.id,
      },
      subscription_data: {
        metadata: {
          userId: currentUser.id,
        },
      },
    });

    return jsonResponse({
      url: session.url,
      id: session.id,
    });
  } catch (error) {
    console.error(error);
    return jsonResponse(
      { error: "결제 세션 생성 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
