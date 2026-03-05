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
  margin: -18px -16px 14px;
  padding: 18px 16px 12px;
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
  border-radius: 11px;
  background: #fff;
  color: #2b323b;
  font-size: 12px;
  font-weight: 700;
  padding: 0 12px;
  cursor: pointer;
  min-height: 34px;
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
  border-radius: 12px;
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
  box-shadow: inset 0 0 0 1px #e5e7eb, 0 1px 2px rgba(15, 23, 42, 0.04);
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
  border-radius: 14px;
  background: var(--gv-card);
  margin-top: 10px;
  padding: 14px;
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.03);
  transition: border-color 180ms ease, box-shadow 220ms ease, transform 220ms ease;
  animation: gv-soft-rise 280ms cubic-bezier(0.22, 1, 0.36, 1);
}

.gv-section-highlight {
  border-color: #e2e8f0;
  background: linear-gradient(180deg, #ffffff, #f8fafc);
}

.gv-stat-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.gv-stat-item {
  border: 1px solid #edf0f3;
  border-radius: 12px;
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
  border-radius: 12px;
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
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
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
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}

.gv-actions-inline {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 6px;
  max-width: 100%;
}

.gv-mini-btn {
  border: 1px solid var(--gv-line);
  border-radius: 11px;
  background: #fff;
  color: #2f3842;
  font-size: 12px;
  padding: 0 11px;
  min-height: 34px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 140ms ease, background 140ms ease, box-shadow 180ms ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
}

.gv-mini-btn:hover {
  border-color: var(--gv-line-strong);
  background: #f6f8fa;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.06);
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
  border-radius: 11px;
  background: #fff;
  color: var(--gv-text);
  font-size: 12px;
  outline: none;
  padding: 0 11px;
  min-height: 34px;
}

.gv-input::placeholder {
  color: #9d9ea3;
}

.gv-input:focus,
.gv-select:focus,
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
  border-radius: 11px;
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
  border-radius: 11px;
  background: #fff;
  padding: 8px;
  color: var(--gv-text);
  display: flex;
  flex-direction: column;
  gap: 5px;
  transition: border-color 180ms ease, background 180ms ease, transform 180ms ease;
}

.gv-timeline-item:hover {
  border-color: #bfded4;
  background: #f7fcfa;
  transform: translateY(-1px);
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
  border-radius: 10px;
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
  border-radius: 11px;
  background: #fff;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: border-color 180ms ease, background 180ms ease, transform 180ms ease;
}

.gv-formula-item:hover {
  transform: translateY(-1px);
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
  border-radius: 10px;
  padding: 10px 11px;
  color: var(--gv-text-soft);
  font-size: 12px;
  line-height: 1.45;
  background: #fcfdff;
}

.gv-item {
  width: 100%;
  border: 1px solid #e6ebf0;
  border-radius: 13px;
  background: #ffffff;
  color: var(--gv-text);
  padding: 11px;
  display: flex;
  flex-direction: column;
  gap: 7px;
  min-height: 176px;
  transition: border-color 180ms ease, background 180ms ease, box-shadow 180ms ease;
}

.gv-item:hover {
  border-color: #ccd5df;
  background: #fbfdfc;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05);
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
  grid-template-columns: 1fr auto;
  gap: 8px;
  align-items: center;
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
  grid-template-columns: 1fr 1fr auto auto;
  gap: 8px;
  align-items: stretch;
}

.gv-filter-row-compact {
  grid-template-columns: 1fr auto;
}

.gv-folder-quick-wrap {
  margin-top: 10px;
  border: 1px solid #e8ecf0;
  border-radius: 11px;
  background: #fbfcfd;
  padding: 9px;
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
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.gv-batch-panel {
  margin-top: 8px;
  border: 1px solid #e8ecf0;
  border-radius: 11px;
  background: #fbfcfd;
  padding: 9px;
}

.gv-batch-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: #666a73;
  font-size: 12px;
}

.gv-batch-hint {
  margin: 7px 0 0;
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
  grid-template-columns: 1fr auto;
  gap: 8px;
  align-items: center;
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

.gv-select {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--gv-line);
  border-radius: 11px;
  background: #fff;
  color: var(--gv-text);
  font-size: 12px;
  outline: none;
  padding: 0 10px;
  min-height: 34px;
}

.gv-inline-select {
  position: relative;
  width: 100%;
}

.gv-inline-select-btn {
  width: 100%;
  min-height: 34px;
  box-sizing: border-box;
  border: 1px solid var(--gv-line);
  border-radius: 11px;
  background: #fff;
  color: var(--gv-text);
  font-size: 12px;
  padding: 7px 10px;
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  cursor: pointer;
  transition: border-color 150ms ease, box-shadow 160ms ease, background 160ms ease;
}

.gv-inline-select-btn:hover {
  border-color: #cdd5de;
  background: #f8fafc;
}

.gv-inline-select-btn-open {
  border-color: #c8d1dd;
  box-shadow: 0 0 0 2px rgba(51, 65, 85, 0.16);
}

.gv-inline-select-arrow {
  color: #8d9098;
  transition: transform 150ms ease;
}

.gv-inline-select-arrow-open {
  transform: rotate(180deg);
}

.gv-inline-select-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: 30;
  border: 1px solid #dce2e9;
  border-radius: 10px;
  background: #ffffff;
  box-shadow: 0 14px 30px rgba(16, 24, 40, 0.12);
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 220px;
  overflow-y: auto;
}

.gv-inline-select-option {
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #2f3238;
  font-size: 12px;
  text-align: left;
  line-height: 1.2;
  min-height: 32px;
  padding: 0 9px;
  cursor: pointer;
}

.gv-inline-select-option:hover {
  background: #f4f7fa;
}

.gv-inline-select-option-active {
  background: #eef2f7;
  color: #334155;
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

.gv-setting-item .gv-select {
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
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 36vh;
  overflow-y: auto;
}

.gv-prompt-item {
  border: 1px solid #e8ecf0;
  border-radius: 11px;
  background: #ffffff;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: border-color 180ms ease, background 180ms ease, transform 180ms ease;
}

.gv-prompt-item:hover {
  transform: translateY(-1px);
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
  min-height: 142px;
  padding: 8px 9px;
  gap: 4px;
  border-radius: 10px;
}

.gv-list-compact .gv-item-open {
  font-size: 11px;
  line-height: 1.3;
}

.gv-list-compact .gv-item-meta {
  font-size: 10px;
  gap: 6px;
}

.gv-list-compact .gv-item-controls {
  margin-top: 2px;
}

.gv-list-compact .gv-tag {
  font-size: 10px;
  padding: 3px 7px;
}

.gv-list-compact .gv-mini-btn-subtle {
  min-height: 32px;
  font-size: 11px;
}

.gv-list-compact .gv-item-note {
  margin-top: 4px;
  min-height: 30px;
  padding: 6px 8px;
  font-size: 11px;
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

.gv-panel button:focus-visible,
.gv-panel input:focus-visible,
.gv-panel select:focus-visible,
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

  .gv-filter-row {
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


