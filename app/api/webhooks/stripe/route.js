import { NextResponse } from "next/server";
import {
  findUserById,
  findUserByStripeCustomerId,
  updateUserBillingProfile,
} from "../../../../lib/db";
import {
  buildBillingProfileFromSubscription,
  getStripeServerClient,
  getStripeWebhookSecret,
  isStripeWebhookConfigured,
} from "../../../../lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonResponse(payload, init) {
  const response = NextResponse.json(payload, init);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

async function syncSubscriptionToUser(subscription) {
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : null;
  const metadataUserId = subscription.metadata?.userId || null;
  let user = customerId ? await findUserByStripeCustomerId(customerId) : null;

  if (!user && metadataUserId) {
    user = await findUserById(metadataUserId);
  }

  if (!user) {
    return;
  }

  const billingProfile = buildBillingProfileFromSubscription(user, subscription);

  await updateUserBillingProfile(user.id, billingProfile);
}

async function syncCheckoutSessionToUser(session) {
  const userId = session.client_reference_id || session.metadata?.userId || null;

  if (!userId) {
    return;
  }

  const user = await findUserById(userId);

  if (!user) {
    return;
  }

  await updateUserBillingProfile(user.id, {
    stripeCustomerId:
      typeof session.customer === "string" ? session.customer : user.stripeCustomerId,
    stripeSubscriptionId:
      typeof session.subscription === "string"
        ? session.subscription
        : user.stripeSubscriptionId,
  });
}

export async function POST(request) {
  if (!isStripeWebhookConfigured()) {
    return jsonResponse(
      { error: "Stripe webhook 설정이 아직 완료되지 않았습니다." },
      { status: 503 },
    );
  }

  const stripe = getStripeServerClient();
  const signature = request.headers.get("stripe-signature");
  const payload = await request.text();

  if (!signature) {
    return jsonResponse({ error: "서명 헤더가 없습니다." }, { status: 400 });
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      payload,
      signature,
      getStripeWebhookSecret(),
    );
  } catch (error) {
    console.error("Stripe webhook signature verification failed:", error);
    return jsonResponse({ error: "유효하지 않은 웹훅입니다." }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await syncCheckoutSessionToUser(event.data.object);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscriptionToUser(event.data.object);
        break;
      case "invoice.paid":
      case "invoice.payment_failed": {
        const subscriptionId = event.data.object.subscription;

        if (typeof subscriptionId === "string") {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          await syncSubscriptionToUser(subscription);
        }
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error("Stripe webhook handling failed:", error);
    return jsonResponse(
      { error: "웹훅 처리 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }

  return jsonResponse({ received: true });
}
