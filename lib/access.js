export const ACCESS_LEVELS = {
  guest: "guest",
  member: "member",
  paid: "paid",
};

const PAID_BILLING_STATUSES = new Set(["active", "trialing"]);

export function normalizeStoredAccessTier(role, accessTier) {
  if (role === "admin") {
    return ACCESS_LEVELS.paid;
  }

  return accessTier === ACCESS_LEVELS.paid
    ? ACCESS_LEVELS.paid
    : ACCESS_LEVELS.member;
}

export function getAccessTierFromBillingStatus(role, billingStatus) {
  if (role === "admin") {
    return ACCESS_LEVELS.paid;
  }

  return PAID_BILLING_STATUSES.has(billingStatus)
    ? ACCESS_LEVELS.paid
    : ACCESS_LEVELS.member;
}

export function resolveAccessLevel(user) {
  if (!user) {
    return ACCESS_LEVELS.guest;
  }

  return normalizeStoredAccessTier(user.role, user.accessTier);
}

export function getAccessBadgeLabel(level) {
  switch (level) {
    case ACCESS_LEVELS.paid:
      return "유료";
    case ACCESS_LEVELS.member:
      return "회원";
    default:
      return "체험";
  }
}

export function getAccessSummary(level, userRole = "guest") {
  if (userRole === "admin") {
    return "관리자 전체 기능";
  }

  switch (level) {
    case ACCESS_LEVELS.paid:
      return "모든 기능 사용";
    case ACCESS_LEVELS.member:
      return "편집기 사용";
    default:
      return "기본 입력 체험";
  }
}

export function getAccessFeatureList(level, userRole = "guest") {
  if (userRole === "admin" || level === ACCESS_LEVELS.paid) {
    return [
      "음표, 쉼표, 가사, 코드 입력",
      "PDF 내보내기",
      "재생, 설정, 레이아웃, 확장 편집 기능",
    ];
  }

  if (level === ACCESS_LEVELS.member) {
    return [
      "음표, 쉼표, 가사, 코드 입력",
      "재생, 메트로놈, 스트럼/반복/표현 기호",
      "PNG/PDF 내보내기",
    ];
  }

  return [
    "음표, 쉼표, 가사, 코드 입력",
    "로그인 후 PDF 내보내기 가능",
    "유료 전용 고급 기능은 잠금",
  ];
}

export function buildAccessProfile(user) {
  const level = resolveAccessLevel(user);
  const isLoggedIn = Boolean(user);
  const isAdmin = user?.role === "admin";

  return {
    level,
    isLoggedIn,
    isAdmin,
    permissions: {
      basicEntry: true,
      pdfExport: isLoggedIn,
      fullTools: isLoggedIn,
    },
    labels: {
      badge: getAccessBadgeLabel(level),
      summary: getAccessSummary(level, user?.role),
      role: isAdmin ? "관리자" : isLoggedIn ? "회원" : "비회원",
    },
    features: getAccessFeatureList(level, user?.role),
  };
}
