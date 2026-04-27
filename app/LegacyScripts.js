"use client";

import { useEffect } from "react";

const LEGACY_SCRIPTS = [
  {
    src: "https://unpkg.com/@lottiefiles/lottie-player@latest/dist/lottie-player.js",
    optional: true,
  },
  {
    src: "https://cdn.jsdelivr.net/npm/vexflow@4.2.2/build/cjs/vexflow.js",
    optional: false,
  },
  {
    src: "https://cdn.jsdelivr.net/npm/soundfont-player@0.15.7/dist/soundfont-player.min.js",
    optional: true,
  },
  {
    src: "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
    optional: true,
  },
  {
    src: "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js",
    optional: true,
  },
  { src: "/app.js", optional: false },
];

const SCRIPT_LOAD_TIMEOUT_MS = 7000;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-legacy-src="${src}"]`);

    if (existing?.dataset.loaded === "true") {
      resolve();
      return;
    }

    if (existing) {
      const timer = window.setTimeout(() => {
        reject(new Error(`Timed out loading script: ${src}`));
      }, SCRIPT_LOAD_TIMEOUT_MS);
      existing.addEventListener(
        "load",
        () => {
          window.clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
      existing.addEventListener(
        "error",
        () => {
          window.clearTimeout(timer);
          reject(new Error(`Failed to load script: ${src}`));
        },
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.dataset.legacySrc = src;
    const timer = window.setTimeout(() => {
      reject(new Error(`Timed out loading script: ${src}`));
    }, SCRIPT_LOAD_TIMEOUT_MS);
    script.onload = () => {
      window.clearTimeout(timer);
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error(`Failed to load script: ${src}`));
    };

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
        for (const { src, optional } of LEGACY_SCRIPTS) {
          if (cancelled) return;
          try {
            await loadScript(src);
          } catch (error) {
            console.error(error);
            if (!optional) throw error;
          }
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
