import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

const HOST_ID = "gpt-voyager-host";
const ROOT_ID = "gpt-voyager-root";
const ALLOWED_HOSTS = new Set(["chatgpt.com", "chat.openai.com"]);

const styles = `
:host {
  all: initial;
  --gv-bg-0: #faf9f6;
  --gv-bg-1: #f6f4ef;
  --gv-bg-2: #ffffff;
  --gv-card: #ffffff;
  --gv-card-soft: #fbfaf7;
  --gv-line: #e8e5de;
  --gv-line-strong: #ddd8cd;
  --gv-text: #202123;
  --gv-text-soft: #6a6b70;
  --gv-accent: #10a37f;
  --gv-accent-soft: #e8f6f2;
  --gv-danger: #c23d4b;
}

#${ROOT_ID} {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 2147483000;
  pointer-events: none;
  font-family: "Söhne", "Inter", "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif;
  color: var(--gv-text);
}

.gv-root {
  position: relative;
  height: 100%;
}

.gv-toggle {
  position: absolute;
  right: 0;
  top: 120px;
  pointer-events: auto;
  border: 1px solid var(--gv-line-strong);
  border-right: none;
  border-radius: 10px 0 0 10px;
  background: #ffffff;
  color: var(--gv-text);
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  padding: 11px 13px;
  cursor: pointer;
  transform: translateX(100%);
  transition: transform 240ms cubic-bezier(0.22, 1, 0.36, 1);
  box-shadow: 0 12px 24px rgba(33, 37, 41, 0.08);
}

.gv-toggle.gv-visible {
  transform: translateX(0);
}

.gv-panel {
  pointer-events: auto;
  height: 100%;
  background:
    radial-gradient(100% 70% at 105% -10%, rgba(16, 163, 127, 0.06), transparent 55%),
    linear-gradient(180deg, var(--gv-bg-0), var(--gv-bg-1) 55%, var(--gv-bg-2));
  border-left: 1px solid var(--gv-line);
  box-shadow: -14px 0 28px rgba(33, 37, 41, 0.08);
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
  padding: 14px 14px 18px;
  box-sizing: border-box;
  overflow-y: auto;
}

.gv-panel-inner::-webkit-scrollbar {
  width: 8px;
}

.gv-panel-inner::-webkit-scrollbar-thumb {
  background: #d7d2c6;
  border-radius: 999px;
}

.gv-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
  gap: 10px;
}

.gv-header h1 {
  margin: 0;
  font-size: 21px;
  line-height: 1.15;
  letter-spacing: -0.01em;
  color: #1f2124;
}

.gv-header p {
  margin: 6px 0 0;
  color: var(--gv-text-soft);
  font-size: 12px;
}

.gv-text-btn {
  border: 1px solid var(--gv-line);
  border-radius: 10px;
  background: #fff;
  color: #3b3f45;
  font-size: 12px;
  font-weight: 600;
  padding: 6px 11px;
  cursor: pointer;
  min-height: 32px;
  display: inline-flex;
  align-items: center;
}

.gv-text-btn:hover {
  border-color: var(--gv-line-strong);
  background: #f7f7f5;
}

.gv-nav {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 12px;
}

.gv-nav-btn {
  border: 1px solid var(--gv-line);
  border-radius: 10px;
  background: #ffffff;
  color: var(--gv-text-soft);
  font-size: 12px;
  line-height: 1;
  padding: 10px 8px;
  cursor: pointer;
  transition: all 140ms ease;
}

.gv-nav-btn:hover {
  border-color: var(--gv-line-strong);
  color: #2a2c31;
  background: #f8f7f4;
}

.gv-nav-btn-active {
  border-color: #b9ddd2;
  color: #146b54;
  background: var(--gv-accent-soft);
  box-shadow: inset 0 0 0 1px #d7eee7;
}

.gv-section {
  border: 1px solid var(--gv-line);
  border-radius: 12px;
  background: var(--gv-card);
  margin-top: 10px;
  padding: 12px;
  box-shadow: 0 2px 10px rgba(31, 33, 35, 0.03);
  transition: border-color 180ms ease, box-shadow 220ms ease, transform 220ms ease;
  animation: gv-soft-rise 280ms cubic-bezier(0.22, 1, 0.36, 1);
}

.gv-section-highlight {
  border-color: #d5ece4;
  background: linear-gradient(180deg, #ffffff, #f5fbf9);
}

.gv-stat-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.gv-stat-item {
  border: 1px solid #ece8de;
  border-radius: 10px;
  padding: 8px 10px;
  background: #fffcf8;
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
  border: 1px solid #e2dbc9;
  border-radius: 10px;
  background: #fffaf0;
  color: #5c4c1e;
  min-height: 36px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.gv-stat-cta:hover {
  border-color: #d4c08a;
}

.gv-stat-cta-active {
  border-color: #d1b76d;
  background: #fff4d5;
}

.gv-section h2 {
  margin: 0;
  font-size: 13px;
  color: #2a2c31;
}

.gv-section-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.gv-actions-inline {
  display: inline-flex;
  gap: 6px;
}

.gv-mini-btn {
  border: 1px solid var(--gv-line);
  border-radius: 9px;
  background: #fff;
  color: #34373d;
  font-size: 11px;
  padding: 0 10px;
  min-height: 34px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 160ms cubic-bezier(0.22, 1, 0.36, 1), border-color 160ms ease, background 160ms ease, box-shadow 180ms ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
}

.gv-mini-btn:hover {
  border-color: var(--gv-line-strong);
  background: #f8f7f4;
  box-shadow: 0 4px 10px rgba(28, 32, 36, 0.06);
  transform: translateY(-1px);
}

.gv-mini-btn:disabled {
  opacity: 0.56;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.gv-mini-btn-active {
  border-color: #b6dccc;
  background: #edf8f4;
  color: #176c56;
}

.gv-danger-btn {
  border-color: #f1c6cc;
  color: var(--gv-danger);
}

.gv-danger-btn:hover {
  background: #fff5f6;
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
  color: #0f8c6d;
  font-size: 11px;
  animation: gv-fade-in 220ms ease;
}

.gv-input {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--gv-line);
  border-radius: 10px;
  background: #fff;
  color: var(--gv-text);
  font-size: 13px;
  outline: none;
  padding: 8px 10px;
  min-height: 34px;
}

.gv-input::placeholder {
  color: #9d9ea3;
}

.gv-input:focus,
.gv-select:focus,
.gv-textarea:focus {
  border-color: #8ac9b8;
  box-shadow: 0 0 0 2px rgba(16, 163, 127, 0.15);
}

.gv-textarea {
  margin-top: 8px;
  width: 100%;
  min-height: 96px;
  box-sizing: border-box;
  border: 1px solid var(--gv-line);
  border-radius: 10px;
  background: #fff;
  color: var(--gv-text);
  font-size: 12px;
  line-height: 1.45;
  outline: none;
  padding: 8px 10px;
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
  color: #0f8c6d;
  font-size: 11px;
  margin-left: auto;
}

.gv-list {
  margin-top: 8px;
  max-height: 42vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
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
  border: 1px solid #ece8de;
  border-radius: 10px;
  background: #fff;
  text-align: left;
  padding: 8px;
  cursor: pointer;
  color: var(--gv-text);
  display: flex;
  flex-direction: column;
  gap: 5px;
  transition: border-color 180ms ease, background 180ms ease, transform 180ms ease;
}

.gv-timeline-item:hover {
  border-color: #c6dccf;
  background: #f8fcfa;
  transform: translateY(-1px);
}

.gv-timeline-item-active {
  border-color: #a8d3c2;
  background: #eef8f4;
}

.gv-timeline-head {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #7f838a;
  font-size: 11px;
}

.gv-timeline-preview {
  color: #3b3f45;
  font-size: 12px;
  line-height: 1.35;
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
  border: 1px solid #ece8de;
  border-radius: 10px;
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
  border-color: #a8d3c2;
  background: #eef8f4;
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
  border: 1px solid #d8c285;
  border-radius: 999px;
  background: #fff8e6;
  color: #7f5a00;
  font-size: 10px;
  line-height: 1;
  padding: 3px 7px;
}

.gv-formula-badge {
  border-radius: 999px;
  font-size: 11px;
  line-height: 1;
  padding: 3px 8px;
  border: 1px solid #ddd8cd;
  background: #fff;
  color: #666a73;
}

.gv-formula-inline {
  border-color: #bad7cf;
  background: #eef8f4;
  color: #1d715b;
}

.gv-formula-display {
  border-color: #d6c8eb;
  background: #f7f1ff;
  color: #5e3d94;
}

.gv-formula-tex {
  display: block;
  border: 1px solid #ece8de;
  border-radius: 8px;
  background: #fbfaf7;
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
  border: 1px solid #d8eadf;
  border-radius: 10px;
  background: #f4fbf8;
  padding: 8px;
  animation: gv-fade-in 220ms ease;
}

.gv-formula-copied-head {
  margin-bottom: 6px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  color: #49685d;
  font-size: 11px;
}

.gv-formula-favorites {
  margin-top: 10px;
  border-top: 1px solid #ece8de;
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
  border: 1px solid #ece8de;
  border-radius: 10px;
  background: #fffcf8;
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
  border: 1px solid #ece8de;
  border-radius: 10px;
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
  border-color: #a8d3c2;
  background: #eef8f4;
}

.gv-mermaid-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.gv-mermaid-canvas-wrap {
  border: 1px solid #ece8de;
  border-radius: 8px;
  background: #fbfaf7;
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

.gv-role-badge {
  border-radius: 999px;
  font-size: 11px;
  line-height: 1;
  padding: 3px 8px;
  border: 1px solid #ddd8cd;
  background: #fff;
  color: #666a73;
}

.gv-role-user {
  border-color: #bad7cf;
  background: #eef8f4;
  color: #1d715b;
}

.gv-role-assistant {
  border-color: #c9cbe8;
  background: #f5f6ff;
  color: #44518f;
}

.gv-role-tool {
  border-color: #e4d2b2;
  background: #fff8ea;
  color: #8a5b0f;
}

.gv-role-unknown {
  border-color: #d7d7d7;
  background: #f7f7f7;
  color: #666;
}

.gv-empty {
  border: 1px dashed #d5d2cb;
  border-radius: 8px;
  padding: 10px;
  color: var(--gv-text-soft);
  font-size: 12px;
  line-height: 1.45;
}

.gv-item {
  width: 100%;
  border: 1px solid #ece8de;
  border-radius: 10px;
  background: var(--gv-card-soft);
  color: var(--gv-text);
  padding: 8px 9px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition: border-color 180ms ease, background 180ms ease, transform 180ms ease;
}

.gv-item:hover {
  border-color: #c4ddcf;
  transform: translateY(-1px);
}

.gv-item-active {
  border-color: #b6dccc;
  background: #f2faf7;
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
  align-items: center;
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
  accent-color: #10a37f;
}

.gv-item-meta {
  color: #8c8f97;
  font-size: 11px;
  line-height: 1.2;
  display: grid;
  grid-template-columns: auto auto 1fr;
  align-items: center;
  justify-items: start;
  gap: 8px;
}

.gv-item-controls {
  margin-top: 3px;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  align-items: center;
}

.gv-mini-btn-subtle {
  min-height: 32px;
  padding: 0 9px;
  font-size: 11px;
  color: #5f636b;
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
  border: 1px solid #ece8de;
  border-radius: 10px;
  background: #fffdf9;
  padding: 8px;
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
  border: 1px solid #ddd8cd;
  border-radius: 999px;
  background: #fff;
  color: #595d66;
  font-size: 11px;
  min-height: 30px;
  padding: 0 10px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.gv-folder-pill:hover {
  border-color: #d2c9b8;
  background: #fffcf6;
}

.gv-folder-pill-active {
  border-color: #afd7c9;
  background: #eef8f4;
  color: #1b6c56;
}

.gv-filter-simple-row {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.gv-filter-advanced {
  margin-top: 8px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.gv-batch-panel {
  margin-top: 8px;
  border: 1px solid #ece8de;
  border-radius: 10px;
  background: #fffdf9;
  padding: 8px;
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
  border: 1px solid #ddd8cd;
  border-radius: 999px;
  background: #fff;
  color: #6f737a;
  font-size: 11px;
  line-height: 1;
  padding: 4px 8px;
  cursor: pointer;
}

.gv-star-btn:hover {
  border-color: #ccb77e;
  background: #fffaf0;
}

.gv-star-btn-active {
  border-color: #d7bf7a;
  background: #fff7df;
  color: #7c5a00;
}

.gv-select {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--gv-line);
  border-radius: 10px;
  background: #fff;
  color: var(--gv-text);
  font-size: 12px;
  outline: none;
  padding: 7px 8px;
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
  border-radius: 10px;
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
  border-color: #d9d3c7;
  background: #fffcf8;
}

.gv-inline-select-btn-open {
  border-color: #8ac9b8;
  box-shadow: 0 0 0 2px rgba(16, 163, 127, 0.15);
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
  border: 1px solid #e4dfd3;
  border-radius: 10px;
  background: #fffdf9;
  box-shadow: 0 14px 30px rgba(33, 37, 41, 0.12);
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
  background: #f5f7f6;
}

.gv-inline-select-option-active {
  background: #eaf6f1;
  color: #166e57;
}

.gv-chip-wrap {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.gv-chip {
  border: 1px solid #ddd8cd;
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
  border-color: #c5dfd5;
  background: #f2faf7;
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
  color: #2f7e68;
  font-size: 11px;
  white-space: nowrap;
}

.gv-tag-row {
  margin-top: 5px;
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.gv-tag {
  border: 1px solid #ddd8cd;
  border-radius: 999px;
  background: #fff;
  color: var(--gv-text-soft);
  font-size: 11px;
  padding: 3px 8px;
  cursor: pointer;
}

.gv-tag-active {
  border-color: #afdbc9;
  background: #edf8f4;
  color: #1d715b;
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
  border: 1px solid #ece8de;
  border-radius: 10px;
  background: #fffcf8;
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

.gv-prompt-list {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 36vh;
  overflow-y: auto;
}

.gv-prompt-item {
  border: 1px solid #ece8de;
  border-radius: 10px;
  background: #fffcf8;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: border-color 180ms ease, background 180ms ease, transform 180ms ease;
}

.gv-prompt-item:hover {
  transform: translateY(-1px);
  border-color: #d8d2c6;
}

.gv-prompt-title {
  color: var(--gv-text);
  font-size: 12px;
  font-weight: 600;
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
  border: 1px solid #e9e4d8;
  border-radius: 10px;
  background: #fffdf8;
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

.gv-item-note {
  margin-top: 6px;
}

.gv-starred-list {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.gv-starred-item {
  border: 1px solid #ece8de;
  border-radius: 10px;
  background: #fffcf8;
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
  border: 1px solid #ece8de;
  border-radius: 10px;
  background: #fffcf8;
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
  border: 1px solid #ece8de;
  border-radius: 10px;
  background: #fffcf8;
  padding: 8px 9px;
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 8px;
  color: #5f636c;
  font-size: 12px;
}

.gv-kbd {
  border: 1px solid #dad3c6;
  border-radius: 7px;
  background: #fff;
  color: #3a3e46;
  font-family: "Consolas", "SFMono-Regular", Menlo, monospace;
  font-size: 11px;
  line-height: 1;
  padding: 6px 8px;
  white-space: nowrap;
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

  .gv-batch-grid {
    grid-template-columns: 1fr;
  }

  .gv-item-controls {
    grid-template-columns: 1fr;
  }

  .gv-formula-fav-head {
    grid-template-columns: 1fr;
  }

  .gv-variable-grid {
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
