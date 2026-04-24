"use client";

import { useMemo, useState } from "react";
import AuthConsole from "../../auth/AuthConsole";
import styles from "./design.module.css";
import {
  DEFAULT_LANDING_PAGE_DESIGN,
  normalizeLandingPageDesign,
} from "../../../lib/design-config";

function updateByPath(source, path, value) {
  const parts = path.split(".");
  const clone = structuredClone(source);
  let cursor = clone;

  for (let index = 0; index < parts.length - 1; index += 1) {
    cursor = cursor[parts[index]];
  }

  cursor[parts[parts.length - 1]] = value;
  return clone;
}

function getValue(source, path) {
  return path.split(".").reduce((acc, key) => acc[key], source);
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function hexValue(value) {
  return typeof value === "string" && value.startsWith("#") ? value : "#ffffff";
}

export default function DesignEditor({ initialDesign }) {
  const [design, setDesign] = useState(() =>
    normalizeLandingPageDesign(initialDesign),
  );
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const previewDesign = useMemo(
    () => normalizeLandingPageDesign(design),
    [design],
  );

  function handleText(path) {
    return (event) => {
      setDesign((current) => updateByPath(current, path, event.target.value));
    };
  }

  function handleNumber(path) {
    return (event) => {
      setDesign((current) =>
        updateByPath(current, path, toNumber(event.target.value)),
      );
    };
  }

  async function handleSave() {
    setPending(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/admin/design", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ design: previewDesign }),
      });
      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Save failed.");
        return;
      }

      setDesign(normalizeLandingPageDesign(result.design));
      setMessage("Design settings saved.");
    } catch (saveError) {
      console.error(saveError);
      setError("Unable to save design settings.");
    } finally {
      setPending(false);
    }
  }

  function handleReset() {
    setDesign(structuredClone(DEFAULT_LANDING_PAGE_DESIGN));
    setMessage("");
    setError("");
  }

  const colorFields = [
    ["colors.pageBg", "Page background"],
    ["colors.accent", "Accent"],
    ["colors.textPrimary", "Primary text"],
    ["colors.textSecondary", "Secondary text"],
    ["colors.mutedText", "Muted text"],
    ["colors.panelBg", "Panel background"],
    ["colors.panelBorder", "Panel border"],
    ["colors.inputBg", "Input background"],
    ["colors.inputText", "Input text"],
    ["colors.primaryButtonBg", "Primary button background"],
    ["colors.primaryButtonText", "Primary button text"],
    ["colors.secondaryButtonBg", "Secondary button background"],
    ["colors.secondaryButtonText", "Secondary button text"],
    ["colors.signalCardBg", "Signal card background"],
    ["colors.signalCardBorder", "Signal card border"],
  ];

  const rangeFields = [
    ["layout.contentMaxWidth", "Content width", 960, 1600, 10],
    ["layout.contentGap", "Content gap", 12, 120, 2],
    ["layout.heroTitleMaxWidth", "Hero title width", 320, 980, 10],
    ["layout.heroTextMaxWidth", "Hero text width", 260, 900, 10],
    ["layout.panelWidth", "Panel width", 320, 620, 10],
    ["layout.heroOffsetX", "Hero offset X", -240, 240, 1],
    ["layout.heroOffsetY", "Hero offset Y", -240, 240, 1],
    ["layout.panelOffsetX", "Panel offset X", -240, 240, 1],
    ["layout.panelOffsetY", "Panel offset Y", -240, 240, 1],
  ];

  return (
    <section className={styles.workspace}>
      <div className={styles.controls}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>Content</h2>
              <p className={styles.panelText}>
                Update headline copy, button text, and supporting labels.
              </p>
            </div>
          </div>

          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span>Brand name</span>
              <input value={design.brandName} onChange={handleText("brandName")} />
            </label>
            <label className={styles.field}>
              <span>Brand meta</span>
              <input value={design.brandMeta} onChange={handleText("brandMeta")} />
            </label>
            <label className={styles.field}>
              <span>Hero eyebrow</span>
              <input
                value={design.heroEyebrow}
                onChange={handleText("heroEyebrow")}
              />
            </label>
            <label className={styles.field}>
              <span>Panel eyebrow</span>
              <input
                value={design.panelEyebrow}
                onChange={handleText("panelEyebrow")}
              />
            </label>
            <label className={`${styles.field} ${styles.fieldFull}`}>
              <span>Hero title</span>
              <textarea
                rows={4}
                value={design.heroTitle}
                onChange={handleText("heroTitle")}
              />
            </label>
            <label className={`${styles.field} ${styles.fieldFull}`}>
              <span>Hero text</span>
              <textarea
                rows={3}
                value={design.heroText}
                onChange={handleText("heroText")}
              />
            </label>
            <label className={styles.field}>
              <span>Panel title</span>
              <input value={design.panelTitle} onChange={handleText("panelTitle")} />
            </label>
            <label className={styles.field}>
              <span>Status badge</span>
              <input
                value={design.panelStatusLabel}
                onChange={handleText("panelStatusLabel")}
              />
            </label>
            <label className={styles.field}>
              <span>Primary button label</span>
              <input
                value={design.primaryActionLabel}
                onChange={handleText("primaryActionLabel")}
              />
            </label>
            <label className={styles.field}>
              <span>Secondary button label</span>
              <input
                value={design.secondaryActionLabel}
                onChange={handleText("secondaryActionLabel")}
              />
            </label>
            <label className={styles.field}>
              <span>Preview email</span>
              <input
                value={design.previewEmail}
                onChange={handleText("previewEmail")}
              />
            </label>
            <label className={styles.field}>
              <span>Preview password</span>
              <input
                value={design.previewPassword}
                onChange={handleText("previewPassword")}
              />
            </label>
            <label className={`${styles.field} ${styles.fieldFull}`}>
              <span>Background image URL</span>
              <input
                value={design.backgroundImage}
                onChange={handleText("backgroundImage")}
              />
            </label>
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>Signals and hints</h2>
              <p className={styles.panelText}>
                Tune the three signal cards and the footer hints below them.
              </p>
            </div>
          </div>

          <div className={styles.formGrid}>
            {design.signals.map((signal, index) => (
              <div className={styles.signalGroup} key={index}>
                <label className={styles.field}>
                  <span>Card {index + 1} label</span>
                  <input
                    value={signal.label}
                    onChange={handleText(`signals.${index}.label`)}
                  />
                </label>
                <label className={styles.field}>
                  <span>Card {index + 1} value</span>
                  <input
                    value={signal.value}
                    onChange={handleText(`signals.${index}.value`)}
                  />
                </label>
              </div>
            ))}
            {design.hints.map((hint, index) => (
              <label className={`${styles.field} ${styles.fieldFull}`} key={index}>
                <span>Hint {index + 1}</span>
                <input value={hint} onChange={handleText(`hints.${index}`)} />
              </label>
            ))}
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>Colors</h2>
              <p className={styles.panelText}>
                Update the visual system while preview changes in place.
              </p>
            </div>
          </div>

          <div className={styles.colorGrid}>
            {colorFields.map(([path, label]) => (
              <label className={styles.colorField} key={path}>
                <span>{label}</span>
                <div className={styles.colorRow}>
                  <input
                    type="color"
                    value={hexValue(getValue(design, path))}
                    onChange={handleText(path)}
                  />
                  <input value={getValue(design, path)} onChange={handleText(path)} />
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>Layout</h2>
              <p className={styles.panelText}>
                Use sliders for width, spacing, and object position.
              </p>
            </div>
          </div>

          <div className={styles.rangeGrid}>
            {rangeFields.map(([path, label, min, max, step]) => (
              <label className={styles.rangeField} key={path}>
                <div className={styles.rangeHeader}>
                  <span>{label}</span>
                  <strong>{getValue(design, path)}</strong>
                </div>
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  value={getValue(design, path)}
                  onChange={handleNumber(path)}
                />
              </label>
            ))}
          </div>
        </div>

        <div className={styles.stickyBar}>
          <div>
            {message ? <p className={styles.success}>{message}</p> : null}
            {error ? <p className={styles.error}>{error}</p> : null}
          </div>
          <div className={styles.actionRow}>
            <button
              className={styles.secondaryButton}
              onClick={handleReset}
              type="button"
            >
              Reset to defaults
            </button>
            <button
              className={styles.primaryButton}
              disabled={pending}
              onClick={handleSave}
              type="button"
            >
              {pending ? "Saving..." : "Save design"}
            </button>
          </div>
        </div>
      </div>

      <div className={styles.previewPanel}>
        <div className={styles.previewHeader}>
          <h2 className={styles.previewTitle}>Live preview</h2>
          <p className={styles.previewText}>
            Changes on the left are reflected on the preview immediately.
          </p>
        </div>

        <div className={styles.previewFrame}>
          <div className={styles.previewCanvas}>
            <AuthConsole
              adminSetupRequired={false}
              currentUser={null}
              initialMode="member"
              landingPageDesign={previewDesign}
              previewMode
            />
          </div>
        </div>
      </div>
    </section>
  );
}
