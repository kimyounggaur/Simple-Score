"use client";

import { useEffect } from "react";

const LEGACY_SCRIPTS = [
  "https://unpkg.com/@lottiefiles/lottie-player@latest/dist/lottie-player.js",
  "https://cdn.jsdelivr.net/npm/vexflow@4.2.2/build/cjs/vexflow.js",
  "https://cdn.rawgit.com/danigb/soundfont-player/master/dist/soundfont-player.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js",
  "/app.js",
];

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-legacy-src="${src}"]`);

    if (existing?.dataset.loaded === "true") {
      resolve();
      return;
    }

    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.dataset.legacySrc = src;
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));

    document.body.appendChild(script);
  });
}

export default function LegacyScripts() {
  useEffect(() => {
    if (window.__lessonDesignerLegacyBootstrapped) return;

    window.__lessonDesignerLegacyBootstrapped = true;
    let cancelled = false;

    async function loadLegacyScripts() {
      try {
        for (const src of LEGACY_SCRIPTS) {
          if (cancelled) return;
          await loadScript(src);
        }
      } catch (error) {
        window.__lessonDesignerLegacyBootstrapped = false;
        console.error(error);
      }
    }

    loadLegacyScripts();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
