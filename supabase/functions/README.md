# Canonical Edge Functions (Go-Live)

This directory contains only active edge functions used by the current system flow.

Current active groups:

- Ingestion pipeline: `tldv-webhook`, `enrich-call`, `fetch-transcript`, `analyze-call`
- Scoring pipeline: `gp-pipeline-sync`, `gp-score-spiced`, `gp-score-spin`, `gp-score-challenger`, `gp-map-behavior-signals`, `gp-analyze-business`
- Product actions: `generate-followup`, `gp-generate-whatsapp`, `gp-generate-pdi`
- Live analysis: `gp-analyze-live-chunk`
- Knowledge/RAG: `rag-index-transcript`, `rag-enrich-call`, `rag-query`
- Shared runtime: `_shared`

Deprecated edge functions should be removed from this tree (or replaced in-place); do not keep parallel legacy copies in the repo.
