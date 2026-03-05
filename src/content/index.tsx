import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

const HOST_ID = "gpt-voyager-host";
const ROOT_ID = "gpt-voyager-root";
const ALLOWED_HOSTS = new Set(["chatgpt.com", "chat.openai.com"]);

const styles = `
:host {
  all: initial;
  --gv-bg-0: #ffffff;
  --gv-bg-1: #fcfcfc;
  --gv-bg-2: #f7f7f7;
  --gv-card: #ffffff;
  --gv-card-soft: #f8f9fa;
  --gv-line: #e6e8eb;
  --gv-line-strong: #d4d9de;
  --gv-text: #16181d;
  --gv-text-soft: #666d78;
  --gv-accent: #374151;
  --gv-accent-soft: #f3f4f6;
  --gv-focus: rgba(51, 65, 85, 0.24);
  --gv-danger: #c23d4b;
  --gv-control-h: 34px;
  --gv-radius-sm: 10px;
  --gv-radius-md: 12px;
}

#${ROOT_ID} {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 2147483000;
  pointer-events: none;
  font-family: "Söhne", "PingFang SC", "Noto Sans SC", "Microsoft YaHei", "Helvetica Neue", sans-serif;
  color: var(--gv-text);
}

.gv-root {
  position: relative;
  height: 100%;
}

.gv-toggle {
  position: absolute;
  right: 0;
  top: 108px;
  pointer-events: auto;
  border: 1px solid var(--gv-line);
  border-right: none;
  border-radius: 14px 0 0 14px;
  background: #ffffff;
  color: var(--gv-text);
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  padding: 10px 13px;
  cursor: pointer;
  transform: translateX(100%);
  transition: transform 240ms cubic-bezier(0.22, 1, 0.36, 1);
  box-shadow: 0 8px 20px rgba(16, 24, 40, 0.08);
}

.gv-toggle.gv-visible {
  transform: translateX(0);
}

.gv-panel {
  pointer-events: auto;
  height: 100%;
  background: linear-gradient(180deg, var(--gv-bg-0) 0%, var(--gv-bg-1) 100%);
  border-left: 1px solid var(--gv-line);
  box-shadow: -14px 0 36px rgba(15, 23, 42, 0.08);
  overflow: hidden;
  transition: width 240ms cubic-bezier(0.22, 1, 0.36, 1);
  position: relative;
}

.gv-panel.gv-collapsed {
  width: 0 !important;
  border-left: none;
  box-shadow: none;
}

.gv-resize {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 8px;
  cursor: ew-resize;
  background: transparent;
}

.gv-panel-inner {
  height: 100%;
  color: var(--gv-text);
  padding: 18px 16px 22px;
  box-sizing: border-box;
  overflow-y: auto;
}

.gv-panel-inner::-webkit-scrollbar {
  width: 8px;
}

.gv-panel-inner::-webkit-scrollbar-thumb {
  background: #d7dce2;
  border-radius: 999px;
}

.gv-topbar {
  position: sticky;
  top: 0;
  z-index: 12;
  margin: -18px -16px 18px;
  padding: 18px 16px 14px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 72%, rgba(255, 255, 255, 0.85) 100%);
  backdrop-filter: blur(6px);
  border-bottom: 1px solid #eceff3;
}

.gv-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  gap: 10px;
}

.gv-header h1 {
  margin: 0;
  font-size: 19px;
  line-height: 1.12;
  letter-spacing: -0.02em;
  color: #101418;
}

.gv-header p {
  margin: 5px 0 0;
  color: var(--gv-text-soft);
  font-size: 11px;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.gv-text-btn {
  border: 1px solid var(--gv-line);
  border-radius: var(--gv-radius-sm);
  background: #fff;
  color: #2b323b;
  font-size: 12px;
  font-weight: 700;
  padding: 0 12px;
  cursor: pointer;
  min-height: var(--gv-control-h);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: border-color 150ms ease, background-color 150ms ease, box-shadow 180ms ease;
}

.gv-text-btn:hover {
  border-color: var(--gv-line-strong);
  background: #f6f8fa;
}

.gv-text-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--gv-focus);
}

.gv-nav {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.gv-nav-btn {
  border: 1px solid var(--gv-line);
  border-radius: var(--gv-radius-sm);
  background: #ffffff;
  color: #596271;
  font-size: 12px;
  line-height: 1;
  font-weight: 600;
  min-height: 36px;
  padding: 0 9px;
  cursor: pointer;
  transition: border-color 140ms ease, background 140ms ease, color 140ms ease, box-shadow 160ms ease;
}

.gv-nav-btn:hover {
  border-color: var(--gv-line-strong);
  color: #222a34;
  background: #f7f9fb;
}

.gv-nav-btn-active {
  border-color: #c8d1dd;
  color: #1f2937;
  background: var(--gv-accent-soft);
  box-shadow: none;
}

.gv-nav-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--gv-focus);
}

.gv-view-intro {
  margin-top: 10px;
  border: 1px solid #edf0f3;
  border-radius: 12px;
  background: #fbfcfd;
  padding: 10px 11px;
}

.gv-view-kicker {
  display: inline-block;
  font-size: 10px;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: #7a8392;
}

.gv-view-intro h2 {
  margin: 5px 0 0;
  font-size: 14px;
  line-height: 1.25;
  color: #18202a;
}

.gv-view-intro p {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.45;
  color: var(--gv-text-soft);
}

.gv-section {
  border: 1px solid var(--gv-line);
  border-radius: var(--gv-radius-md);
  background: var(--gv-card);
  margin-top: 10px;
  padding: 12px;
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.03);
  transition: border-color 180ms ease, box-shadow 220ms ease, transform 220ms ease;
  animation: gv-soft-rise 280ms cubic-bezier(0.22, 1, 0.36, 1);
}

.gv-section-prompts {
  border-color: #dde4ee;
}

.gv-section-highlight {
  border-color: #e2e8f0;
  background: linear-gradient(180deg, #ffffff, #f8fafc);
}

.gv-section-export {
  border-color: #dce3ec;
}

.gv-section-export .gv-actions-inline-export {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  width: 100%;
}

.gv-section-export .gv-actions-inline-export .gv-mini-btn {
  width: 100%;
}

.gv-workspace-hub {
  border-color: #d8e0eb;
  background: linear-gradient(180deg, #ffffff, #fafcfe);
}

.gv-workspace-grid {
  margin-top: 8px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.gv-workspace-card {
  border: 1px solid #dbe3ee;
  border-radius: var(--gv-radius-md);
  background: #ffffff;
  color: #1f2937;
  min-height: 92px;
  padding: 10px 11px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  cursor: pointer;
  transition: border-color 140ms ease, background-color 140ms ease;
  text-align: left;
}

.gv-workspace-card:hover {
  border-color: #c8d2e1;
  background: #fafcff;
}

.gv-workspace-card-title {
  font-size: 13px;
  font-weight: 700;
  color: #111827;
}

.gv-workspace-card-metric {
  font-size: 11px;
  font-weight: 600;
  color: #475569;
}

.gv-workspace-card-desc {
  font-size: 11px;
  color: #64748b;
  line-height: 1.45;
}

.gv-workspace-panels [data-gv-workspace] {
  display: none;
}

.gv-workspace-panels {
  margin-top: 10px;
}

.gv-workspace-panels .gv-section {
  margin-top: 0;
}

.gv-workspace-mode-overview [data-gv-workspace="overview"] {
  display: block;
}

.gv-workspace-mode-export [data-gv-workspace="export"] {
  display: block;
}

.gv-workspace-mode-starred [data-gv-workspace="starred"] {
  display: block;
}

.gv-workspace-mode-timeline [data-gv-workspace="timeline"] {
  display: block;
}

.gv-workspace-mode-formula [data-gv-workspace="formula"] {
  display: block;
}

.gv-workspace-mode-mermaid [data-gv-workspace="mermaid"] {
  display: block;
}

.gv-workspace-mode-classification [data-gv-workspace="classification"] {
  display: block;
}

.gv-workspace-mode-index [data-gv-workspace="index"] {
  display: block;
}

.gv-stat-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.gv-stat-item {
  border: 1px solid #edf0f3;
  border-radius: var(--gv-radius-sm);
  padding: 8px 10px;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.gv-stat-item span {
  color: var(--gv-text-soft);
  font-size: 11px;
}

.gv-stat-item strong {
  color: var(--gv-text);
  font-size: 18px;
  line-height: 1;
}

.gv-stat-cta {
  margin-top: 8px;
  width: 100%;
  border: 1px solid #d6dde7;
  border-radius: var(--gv-radius-sm);
  background: #f7f9fc;
  color: #334155;
  min-height: 36px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 11px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 150ms ease, box-shadow 180ms ease;
}

.gv-stat-cta:hover {
  border-color: #c4ceda;
  box-shadow: none;
}

.gv-stat-cta-active {
  border-color: #bcc8d6;
  background: #f1f5f9;
}

.gv-section h2 {
  margin: 0;
  font-size: 13px;
  letter-spacing: -0.01em;
  color: #1e2630;
}

.gv-section-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}

.gv-actions-inline {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 6px;
  max-width: 100%;
  align-items: center;
}

.gv-section-title-row-prompts {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
  align-items: stretch;
}

.gv-section-title-row-prompts .gv-actions-inline {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.gv-section-title-row-prompts .gv-actions-inline .gv-mini-btn {
  width: 100%;
}

.gv-mini-btn {
  border: 1px solid var(--gv-line);
  border-radius: var(--gv-radius-sm);
  background: #fff;
  color: #2f3842;
  font-size: 12px;
  padding: 0 11px;
  min-height: var(--gv-control-h);
  min-width: 96px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 140ms ease, background 140ms ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
}

.gv-actions-inline .gv-mini-btn,
.gv-filter-simple-row .gv-mini-btn,
.gv-btn-row .gv-mini-btn,
.gv-batch-quick .gv-mini-btn {
  min-width: 0;
}

.gv-mini-btn:hover {
  border-color: var(--gv-line-strong);
  background: #f6f8fa;
  box-shadow: none;
}

.gv-mini-btn:disabled {
  opacity: 0.56;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.gv-mini-btn-active {
  border-color: #c8d1dd;
  background: #f3f4f6;
  color: #1f2937;
}

.gv-danger-btn {
  border-color: #f0c8cf;
  color: var(--gv-danger);
}

.gv-danger-btn:hover {
  background: #fff5f7;
}

.gv-mini-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--gv-focus);
}

.gv-form-row {
  margin-top: 10px;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  align-items: stretch;
}

.gv-metric {
  margin: 10px 0 8px;
  color: var(--gv-text-soft);
  font-size: 12px;
  line-height: 1.45;
}

.gv-export-status {
  margin: -2px 0 8px;
  color: #475569;
  font-size: 11px;
  animation: gv-fade-in 220ms ease;
}

.gv-input {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--gv-line);
  border-radius: var(--gv-radius-sm);
  background: #fff;
  color: var(--gv-text);
  font-size: 12px;
  outline: none;
  padding: 0 11px;
  min-height: var(--gv-control-h);
}

.gv-input::placeholder {
  color: #9d9ea3;
}

.gv-input:focus,
.gv-textarea:focus {
  border-color: #c8d1dd;
  box-shadow: 0 0 0 3px var(--gv-focus);
}

.gv-textarea {
  margin-top: 8px;
  width: 100%;
  min-height: 96px;
  box-sizing: border-box;
  border: 1px solid var(--gv-line);
  border-radius: var(--gv-radius-sm);
  background: #fff;
  color: var(--gv-text);
  font-size: 12px;
  line-height: 1.45;
  outline: none;
  padding: 9px 11px;
  resize: vertical;
}

.gv-btn-row {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.gv-prompt-overview {
  margin-top: 8px;
  border: 1px solid #e8edf3;
  border-radius: var(--gv-radius-sm);
  background: #fafcff;
  padding: 8px 10px;
  color: #556070;
  font-size: 12px;
  line-height: 1.45;
}

.gv-prompt-filter-panel,
.gv-prompt-editor-panel {
  margin-top: 10px;
  border: 1px solid #e8edf3;
  border-radius: var(--gv-radius-sm);
  background: #fcfdff;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.gv-prompt-filter-panel .gv-input,
.gv-prompt-editor-panel .gv-input,
.gv-prompt-editor-panel .gv-textarea {
  margin-top: 0;
}

.gv-prompt-filter-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.gv-prompt-filter-grid .gv-mini-btn,
.gv-prompt-filter-grid .gv-select-shell {
  width: 100%;
}

.gv-form-row-prompt-title {
  margin-top: 0;
  grid-template-columns: minmax(0, 1fr) 100px;
}

.gv-prompt-editor-foot {
  margin-top: 0;
}

.gv-prompt-editor-foot .gv-status {
  margin-left: auto;
}

.gv-status {
  color: #475569;
  font-size: 11px;
  margin-left: auto;
}

.gv-list {
  margin-top: 8px;
  max-height: 42vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding-right: 2px;
}

.gv-virtual-spacer {
  width: 100%;
  flex: 0 0 auto;
  pointer-events: none;
}

.gv-timeline-list {
  margin-top: 8px;
  max-height: 34vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.gv-timeline-item {
  border: 1px solid #e8ecf0;
  border-radius: var(--gv-radius-sm);
  background: #fff;
  padding: 8px;
  color: var(--gv-text);
  display: flex;
  flex-direction: column;
  gap: 5px;
  transition: border-color 180ms ease, background 180ms ease;
}

.gv-timeline-item:hover {
  border-color: #cfd8e3;
  background: #f8fafd;
}

.gv-timeline-item-active {
  border-color: #c0ccd9;
  background: #f5f7fa;
}

.gv-timeline-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  color: #7f838a;
  font-size: 11px;
}

.gv-timeline-jump {
  border: none;
  background: transparent;
  color: inherit;
  text-align: left;
  padding: 0;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.gv-timeline-highlight-badge {
  border: 1px solid #b6dccc;
  border-radius: 999px;
  background: #f3f6fa;
  color: #176d57;
  font-size: 10px;
  line-height: 1;
  padding: 3px 7px;
}

.gv-timeline-preview {
  color: #3b3f45;
  font-size: 12px;
  line-height: 1.35;
}

.gv-timeline-tags {
  margin-top: 1px;
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.gv-timeline-actions {
  margin-top: 2px;
}

.gv-timeline-tag-editor {
  border: 1px dashed #d4dbe2;
  border-radius: var(--gv-radius-sm);
  background: #fbfcfd;
  padding: 8px;
}

.gv-formula-list {
  margin-top: 8px;
  max-height: 32vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.gv-formula-item {
  border: 1px solid #e8ecf0;
  border-radius: var(--gv-radius-sm);
  background: #fff;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: border-color 180ms ease, background 180ms ease;
}

.gv-formula-item:hover {
  border-color: #cfd8e3;
}

.gv-formula-item-active {
  border-color: #c0ccd9;
  background: #f5f7fa;
}

.gv-formula-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.gv-formula-meta {
  font-size: 11px;
  color: #7f838a;
}

.gv-formula-fav-tip {
  border: 1px solid #d6d8dc;
  border-radius: 999px;
  background: #f8f9fb;
  color: #4d5968;
  font-size: 10px;
  line-height: 1;
  padding: 3px 7px;
}

.gv-formula-badge {
  border-radius: 999px;
  font-size: 11px;
  line-height: 1;
  padding: 3px 8px;
  border: 1px solid #d7dce3;
  background: #fff;
  color: #5f6773;
}

.gv-formula-inline {
  border-color: #cfd8e3;
  background: #f4f7fb;
  color: #334155;
}

.gv-formula-display {
  border-color: #cfd6e4;
  background: #f4f7fc;
  color: #3f5277;
}

.gv-formula-tex {
  display: block;
  border: 1px solid #e8ecf0;
  border-radius: 10px;
  background: #fbfcfd;
  padding: 8px;
  font-family: "Consolas", "SFMono-Regular", Menlo, monospace;
  font-size: 12px;
  line-height: 1.4;
  color: #30343b;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

.gv-formula-copied {
  margin: 0 0 8px;
  border: 1px solid #d8dee7;
  border-radius: 11px;
  background: #f3f6fa;
  padding: 8px;
  animation: gv-fade-in 220ms ease;
}

.gv-formula-copied-head {
  margin-bottom: 6px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  color: #5b6574;
  font-size: 11px;
}

.gv-formula-favorites {
  margin-top: 10px;
  border-top: 1px solid #edf0f3;
  padding-top: 10px;
}

.gv-formula-favorites h3 {
  margin: 0;
  color: #2b2f35;
  font-size: 12px;
}

.gv-formula-fav-list {
  margin-top: 8px;
  max-height: 24vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.gv-formula-fav-item {
  border: 1px solid #e8ecf0;
  border-radius: 11px;
  background: #ffffff;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.gv-formula-fav-head {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  align-items: center;
}

.gv-formula-alias-input {
  min-height: 30px;
  font-size: 12px;
  padding: 6px 9px;
}

.gv-mermaid-list {
  margin-top: 8px;
  max-height: 34vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.gv-mermaid-item {
  border: 1px solid #e8ecf0;
  border-radius: 11px;
  background: #fff;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: border-color 180ms ease, background 180ms ease, transform 180ms ease;
}

.gv-mermaid-item:hover {
  transform: translateY(-1px);
}

.gv-mermaid-item-active {
  border-color: #c0ccd9;
  background: #f5f7fa;
}

.gv-mermaid-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.gv-mermaid-canvas-wrap {
  border: 1px solid #e8ecf0;
  border-radius: 10px;
  background: #fbfcfd;
  padding: 8px;
  overflow-x: auto;
}

.gv-mermaid-canvas {
  min-width: min-content;
}

.gv-mermaid-canvas svg {
  display: block;
  max-width: 100%;
  height: auto;
}

.gv-mermaid-favorites {
  margin-top: 10px;
  border-top: 1px solid #edf0f3;
  padding-top: 10px;
}

.gv-mermaid-favorites h3 {
  margin: 0;
  color: #2b2f35;
  font-size: 12px;
}

.gv-mermaid-fav-list {
  margin-top: 8px;
  max-height: 24vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.gv-mermaid-fav-item {
  border: 1px solid #e8ecf0;
  border-radius: 11px;
  background: #ffffff;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.gv-mermaid-fav-head {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  align-items: center;
}

.gv-mermaid-alias-input {
  min-height: 30px;
  font-size: 12px;
  padding: 6px 9px;
}

.gv-role-badge {
  border-radius: 999px;
  font-size: 11px;
  line-height: 1;
  padding: 3px 8px;
  border: 1px solid #d8dce3;
  background: #fff;
  color: #5c6472;
}

.gv-role-user {
  border-color: #cfd8e3;
  background: #f4f7fb;
  color: #334155;
}

.gv-role-assistant {
  border-color: #cfd7e4;
  background: #f4f7fb;
  color: #415574;
}

.gv-role-tool {
  border-color: #d8dce3;
  background: #f8f9fb;
  color: #4d5968;
}

.gv-role-unknown {
  border-color: #d7d7d7;
  background: #f7f7f7;
  color: #666;
}

.gv-empty {
  border: 1px dashed #d4dbe2;
  border-radius: var(--gv-radius-sm);
  padding: 10px 11px;
  color: var(--gv-text-soft);
  font-size: 12px;
  line-height: 1.45;
  background: #fcfdff;
}

.gv-item {
  width: 100%;
  border: 1px solid #e6ebf0;
  border-radius: var(--gv-radius-md);
  background: #ffffff;
  color: var(--gv-text);
  padding: 11px;
  display: flex;
  flex-direction: column;
  gap: 7px;
  min-height: 176px;
  transition: border-color 180ms ease, background 180ms ease;
}

.gv-item:hover {
  border-color: #ccd5df;
  background: #fbfcfe;
}

.gv-item-active {
  border-color: #c0ccd9;
  background: #f5f7fa;
}

.gv-item-open {
  border: none;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
  padding: 0;
  font-size: 12px;
  line-height: 1.35;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.gv-item-open:hover {
  text-decoration: underline;
}

.gv-item-top {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: start;
  gap: 8px;
}

.gv-check-wrap {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #7a7e86;
  font-size: 11px;
  white-space: nowrap;
}

.gv-check-wrap input[type="checkbox"] {
  width: 14px;
  height: 14px;
  accent-color: #374151;
}

.gv-item-meta {
  color: #7b8290;
  font-size: 11px;
  line-height: 1.2;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  justify-items: start;
  gap: 8px;
}

.gv-item-controls {
  margin-top: 4px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 124px;
  gap: 8px;
  align-items: center;
}

.gv-item-controls .gv-mini-btn {
  width: 100%;
  min-width: 0;
}

.gv-mini-btn-subtle {
  min-height: 34px;
  padding: 0 9px;
  font-size: 12px;
  color: #586171;
}

.gv-filter-row {
  margin-top: 8px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  align-items: stretch;
}

.gv-filter-row-compact {
  grid-template-columns: 1fr auto;
}

.gv-filter-row > .gv-mini-btn {
  width: 100%;
}

.gv-folder-quick-wrap {
  margin-top: 10px;
  border: 1px solid #e8ecf0;
  border-radius: var(--gv-radius-sm);
  background: #fbfcfd;
  padding: 9px;
}

.gv-folder-card-grid {
  margin-top: 10px;
  border: 1px solid #e6ebf1;
  border-radius: var(--gv-radius-md);
  background: #ffffff;
  overflow: hidden;
}

.gv-folder-card {
  padding: 10px 11px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px 10px;
  transition: background 140ms ease;
}

.gv-folder-card + .gv-folder-card {
  border-top: 1px solid #eef2f6;
}

.gv-folder-card:hover {
  background: #fbfcfe;
}

.gv-folder-card-active {
  background: #f6f9fc;
}

.gv-folder-card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.gv-folder-card-head strong {
  font-size: 12px;
  color: #1f2937;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.gv-folder-card-head span {
  font-size: 11px;
  color: #667085;
  white-space: nowrap;
  flex-shrink: 0;
}

.gv-folder-card-actions {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: nowrap;
  gap: 6px;
}

.gv-folder-card-actions .gv-mini-btn {
  min-height: 27px;
  min-width: 0;
  border-radius: 9px;
  font-size: 11px;
  padding: 0 8px;
}

.gv-folder-quick-head {
  color: #7a7e86;
  font-size: 11px;
  margin-bottom: 6px;
}

.gv-folder-quick-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.gv-folder-pill {
  border: 1px solid #d8dce3;
  border-radius: 999px;
  background: #fff;
  color: #535d6a;
  font-size: 11px;
  min-height: 30px;
  padding: 0 10px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.gv-folder-pill:hover {
  border-color: #c7ced8;
  background: #f7f9fc;
}

.gv-folder-pill-active {
  border-color: #c4ceda;
  background: #f4f7fb;
  color: #334155;
}

.gv-filter-simple-row {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.gv-order-density-row {
  margin-top: 8px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.gv-order-density-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
  color: #666a73;
  font-size: 11px;
}

.gv-filter-advanced {
  margin-top: 8px;
  border: 1px solid #e8ecf0;
  border-radius: var(--gv-radius-sm);
  background: #fcfdff;
  padding: 8px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.gv-filter-advanced-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
  color: #666a73;
  font-size: 11px;
}

.gv-batch-panel {
  margin-top: 8px;
  border: 1px solid #e8ecf0;
  border-radius: var(--gv-radius-sm);
  background: #fcfdff;
  padding: 9px;
}

.gv-batch-panel-expanded {
  border-color: #dfe5ed;
  background: #ffffff;
}

.gv-batch-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.gv-batch-head-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.gv-batch-head-main strong {
  color: #2f3640;
  font-size: 12px;
  line-height: 1.2;
}

.gv-batch-head-main span {
  color: #666a73;
  font-size: 11px;
}

.gv-batch-body {
  margin-top: 8px;
  border-top: 1px solid #edf1f5;
  padding-top: 8px;
}

.gv-batch-hint {
  margin: 8px 0 0;
  color: #848892;
  font-size: 11px;
  line-height: 1.4;
}

.gv-batch-quick {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.gv-batch-grid {
  margin-top: 8px;
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

.gv-batch-block {
  border: 1px solid #edf1f5;
  border-radius: var(--gv-radius-sm);
  background: #fbfcfe;
  padding: 9px;
}

.gv-batch-label {
  display: block;
  color: #6b7280;
  font-size: 11px;
  margin-bottom: 6px;
}

.gv-batch-block-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 8px;
  align-items: stretch;
}

.gv-batch-block-row .gv-actions-inline {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  justify-content: stretch;
}

.gv-batch-block-row .gv-actions-inline .gv-mini-btn {
  width: 100%;
  min-width: 0;
}

.gv-batch-block-row > .gv-mini-btn {
  width: 100%;
  min-width: 0;
}

.gv-star-btn {
  border: 1px solid #d6dbe2;
  border-radius: 999px;
  background: #fff;
  color: #616a76;
  font-size: 11px;
  line-height: 1;
  padding: 4px 8px;
  cursor: pointer;
  transition: border-color 150ms ease, background-color 150ms ease;
}

.gv-star-btn:hover {
  border-color: #c4ceda;
  background: #f6f8fb;
}

.gv-star-btn-active {
  border-color: #c0ccd9;
  background: #f1f5f9;
  color: #334155;
}

.gv-select-shell {
  position: relative;
  width: 100%;
  min-width: 0;
}

.gv-select-trigger {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #d5dce5;
  border-radius: var(--gv-radius-sm);
  background: #fff;
  color: #1f2937;
  font-size: 12px;
  min-height: var(--gv-control-h);
  padding: 0 27px 0 10px;
  line-height: 1.15;
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  cursor: pointer;
  transition: border-color 140ms ease, background-color 140ms ease, box-shadow 140ms ease;
}

.gv-select-trigger:hover {
  border-color: #c8d0db;
  background-color: #fcfdff;
}

.gv-select-trigger:focus-visible,
.gv-select-trigger-open {
  border-color: #b9c3d1;
  box-shadow: 0 0 0 2px rgba(148, 163, 184, 0.18);
}

.gv-select-trigger-value {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
}

.gv-select-trigger-arrow {
  color: #8a95a3;
  font-size: 11px;
  line-height: 1;
  flex-shrink: 0;
  transition: transform 120ms ease;
}

.gv-select-trigger-arrow-open {
  transform: rotate(180deg);
}

.gv-select-menu {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 2147483646;
  border: 1px solid #d4dbe5;
  border-radius: var(--gv-radius-sm);
  background: #ffffff;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.12);
  padding: 4px;
  max-height: 240px;
  overflow-y: auto;
  animation: gv-fade-in 120ms ease;
}

.gv-select-option {
  width: 100%;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #273444;
  font-size: 12px;
  min-height: 30px;
  padding: 0 9px;
  display: inline-flex;
  align-items: center;
  text-align: left;
  cursor: pointer;
}

.gv-select-option:hover {
  background: #f5f8fc;
}

.gv-select-option-active {
  background: #eef3f9;
  color: #1f2937;
}

.gv-select-option:focus-visible {
  outline: none;
  box-shadow: inset 0 0 0 1px #c6d1df;
  background: #f5f8fc;
}

.gv-select-shell-compact .gv-select-trigger {
  min-height: 30px;
  border-radius: 9px;
  font-size: 11px;
  padding: 0 25px 0 9px;
}

.gv-chip-wrap {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.gv-chip {
  border: 1px solid #d7dce3;
  border-radius: 999px;
  color: var(--gv-text);
  font-size: 11px;
  padding: 3px 8px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: #fff;
}

.gv-chip-tag {
  border-color: #cfd8e3;
  background: #f4f7fb;
}

.gv-chip-remove {
  border: none;
  background: transparent;
  color: #848892;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  padding: 0;
}

.gv-inline-empty {
  color: #8f9198;
  font-size: 11px;
}

.gv-folder-badge {
  color: #475569;
  font-size: 11px;
  white-space: nowrap;
}

.gv-tag-row {
  margin-top: 2px;
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  min-height: 28px;
  align-items: flex-start;
}

.gv-tag {
  border: 1px solid #d6dce3;
  border-radius: 999px;
  background: #fff;
  color: var(--gv-text-soft);
  font-size: 11px;
  padding: 4px 8px;
  cursor: pointer;
}

.gv-tag-active {
  border-color: #c9d3df;
  background: #f3f6fa;
  color: #334155;
}

.gv-settings-grid {
  margin-top: 8px;
  display: grid;
  gap: 8px;
}

.gv-setting-item {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 8px;
  border: 1px solid #e8ecf0;
  border-radius: 11px;
  background: #ffffff;
  padding: 8px;
  color: var(--gv-text);
  font-size: 12px;
}

.gv-setting-item input[type="checkbox"] {
  width: 16px;
  height: 16px;
}

.gv-setting-item .gv-select-shell {
  min-width: 130px;
}

.gv-setting-item-stack {
  grid-template-columns: 1fr;
  align-items: stretch;
}

.gv-range {
  width: 100%;
  accent-color: #374151;
  cursor: pointer;
}

.gv-prompt-list {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 36vh;
  overflow-y: auto;
}

.gv-prompt-item {
  border: 1px solid #e8ecf0;
  border-radius: var(--gv-radius-sm);
  background: #ffffff;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: border-color 180ms ease, background 180ms ease;
}

.gv-prompt-item:hover {
  border-color: #ccd5df;
}

.gv-prompt-title {
  color: var(--gv-text);
  font-size: 12px;
  font-weight: 600;
}

.gv-prompt-head {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 8px;
}

.gv-prompt-content {
  color: var(--gv-text-soft);
  font-size: 12px;
  line-height: 1.4;
  max-height: 72px;
  overflow: hidden;
  white-space: pre-wrap;
}

.gv-prompt-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.gv-variable-panel {
  margin-top: 2px;
  border: 1px solid #e5eaf0;
  border-radius: 11px;
  background: #fbfcfd;
  padding: 8px;
}

.gv-variable-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.gv-variable-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
  color: #5f6269;
  font-size: 11px;
}

.gv-preset-panel {
  margin-top: 8px;
  border: 1px dashed #d4dbe2;
  border-radius: 11px;
  background: #fbfcfd;
  padding: 8px;
}

.gv-preset-head {
  color: #666a73;
  font-size: 11px;
  margin-bottom: 6px;
}

.gv-preset-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.gv-preset-item {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  align-items: center;
}

.gv-preset-create-row {
  margin-top: 8px;
}

.gv-item-note {
  margin-top: 6px;
}

.gv-list-compact .gv-item {
  min-height: auto;
  padding: 8px;
  gap: 5px;
  border-radius: 10px;
}

.gv-list-compact .gv-item-open {
  font-size: 11px;
  line-height: 1.3;
}

.gv-list-compact .gv-item-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  font-size: 10px;
  gap: 6px 8px;
}

.gv-list-compact .gv-item-meta > span:last-child {
  margin-left: auto;
  white-space: nowrap;
}

.gv-list-compact .gv-item-controls {
  margin-top: 1px;
  grid-template-columns: minmax(0, 1fr);
  gap: 6px;
}

.gv-list-compact .gv-item-controls .gv-mini-btn {
  min-height: 30px;
  font-size: 11px;
  padding: 0 8px;
}

.gv-list-compact .gv-item-controls .gv-select-trigger {
  min-height: 30px;
  font-size: 11px;
}

.gv-list-compact .gv-star-btn {
  font-size: 10px;
  padding: 3px 7px;
}

.gv-list-compact .gv-tag {
  font-size: 10px;
  padding: 3px 7px;
}

.gv-list-compact .gv-tag-row {
  min-height: 22px;
  gap: 4px;
}

.gv-list-compact .gv-mini-btn-subtle {
  min-height: 30px;
  font-size: 11px;
}

.gv-list-compact .gv-item-note {
  margin-top: 2px;
  min-height: 28px;
  padding: 5px 8px;
  font-size: 11px;
}

.gv-list-minimal .gv-item {
  min-height: auto;
  padding: 8px;
  gap: 5px;
  border-radius: 10px;
}

.gv-list-minimal .gv-item-open {
  font-size: 11px;
  line-height: 1.3;
}

.gv-list-minimal .gv-item-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  font-size: 10px;
  gap: 6px 8px;
}

.gv-list-minimal .gv-item-meta > span:last-child {
  margin-left: auto;
  white-space: nowrap;
}

.gv-list-minimal .gv-item-controls {
  margin-top: 1px;
  grid-template-columns: minmax(0, 1fr);
  gap: 6px;
}

.gv-list-minimal .gv-item-controls .gv-mini-btn {
  min-height: 30px;
  font-size: 11px;
  padding: 0 8px;
}

.gv-list-minimal .gv-item-controls .gv-select-trigger {
  min-height: 30px;
  font-size: 11px;
}

.gv-list-minimal .gv-star-btn {
  font-size: 10px;
  padding: 3px 7px;
}

.gv-list-minimal .gv-tag {
  font-size: 10px;
  padding: 3px 7px;
}

.gv-list-minimal .gv-tag-row {
  min-height: 22px;
  gap: 4px;
}

.gv-item-note-collapsed {
  margin-top: 2px;
  min-height: 28px;
  border: 1px dashed #d9dfe8;
  border-radius: 9px;
  background: #fcfdff;
  color: #8c94a2;
  font-size: 11px;
  line-height: 1.3;
  display: flex;
  align-items: center;
  padding: 0 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.gv-item-minimal-expanded .gv-item-note-collapsed {
  display: none;
}

.gv-starred-list {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.gv-starred-item {
  border: 1px solid #e8ecf0;
  border-radius: 11px;
  background: #ffffff;
  padding: 8px;
}

.gv-starred-meta {
  margin-top: 4px;
  color: #8d9098;
  font-size: 11px;
  line-height: 1.35;
  display: grid;
  gap: 2px;
}

.gv-hidden-input {
  display: none;
}

.gv-section ul {
  margin: 10px 0 0;
  padding-left: 18px;
  color: var(--gv-text-soft);
  font-size: 13px;
  line-height: 1.5;
}

.gv-guide-list {
  margin: 10px 0 0;
  padding-left: 18px;
  color: var(--gv-text-soft);
  font-size: 12px;
  line-height: 1.6;
}

.gv-guide-grid {
  margin-top: 8px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.gv-guide-card {
  border: 1px solid #e8ecf0;
  border-radius: 11px;
  background: #ffffff;
  padding: 9px;
}

.gv-guide-card h3 {
  margin: 0 0 5px;
  color: #2b2f35;
  font-size: 12px;
}

.gv-guide-card p {
  margin: 0;
  color: #686d75;
  font-size: 12px;
  line-height: 1.45;
}

.gv-guide-faq {
  margin-top: 8px;
  display: grid;
  gap: 8px;
}

.gv-shortcut-list {
  margin-top: 8px;
  display: grid;
  gap: 6px;
}

.gv-shortcut-item {
  border: 1px solid #e8ecf0;
  border-radius: 11px;
  background: #ffffff;
  padding: 8px 9px;
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 8px;
  color: #5f636c;
  font-size: 12px;
}

.gv-kbd {
  border: 1px solid #d6dce3;
  border-radius: 7px;
  background: #fff;
  color: #364150;
  font-family: "Consolas", "SFMono-Regular", Menlo, monospace;
  font-size: 11px;
  line-height: 1;
  padding: 6px 8px;
  white-space: nowrap;
}

.gv-panel button:focus-visible:not(.gv-select-trigger):not(.gv-select-option),
.gv-panel input:focus-visible,
.gv-panel textarea:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--gv-focus);
}

@media (prefers-reduced-motion: reduce) {
  .gv-panel,
  .gv-panel * {
    animation-duration: 1ms !important;
    transition-duration: 1ms !important;
    scroll-behavior: auto !important;
  }
}

@keyframes gv-soft-rise {
  from {
    opacity: 0.72;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes gv-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@media (max-width: 520px) {
  .gv-actions-inline {
    flex-wrap: wrap;
  }

  .gv-mini-btn {
    min-width: 0;
  }

  .gv-section-title-row-prompts .gv-actions-inline {
    grid-template-columns: 1fr;
  }

  .gv-section-export .gv-actions-inline-export {
    grid-template-columns: 1fr;
  }

  .gv-workspace-grid {
    grid-template-columns: 1fr;
  }

  .gv-folder-card-grid {
    border-radius: 11px;
  }

  .gv-folder-card {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .gv-folder-card-actions {
    justify-content: flex-start;
  }

  .gv-filter-row {
    grid-template-columns: 1fr;
  }

  .gv-prompt-filter-grid {
    grid-template-columns: 1fr;
  }

  .gv-form-row-prompt-title {
    grid-template-columns: 1fr;
  }

  .gv-filter-advanced {
    grid-template-columns: 1fr;
  }

  .gv-order-density-row {
    grid-template-columns: 1fr;
  }

  .gv-batch-grid {
    grid-template-columns: 1fr;
  }

  .gv-batch-block-row {
    grid-template-columns: 1fr;
  }

  .gv-batch-block-row .gv-actions-inline {
    justify-content: flex-start;
  }

  .gv-item-controls {
    grid-template-columns: 1fr;
  }

  .gv-formula-fav-head {
    grid-template-columns: 1fr;
  }

  .gv-mermaid-fav-head {
    grid-template-columns: 1fr;
  }

  .gv-variable-grid {
    grid-template-columns: 1fr;
  }

  .gv-preset-item {
    grid-template-columns: 1fr;
  }

  .gv-guide-grid {
    grid-template-columns: 1fr;
  }

  .gv-nav {
    grid-template-columns: 1fr;
  }
}
`;

function shouldRunOnCurrentHost(): boolean {
  return ALLOWED_HOSTS.has(window.location.hostname);
}

function ensureMountTarget(): HTMLDivElement | null {
  if (!shouldRunOnCurrentHost()) {
    return null;
  }

  const existingHost = document.getElementById(HOST_ID);
  if (existingHost?.shadowRoot) {
    return existingHost.shadowRoot.getElementById(ROOT_ID) as HTMLDivElement | null;
  }

  if (!document.body) {
    return null;
  }

  const host = document.createElement("div");
  host.id = HOST_ID;
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = styles;
  shadow.appendChild(style);

  const mountRoot = document.createElement("div");
  mountRoot.id = ROOT_ID;
  shadow.appendChild(mountRoot);

  return mountRoot;
}

function boot() {
  const mountTarget = ensureMountTarget();
  if (!mountTarget || mountTarget.childElementCount > 0) {
    return;
  }

  createRoot(mountTarget).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}


