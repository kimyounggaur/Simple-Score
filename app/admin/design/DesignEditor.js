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
        setError(result.error || "저장에 실패했습니다.");
        return;
      }

      setDesign(normalizeLandingPageDesign(result.design));
      setMessage("디자인 설정을 저장했습니다.");
    } catch (saveError) {
      console.error(saveError);
      setError("디자인 설정을 저장하지 못했습니다.");
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
    ["colors.pageBg", "페이지 배경"],
    ["colors.accent", "강조색"],
    ["colors.textPrimary", "주요 텍스트"],
    ["colors.textSecondary", "보조 텍스트"],
    ["colors.mutedText", "약한 텍스트"],
    ["colors.panelBg", "패널 배경"],
    ["colors.panelBorder", "패널 테두리"],
    ["colors.inputBg", "입력창 배경"],
    ["colors.inputText", "입력창 텍스트"],
    ["colors.primaryButtonBg", "기본 버튼 배경"],
    ["colors.primaryButtonText", "기본 버튼 텍스트"],
    ["colors.secondaryButtonBg", "보조 버튼 배경"],
    ["colors.secondaryButtonText", "보조 버튼 텍스트"],
    ["colors.signalCardBg", "신호 카드 배경"],
    ["colors.signalCardBorder", "신호 카드 테두리"],
  ];

  const rangeFields = [
    ["layout.contentMaxWidth", "콘텐츠 폭", 960, 1600, 10],
    ["layout.contentGap", "콘텐츠 간격", 12, 120, 2],
    ["layout.heroTitleMaxWidth", "히어로 제목 폭", 320, 980, 10],
    ["layout.heroTextMaxWidth", "히어로 본문 폭", 260, 900, 10],
    ["layout.panelWidth", "패널 폭", 320, 620, 10],
    ["layout.heroOffsetX", "히어로 X 위치", -240, 240, 1],
    ["layout.heroOffsetY", "히어로 Y 위치", -240, 240, 1],
    ["layout.panelOffsetX", "패널 X 위치", -240, 240, 1],
    ["layout.panelOffsetY", "패널 Y 위치", -240, 240, 1],
  ];

  return (
    <section className={styles.workspace}>
      <div className={styles.controls}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>콘텐츠</h2>
              <p className={styles.panelText}>
                제목, 설명, 버튼 문구, 보조 문구를 수정합니다.
              </p>
            </div>
          </div>

          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span>브랜드명</span>
              <input value={design.brandName} onChange={handleText("brandName")} />
            </label>
            <label className={styles.field}>
              <span>브랜드 보조 문구</span>
              <input value={design.brandMeta} onChange={handleText("brandMeta")} />
            </label>
            <label className={styles.field}>
              <span>히어로 상단 라벨</span>
              <input
                value={design.heroEyebrow}
                onChange={handleText("heroEyebrow")}
              />
            </label>
            <label className={styles.field}>
              <span>패널 상단 라벨</span>
              <input
                value={design.panelEyebrow}
                onChange={handleText("panelEyebrow")}
              />
            </label>
            <label className={`${styles.field} ${styles.fieldFull}`}>
              <span>히어로 제목</span>
              <textarea
                rows={4}
                value={design.heroTitle}
                onChange={handleText("heroTitle")}
              />
            </label>
            <label className={`${styles.field} ${styles.fieldFull}`}>
              <span>히어로 설명</span>
              <textarea
                rows={3}
                value={design.heroText}
                onChange={handleText("heroText")}
              />
            </label>
            <label className={styles.field}>
              <span>패널 제목</span>
              <input value={design.panelTitle} onChange={handleText("panelTitle")} />
            </label>
            <label className={styles.field}>
              <span>상태 배지</span>
              <input
                value={design.panelStatusLabel}
                onChange={handleText("panelStatusLabel")}
              />
            </label>
            <label className={styles.field}>
              <span>기본 버튼 문구</span>
              <input
                value={design.primaryActionLabel}
                onChange={handleText("primaryActionLabel")}
              />
            </label>
            <label className={styles.field}>
              <span>보조 버튼 문구</span>
              <input
                value={design.secondaryActionLabel}
                onChange={handleText("secondaryActionLabel")}
              />
            </label>
            <label className={styles.field}>
              <span>미리보기 이메일</span>
              <input
                value={design.previewEmail}
                onChange={handleText("previewEmail")}
              />
            </label>
            <label className={styles.field}>
              <span>미리보기 비밀번호</span>
              <input
                value={design.previewPassword}
                onChange={handleText("previewPassword")}
              />
            </label>
            <label className={`${styles.field} ${styles.fieldFull}`}>
              <span>배경 이미지 URL</span>
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
              <h2 className={styles.panelTitle}>신호 카드와 안내문</h2>
              <p className={styles.panelText}>
                세 개의 신호 카드와 하단 안내문을 수정합니다.
              </p>
            </div>
          </div>

          <div className={styles.formGrid}>
            {design.signals.map((signal, index) => (
              <div className={styles.signalGroup} key={index}>
                <label className={styles.field}>
                  <span>카드 {index + 1} 라벨</span>
                  <input
                    value={signal.label}
                    onChange={handleText(`signals.${index}.label`)}
                  />
                </label>
                <label className={styles.field}>
                  <span>카드 {index + 1} 값</span>
                  <input
                    value={signal.value}
                    onChange={handleText(`signals.${index}.value`)}
                  />
                </label>
              </div>
            ))}
            {design.hints.map((hint, index) => (
              <label className={`${styles.field} ${styles.fieldFull}`} key={index}>
                <span>안내문 {index + 1}</span>
                <input value={hint} onChange={handleText(`hints.${index}`)} />
              </label>
            ))}
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>색상</h2>
              <p className={styles.panelText}>
                색상을 바꾸면 오른쪽 미리보기에 바로 반영됩니다.
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
              <h2 className={styles.panelTitle}>배치</h2>
              <p className={styles.panelText}>
                폭, 간격, 위치를 슬라이더로 조절합니다.
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
              기본값으로 되돌리기
            </button>
            <button
              className={styles.primaryButton}
              disabled={pending}
              onClick={handleSave}
              type="button"
            >
              {pending ? "저장 중..." : "디자인 저장"}
            </button>
          </div>
        </div>
      </div>

      <div className={styles.previewPanel}>
        <div className={styles.previewHeader}>
          <h2 className={styles.previewTitle}>실시간 미리보기</h2>
          <p className={styles.previewText}>
            왼쪽에서 바꾼 내용이 오른쪽 미리보기에 바로 반영됩니다.
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
