# Quỹ Cầu Lông 5AM — Rise & Shine (V3.1)

Hệ thống quản lý Quỹ Cầu Lông 5AM (RISE & SHINE - V3.1) — theo dõi điểm danh, lịch chơi, tồn kho cầu, chi phí sân, quỹ cố định thành viên, phí vãng lai, công nợ, VietQR và báo cáo tài chính minh bạch.

> **AI HANDOFF DOCUMENTATION**:
> If you are an AI coding assistant resuming work on this repository, **you MUST read [`docs/ai-handoff.md`](docs/ai-handoff.md) first**!

---

## 📌 Status Checkpoint
- **Completed Phases**: Phase 1, Phase 2, Phase 3, Phase 3 Recon, Phase 4, Phase 4 Recon, Phase 4.5, Phase 5A (Report Layer), Phase 5B (Admin Dashboard UI).
- **Test Gate**: **262 / 262 Tests PASS (100%)** across 14 test suites in `backend/src/tests/`.
- **Frontend Build**: PASS (`npm run build` in `frontend/`)
- **Backend Build**: PASS (`npm run build` in `backend/`)

---

## 🛠 Tech Stack
- **Frontend**: React 18 + Vite + TypeScript + TailwindCSS (`frontend/`)
- **Backend**: Node.js + Express + TypeScript (`backend/`)
- **Database**: SQLite 3 in WAL mode with foreign key constraints enabled.

---

## ⚡ Quick Start Commands

Set Node PATH (Node v20.20.2):
```bash
export PATH=/home/quyet-la/.nvm/versions/node/v20.20.2/bin:$PATH
```

### Run Backend Tests (262 system tests)
```bash
cd backend
npm test
```

### Reset Test Database
```bash
cd backend
npm run db:reset-test
```

### Build Projects
```bash
cd backend && npm run build
cd ../frontend && npm run build
```

---

## 📖 Key Documentation (`docs/`)
- [`docs/ai-handoff.md`](docs/ai-handoff.md) — **Primary Handoff Guide for AI Agents (Read First!)**
- [`docs/phase-status.md`](docs/phase-status.md) — Complete phase status and checkpoint matrix
- [`docs/next-steps.md`](docs/next-steps.md) — Next allowed development action (Phase 5C)
- [`docs/business-rules.md`](docs/business-rules.md) — Verified business formulas and rounding rules
- [`docs/data-flow.md`](docs/data-flow.md) — Data flow specifications & sources of truth
- [`docs/architecture.md`](docs/architecture.md) — System architecture & topology
- [`docs/api.md`](docs/api.md) — Backend REST API specifications
- [`docs/database.md`](docs/database.md) — SQLite 21-table schema dictionary & relationships
- [`docs/workflow.md`](docs/workflow.md) — End-to-end business workflows
- [`docs/decision-log.md`](docs/decision-log.md) — Architectural decision record
- [`docs/testing-strategy.md`](docs/testing-strategy.md) — Test suite breakdown and testing strategy
