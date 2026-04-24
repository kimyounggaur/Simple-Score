import Stripe from "stripe";
import { getAccessTierFromBillingStatus } from "./access";

let stripeClient = null;
const SUBSCRIPTION_STATUS_PRIORITY = {
  active: 5,
  trialing: 4,
  past_due: 3,
  unpaid: 2,
  canceled: 1,
  incomplete: 1,
  incomplete_expired: 0,
  paused: 0,
};

function trimEnv(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function getStripeSecretKey() {
  return trimEnv(process.env.STRIPE_SECRET_KEY);
}

export function getStripePriceId() {
  return trimEnv(process.env.STRIPE_PRICE_ID);
}

export function getStripeWebhookSecret() {
  return trimEnv(process.env.STRIPE_WEBHOOK_SECRET);
}

export function getStripeAppUrl() {
  return trimEnv(process.env.NEXT_PUBLIC_APP_URL) || trimEnv(process.env.APP_URL);
}

export function isStripeConfigured() {
  return Boolean(getStripeSecretKey() && getStripePriceId());
}

export function isStripeWebhookConfigured() {
  return Boolean(getStripeSecretKey() && getStripeWebhookSecret());
}

export function getStripeSetupStatus() {
  const appUrl = getStripeAppUrl();
  const secretKey = getStripeSecretKey();
  const priceId = getStripePriceId();
  const webhookSecret = getStripeWebhookSecret();
  const normalizedAppUrl = appUrl ? appUrl.replace(/\/+$/, "") : "";
  const webhookUrl = normalizedAppUrl
    ? `${normalizedAppUrl}/api/webhooks/stripe`
    : "";

  return {
    appUrl: normalizedAppUrl,
    webhookUrl,
    checkoutReady: Boolean(normalizedAppUrl && secretKey && priceId),
    webhookReady: Boolean(normalizedAppUrl && secretKey && webhookSecret),
    items: [
      {
        key: "appUrl",
        label: "앱 URL",
        value: normalizedAppUrl,
        ready: Boolean(normalizedAppUrl),
        help: "Render에 배포된 실제 도메인 또는 로컬 테스트 URL입니다.",
      },
      {
        key: "secretKey",
        label: "STRIPE_SECRET_KEY",
        value: secretKey ? `${secretKey.slice(0, 8)}...` : "",
        ready: Boolean(secretKey),
        help: "Stripe 비밀키입니다. Checkout, Portal, Webhook 검증에 모두 필요합니다.",
      },
      {
        key: "priceId",
        label: "STRIPE_PRICE_ID",
        value: priceId,
        ready: Boolean(priceId),
        help: "유료 플랜에 연결할 Stripe Price ID입니다.",
      },
      {
        key: "webhookSecret",
        label: "STRIPE_WEBHOOK_SECRET",
        value: webhookSecret ? `${webhookSecret.slice(0, 8)}...` : "",
        ready: Boolean(webhookSecret),
        help: "Stripe Dashboard에서 생성한 webhook signing secret입니다.",
      },
    ],
  };
}

export function getStripeServerClient() {
  const secretKey = getStripeSecretKey();

  if (!secretKey) {
    throw new Error("STRIPE_NOT_CONFIGURED");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey);
  }

  return stripeClient;
}

export function getAppOrigin(request) {
  const explicitOrigin = getStripeAppUrl();

  if (explicitOrigin) {
    return explicitOrigin.replace(/\/+$/, "");
  }

  const forwardedProto = trimEnv(request.headers.get("x-forwarded-proto"));
  const forwardedHost = trimEnv(request.headers.get("x-forwarded-host"));

  if (forwardedHost) {
    return `${forwardedProto || "https"}://${forwardedHost}`;
  }

  return new URL(request.url).origin;
}

export function getBillingUrls(request) {
  const origin = getAppOrigin(request);

  return {
    origin,
    successUrl: `${origin}/?billing=success`,
    cancelUrl: `${origin}/?billing=cancel`,
    returnUrl: `${origin}/?billing=return`,
  };
}

export function unixSecondsToIso(value) {
  return Number.isFinite(value) ? new Date(value * 1000).toISOString() : null;
}

export function buildBillingProfileFromSubscription(user, subscription) {
  const priceId = subscription.items?.data?.[0]?.price?.id || null;
  const billingStatus = subscription.status || null;

  return {
    stripeCustomerId:
      typeof subscription.customer === "string" ? subscription.customer : null,
    stripeSubscriptionId: subscription.id || null,
    stripePriceId: priceId,
    billingStatus,
    billingCurrentPeriodEnd: unixSecondsToIso(subscription.current_period_end),
    accessTier: getAccessTierFromBillingStatus(user?.role, billingStatus),
  };
}

export function buildBillingProfileWithoutSubscription(user) {
  return {
    stripeCustomerId: user?.stripeCustomerId || null,
    stripeSubscriptionId: null,
    stripePriceId: null,
    billingStatus: null,
    billingCurrentPeriodEnd: null,
    accessTier: getAccessTierFromBillingStatus(user?.role, null),
  };
}

function getSubscriptionSortValue(subscription) {
  const priority = SUBSCRIPTION_STATUS_PRIORITY[subscription?.status] ?? 0;
  const createdAt = Number(subscription?.created || 0);
  const periodEnd = Number(subscription?.current_period_end || 0);

  return { priority, createdAt, periodEnd };
}

export function pickBestSubscription(subscriptions = [], preferredId = "") {
  if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
    return null;
  }

  if (preferredId) {
    const preferred = subscriptions.find(
      (subscription) => subscription?.id === preferredId,
    );

    if (preferred) {
      return preferred;
    }
  }

  return [...subscriptions].sort((left, right) => {
    const leftValue = getSubscriptionSortValue(left);
    const rightValue = getSubscriptionSortValue(right);

    if (rightValue.priority !== leftValue.priority) {
      return rightValue.priority - leftValue.priority;
    }

    if (rightValue.periodEnd !== leftValue.periodEnd) {
      return rightValue.periodEnd - leftValue.periodEnd;
    }

    return rightValue.createdAt - leftValue.createdAt;
  })[0];
}

export async function buildBillingProfileFromCustomer(user, stripe) {
  if (!user?.stripeCustomerId) {
    return buildBillingProfileWithoutSubscription(user);
  }

  if (user.stripeSubscriptionId) {
    try {
      const subscription = await stripe.subscriptions.retrieve(
        user.stripeSubscriptionId,
      );

      if (subscription?.id) {
        return buildBillingProfileFromSubscription(user, subscription);
      }
    } catch (error) {
      if (error?.code !== "resource_missing") {
        throw error;
      }
    }
  }

  const subscriptions = await stripe.subscriptions.list({
    customer: user.stripeCustomerId,
    status: "all",
    limit: 10,
  });
  const selectedSubscription = pickBestSubscription(
    subscriptions.data,
    user.stripeSubscriptionId,
  );

  if (!selectedSubscription) {
    return buildBillingProfileWithoutSubscription(user);
  }

  return buildBillingProfileFromSubscription(user, selectedSubscription);
}
