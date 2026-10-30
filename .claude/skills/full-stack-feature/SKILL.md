---
name: full-stack-feature
description: Add a feature that spans FitTrack AI's backend and frontend (new endpoint + UI) following the project's contract-first workflow.
---

# Full-stack feature (contract first)

1. **Contract** — add/modify the endpoint and JSON shapes in `docs/API.md`.
2. **Backend**
   - Request schema in `backend/app/schemas/`, serializer in `app/api/serializers.py` (or the service's `serialize_*`).
   - Logic in `app/services/<domain>/`; thin route in `app/api/routes/<domain>.py` (already included via `app/main.py`).
   - Model change? Follow the `db-migration` skill.
   - Recompute affected days (`daily.recompute`) and schedule `sync_if_enabled` after mutations.
3. **Frontend**
   - Types in `frontend/src/lib/types.ts`, hook in `src/hooks/use-<domain>.ts`, UI in `src/components/<feature>/`, page stays thin.
   - SweetAlert2 confirm for destructive actions, sonner toast for results, "?" InfoTip with a glossary entry for any new metric.
4. **Verify** — curl the endpoint (2xx, correct numbers), `npm run lint && npm run build`, click through in light/dark and at phone width.
5. **Docs** — README feature table if user-visible; `docs/CALCULATIONS.md` for new formulas; Mermaid diagram in `docs/diagram/` if a flow changed.
