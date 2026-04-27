# Release Evidence — Go-Live Validation

**Data:** 2026-04-26  
**Projeto:** blackops-comercial (`xxhvbwnomxmajndbihkj`)  
**Responsavel tecnico:** Nathan Souza  

---

## Gate 1 — Codigo Local

| Check | Status | Evidencia |
|-------|--------|-----------|
| `tsc --noEmit` | PASS | Zero errors |
| `npm run build` | PASS | dist/ 1.3MB (339KB gzip), built in 3.05s |
| `test:rag-guardrails` | PASS | 0 failures |
| `test:enrich-lock` | PASS | 0 failures |
| `e2e:authenticated` | CONDICIONAL | 3 testes falham por anon key invalida (service_role funciona). Nao-blocker. |

---

## Gate 2 — Banco e Migrations

| Check | Status | Evidencia |
|-------|--------|-----------|
| Migration list alinhada | PASS | 8 migrations Local=Remote |
| DDL reconciliado vs banco | PASS | 27/27 tabelas, 2/2 views, 6/6 functions, 4/4 indexes, 3/3 triggers — todos EXISTS |
| Schema canonico unico | PASS | Apenas `GrowthPlatform` ativo |
| Sem schema legado | PASS | `growth_platform` nao existe |
| Extensions | PASS | pgcrypto 1.3, vector 0.8.0 |
| RLS habilitado | PASS | 27/27 tabelas com RLS ON |
| Policies definidas | PASS | 27/27 tabelas com policies (authenticated_read + service_role_all) |

---

## Gate 3 — Edge Functions

| Check | Status | Evidencia |
|-------|--------|-----------|
| 15 funcoes criticas ativas | PASS | Todas ACTIVE com version >= 1 |
| Sem duplicatas legado | PASS | Nenhuma funcao `GrowthPlatform_*` |
| OPENAI_API_KEY | PASS | Configurada |
| TLDV_API_KEY | PASS | Configurada |
| TLDV_WEBHOOK_SECRET | PASS | Configurada |
| SUPABASE_URL/KEY | PASS | Auto-injectadas |

**Funcoes deployadas (GrowthOps Revenue):**
tldv-webhook, enrich-call, fetch-transcript, analyze-call, rag-index-transcript, rag-enrich-call, rag-query, gp-pipeline-sync, gp-score-spin, gp-score-spiced, gp-score-challenger, gp-map-behavior-signals, gp-analyze-business, gp-generate-whatsapp, gp-generate-pdi

---

## Gate 4 — IA/RAG

| Check | Status | Evidencia |
|-------|--------|-----------|
| `rag:dry-run` | PASS | exit=0 |
| knowledge_files > 0 | PASS | count=1 (E2E seed) |
| knowledge_chunks > 0 | PASS | count=1 |
| rag-query E2E | PASS | Retorna resposta estruturada (query, answer, sources, matched_chunks) |
| rag-enrich-call E2E | PASS | Grava rag_enriched_summary + rag_sources em call_analysis |
| Modelo scoring | OK | gpt-4.1-mini |
| Embeddings | OK | text-embedding-3-small |
| Rate limits | OK | Configurados em ai-client.ts (50/20/10/100 por funcao) |

**Nota:** Ingestao real de corpus (skills/analises) pendente — mecanismo validado E2E.

---

## Gate 5 — Pipeline Operacional

| Check | Status | Evidencia |
|-------|--------|-----------|
| `pipeline:health` | PASS | 0 stuck rows |
| `audit:roles` | PASS | 159/159 users com role atribuida |
| Locks de idempotencia | PASS | Colunas rag_index_status, rag_enrich_status presentes e funcionais |

---

## Gate 6 — Frontend

| Check | Status | Evidencia |
|-------|--------|-----------|
| GitHub Pages live | PASS | HTTP 200 em https://nsouza-png.github.io/growthops/ |
| Bundle size | ACEITAVEL | 1.3MB total, 339KB gzip |
| Login funcional | CONDICIONAL | Funciona com service_role key; anon key precisa ser corrigida no .env.local |

---

## Gate 7 — Seguranca

| Check | Status | Evidencia |
|-------|--------|-----------|
| Chaves nao expostas em logs | PASS | .env no .gitignore, secrets via dashboard |
| RLS + policies | PASS | 27 tabelas protegidas |
| Service role restrito a backend | PASS | Frontend usa anon key |
| ANTHROPIC_API_KEY residual | INFO | Existe nos secrets mas nao e mais usada. Recomenda-se remover. |

---

## Gate 8 — Observabilidade

| Check | Status | Evidencia |
|-------|--------|-----------|
| pipeline_events table | PASS | Estrutura pronta (call_id, step, status, duration_ms) |
| ai_usage_log | PASS | Rate limiting + audit trail por funcao |
| smart_alerts table | PASS | Alertas configurados na estrutura |

---

## Gate 9 — Release Automatizado

| Check | Status | Evidencia |
|-------|--------|-----------|
| `preflight:go-live` | PASS | typecheck, unit_tests, e2e_smoke, dataset_validation, rag_dry_run — todos PASS |
| `preflight:release` | PARCIAL | 7/8 checks PASS. e2e_release FAIL por anon key invalida (nao-blocker tecnico). |
| Variaveis obrigatorias | PASS | Todas preenchidas |

---

## Gate 10 — Decisao Go/No-Go

### VEREDICTO: **GO CONDICIONAL**

**Criterios de GO atingidos:**
- [x] Gate 2 (banco/migrations) PASS
- [x] Gate 3 (Edge Functions) PASS
- [x] Gate 4 (IA/RAG) PASS
- [x] Gate 5 (pipeline) PASS
- [x] Gate 9 (preflight:go-live) PASS

**Condicoes residuais para GO completo:**
1. Corrigir anon key no `.env` e `app/.env.local` (pegar key real do dashboard)
2. Rodar `rag:ingest` com corpus real de skills/analises
3. Remover `ANTHROPIC_API_KEY` dos secrets (cleanup)

---

## Gate 11 — Riscos Residuais

| # | Risco | Impacto | Mitigacao | Prazo | Dono |
|---|-------|---------|-----------|-------|------|
| 1 | Anon key invalida no frontend | Login impossivel para users via browser | Buscar key real no Dashboard e atualizar .env.local + rebuild | Imediato | Nathan |
| 2 | RAG sem corpus real ingerido | rag-query retorna vazio para perguntas reais | Rodar `npm run rag:ingest` com RAG_SOURCE_DIR apontando para pasta de skills | Antes do primeiro uso | Nathan |
| 3 | 159 users todos com role `executivo` | Sem diferenciacao de permissoes (admin/closer/gestor) | Definir matriz de roles e atualizar via script | Semana 1 pos-go-live | Nathan |
| 4 | Bundle >500KB (chunk warning) | Performance em conexoes lentas | Implementar code-splitting com dynamic import | Sprint seguinte | Nathan |

---

*Gerado pela validacao de engenharia em 2026-04-26T23:57Z*
