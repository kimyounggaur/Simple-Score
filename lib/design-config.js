const DEFAULT_SIGNALS = [
  { label: "Workspace", value: "Score Editor" },
  { label: "Access", value: "Member + Admin" },
  { label: "Session", value: "Protected" },
];

const DEFAULT_HINTS = [
  "Move to the editor right after sign in.",
  "Admin accounts continue to the operations console.",
];

export const DEFAULT_LANDING_PAGE_DESIGN = {
  brandName: "Simple Score",
  brandMeta: "Secure music workspace",
  heroEyebrow: "Simple Score Access",
  heroTitle: "A sharper entrance for every score session.",
  heroText:
    "Bring editing focus, admin access, and a quiet security flow into one landing page.",
  panelEyebrow: "Account Console",
  panelTitle: "Secure Account Center",
  panelStatusLabel: "Login required",
  primaryActionLabel: "Member Login",
  secondaryActionLabel: "Editor Home",
  previewEmail: "augusrush@naver.com",
  previewPassword: "**********",
  backgroundImage:
    "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1800&q=80",
  signals: DEFAULT_SIGNALS,
  hints: DEFAULT_HINTS,
  colors: {
    pageBg: "#05070b",
    accent: "#93c5fd",
    textPrimary: "#f8fafc",
    textSecondary: "rgba(226, 232, 240, 0.86)",
    mutedText: "rgba(226, 232, 240, 0.68)",
    topButtonBg: "rgba(255, 255, 255, 0.04)",
    topButtonBorder: "rgba(255, 255, 255, 0.16)",
    panelBg: "rgba(9, 13, 20, 0.78)",
    panelBorder: "rgba(255, 255, 255, 0.12)",
    panelText: "#f8fafc",
    inputBg: "rgba(255, 255, 255, 0.08)",
    inputText: "#ffffff",
    primaryButtonBg: "#ffffff",
    primaryButtonText: "#020617",
    secondaryButtonBg: "rgba(255, 255, 255, 0.08)",
    secondaryButtonText: "#f8fafc",
    signalCardBg: "rgba(8, 12, 18, 0.4)",
    signalCardBorder: "rgba(255, 255, 255, 0.14)",
  },
  layout: {
    contentMaxWidth: 1360,
    contentGap: 36,
    heroTitleMaxWidth: 760,
    heroTextMaxWidth: 580,
    panelWidth: 460,
    heroOffsetX: 0,
    heroOffsetY: 0,
    panelOffsetX: 0,
    panelOffsetY: 0,
  },
};

function ensureString(value, fallback) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function ensureColor(value, fallback) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function ensureNumber(value, fallback, min, max) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

function normalizeSignals(value) {
  const source = Array.isArray(value) ? value : [];

  return DEFAULT_SIGNALS.map((fallback, index) => {
    const current =
      source[index] && typeof source[index] === "object" ? source[index] : {};

    return {
      label: ensureString(current.label, fallback.label),
      value: ensureString(current.value, fallback.value),
    };
  });
}

function normalizeHints(value) {
  const source = Array.isArray(value) ? value : [];

  return DEFAULT_HINTS.map((fallback, index) =>
    ensureString(source[index], fallback),
  );
}

export function normalizeLandingPageDesign(value = {}) {
  const colors = value.colors && typeof value.colors === "object" ? value.colors : {};
  const layout = value.layout && typeof value.layout === "object" ? value.layout : {};

  return {
    brandName: ensureString(value.brandName, DEFAULT_LANDING_PAGE_DESIGN.brandName),
    brandMeta: ensureString(value.brandMeta, DEFAULT_LANDING_PAGE_DESIGN.brandMeta),
    heroEyebrow: ensureString(
      value.heroEyebrow,
      DEFAULT_LANDING_PAGE_DESIGN.heroEyebrow,
    ),
    heroTitle: ensureString(value.heroTitle, DEFAULT_LANDING_PAGE_DESIGN.heroTitle),
    heroText: ensureString(value.heroText, DEFAULT_LANDING_PAGE_DESIGN.heroText),
    panelEyebrow: ensureString(
      value.panelEyebrow,
      DEFAULT_LANDING_PAGE_DESIGN.panelEyebrow,
    ),
    panelTitle: ensureString(value.panelTitle, DEFAULT_LANDING_PAGE_DESIGN.panelTitle),
    panelStatusLabel: ensureString(
      value.panelStatusLabel,
      DEFAULT_LANDING_PAGE_DESIGN.panelStatusLabel,
    ),
    primaryActionLabel: ensureString(
      value.primaryActionLabel,
      DEFAULT_LANDING_PAGE_DESIGN.primaryActionLabel,
    ),
    secondaryActionLabel: ensureString(
      value.secondaryActionLabel,
      DEFAULT_LANDING_PAGE_DESIGN.secondaryActionLabel,
    ),
    previewEmail: ensureString(
      value.previewEmail,
      DEFAULT_LANDING_PAGE_DESIGN.previewEmail,
    ),
    previewPassword: ensureString(
      value.previewPassword,
      DEFAULT_LANDING_PAGE_DESIGN.previewPassword,
    ),
    backgroundImage: ensureString(
      value.backgroundImage,
      DEFAULT_LANDING_PAGE_DESIGN.backgroundImage,
    ),
    signals: normalizeSignals(value.signals),
    hints: normalizeHints(value.hints),
    colors: {
      pageBg: ensureColor(colors.pageBg, DEFAULT_LANDING_PAGE_DESIGN.colors.pageBg),
      accent: ensureColor(colors.accent, DEFAULT_LANDING_PAGE_DESIGN.colors.accent),
      textPrimary: ensureColor(
        colors.textPrimary,
        DEFAULT_LANDING_PAGE_DESIGN.colors.textPrimary,
      ),
      textSecondary: ensureColor(
        colors.textSecondary,
        DEFAULT_LANDING_PAGE_DESIGN.colors.textSecondary,
      ),
      mutedText: ensureColor(
        colors.mutedText,
        DEFAULT_LANDING_PAGE_DESIGN.colors.mutedText,
      ),
      topButtonBg: ensureColor(
        colors.topButtonBg,
        DEFAULT_LANDING_PAGE_DESIGN.colors.topButtonBg,
      ),
      topButtonBorder: ensureColor(
        colors.topButtonBorder,
        DEFAULT_LANDING_PAGE_DESIGN.colors.topButtonBorder,
      ),
      panelBg: ensureColor(colors.panelBg, DEFAULT_LANDING_PAGE_DESIGN.colors.panelBg),
      panelBorder: ensureColor(
        colors.panelBorder,
        DEFAULT_LANDING_PAGE_DESIGN.colors.panelBorder,
      ),
      panelText: ensureColor(
        colors.panelText,
        DEFAULT_LANDING_PAGE_DESIGN.colors.panelText,
      ),
      inputBg: ensureColor(colors.inputBg, DEFAULT_LANDING_PAGE_DESIGN.colors.inputBg),
      inputText: ensureColor(
        colors.inputText,
        DEFAULT_LANDING_PAGE_DESIGN.colors.inputText,
      ),
      primaryButtonBg: ensureColor(
        colors.primaryButtonBg,
        DEFAULT_LANDING_PAGE_DESIGN.colors.primaryButtonBg,
      ),
      primaryButtonText: ensureColor(
        colors.primaryButtonText,
        DEFAULT_LANDING_PAGE_DESIGN.colors.primaryButtonText,
      ),
      secondaryButtonBg: ensureColor(
        colors.secondaryButtonBg,
        DEFAULT_LANDING_PAGE_DESIGN.colors.secondaryButtonBg,
      ),
      secondaryButtonText: ensureColor(
        colors.secondaryButtonText,
        DEFAULT_LANDING_PAGE_DESIGN.colors.secondaryButtonText,
      ),
      signalCardBg: ensureColor(
        colors.signalCardBg,
        DEFAULT_LANDING_PAGE_DESIGN.colors.signalCardBg,
      ),
      signalCardBorder: ensureColor(
        colors.signalCardBorder,
        DEFAULT_LANDING_PAGE_DESIGN.colors.signalCardBorder,
      ),
    },
    layout: {
      contentMaxWidth: ensureNumber(
        layout.contentMaxWidth,
        DEFAULT_LANDING_PAGE_DESIGN.layout.contentMaxWidth,
        960,
        1600,
      ),
      contentGap: ensureNumber(
        layout.contentGap,
        DEFAULT_LANDING_PAGE_DESIGN.layout.contentGap,
        12,
        120,
      ),
      heroTitleMaxWidth: ensureNumber(
        layout.heroTitleMaxWidth,
        DEFAULT_LANDING_PAGE_DESIGN.layout.heroTitleMaxWidth,
        320,
        980,
      ),
      heroTextMaxWidth: ensureNumber(
        layout.heroTextMaxWidth,
        DEFAULT_LANDING_PAGE_DESIGN.layout.heroTextMaxWidth,
        260,
        900,
      ),
      panelWidth: ensureNumber(
        layout.panelWidth,
        DEFAULT_LANDING_PAGE_DESIGN.layout.panelWidth,
        320,
        620,
      ),
      heroOffsetX: ensureNumber(
        layout.heroOffsetX,
        DEFAULT_LANDING_PAGE_DESIGN.layout.heroOffsetX,
        -240,
        240,
      ),
      heroOffsetY: ensureNumber(
        layout.heroOffsetY,
        DEFAULT_LANDING_PAGE_DESIGN.layout.heroOffsetY,
        -240,
        240,
      ),
      panelOffsetX: ensureNumber(
        layout.panelOffsetX,
        DEFAULT_LANDING_PAGE_DESIGN.layout.panelOffsetX,
        -240,
        240,
      ),
      panelOffsetY: ensureNumber(
        layout.panelOffsetY,
        DEFAULT_LANDING_PAGE_DESIGN.layout.panelOffsetY,
        -240,
        240,
      ),
    },
  };
}
