# Checklist Completo — Validação de Engenharia (End-to-End)

Objetivo: validar de forma auditável se o sistema está pronto para uso real (go-live), cobrindo banco, edge, IA/RAG, frontend, segurança, observabilidade e operação.

Use junto com `DEPLOY-CHECKLIST.md`, `GO-LIVE-RUNBOOK.md`, `ROLLBACK-CHECKLIST.md` e `PLANO-IMPLEMENTACAO-SUPABASE.md`.

---

## 0) Dados da validação (preencher antes)

- [ ] Data/hora da execução:
- [ ] Ambiente: `staging` / `produção` / `teste`:
- [ ] Project ref Supabase:
- [ ] Responsável técnico:
- [ ] Commit/branch validado:

---

## 1) Gate de código local

### 1.1 Build e tipagem

- [ ] `cd app && npx tsc --noEmit` = PASS
- [ ] `cd app && npm run build` = PASS

### 1.2 Testes essenciais

- [ ] `npm run test:rag-guardrails` = PASS
- [ ] `npm run test:enrich-lock-unit` = PASS
- [ ] `npm run test:enrich-lock` = PASS
- [ ] `npm run e2e:authenticated` = PASS (ou justificativa formal se adiado)

Evidências (cole links/prints/logs):

- [ ] Evidência anexada

---

## 2) Gate de banco e migrations

### 2.1 Alinhamento de histórico

- [ ] `npx supabase migration list --linked` sem divergência indevida Local/Remote
- [ ] Não há migration marcada como `applied` sem DDL realmente aplicada

### 2.2 Estrutura canônica

- [ ] Apenas schema canônico ativo: `GrowthPlatform`
- [ ] Não existe schema legado paralelo (`growth_platform`)
- [ ] Tabelas críticas existem (`calls`, `user_roles`, `call_analysis`, `knowledge_files`, `knowledge_chunks`)
- [ ] Extensões críticas existem (`vector`, `pgcrypto`)
- [ ] Função `public.match_knowledge_chunks` existe

### 2.3 Segurança de dados

- [ ] RLS habilitado em 100% das tabelas do schema crítico
- [ ] Policies revisadas para acesso mínimo necessário

Evidências:

- [ ] Query outputs anexados

---

## 3) Gate de Edge Functions

### 3.1 Inventário ativo

- [ ] Funções críticas ativas:
  - [ ] `tldv-webhook`
  - [ ] `enrich-call`
  - [ ] `fetch-transcript`
  - [ ] `analyze-call`
  - [ ] `rag-index-transcript`
  - [ ] `rag-enrich-call`
  - [ ] `rag-query`
  - [ ] `gp-pipeline-sync`
  - [ ] `gp-score-spin`
  - [ ] `gp-score-spiced`
  - [ ] `gp-score-challenger`
  - [ ] `gp-map-behavior-signals`
  - [ ] `gp-analyze-business`
  - [ ] `gp-generate-whatsapp`
  - [ ] `gp-generate-pdi`

### 3.2 Higiene de naming/legado

- [ ] Não existem funções duplicadas de legado (ex.: `GrowthPlatform_*`)
- [ ] Não existem aliases antigos roteando para endpoints errados

### 3.3 Secrets e configuração

- [ ] `OPENAI_API_KEY` configurada e válida
- [ ] `SUPABASE_URL` configurada
- [ ] `SUPABASE_SERVICE_ROLE_KEY` configurada
- [ ] Secrets de integrações externas (tl;dv, webhooks, etc.) configuradas
- [ ] Segredos removidos que não são mais usados (ex.: chaves de provider descontinuado)

Evidências:

- [ ] Lista de funções + versões anexada
- [ ] Confirmação de secrets no dashboard anexada

---

## 4) Gate de IA/RAG

### 4.1 Ingestão

- [ ] `npm run rag:dry-run` = PASS
- [ ] `npm run rag:ingest` executado sem erro
- [ ] `GrowthPlatform.knowledge_files` > 0
- [ ] `GrowthPlatform.knowledge_chunks` > 0
- [ ] Fontes esperadas (ex.: `skills`) presentes em `source`/`metadata`

### 4.2 Recuperação e resposta

- [ ] `rag-query` retorna chunks relevantes para pergunta real
- [ ] `rag-enrich-call` grava saída em `call_analysis` para call de teste válida
- [ ] Campos RAG esperados preenchidos (resumo/fontes/timestamp, conforme contrato)

### 4.3 Custo e limites

- [ ] Modelo padrão alinhado ao plano de custo (ex.: `gpt-4.1-mini`)
- [ ] Embeddings em `text-embedding-3-small`
- [ ] Limites de top-k/caps ativos e auditáveis

Evidências:

- [ ] IDs de call de teste + outputs anexados

---

## 5) Gate de pipeline operacional

### 5.1 Saúde do pipeline

- [ ] `npm run pipeline:health` sem stuck crítico
- [ ] `npm run audit:roles` = PASS
- [ ] Locks de processamento funcionam (idempotência de enrich/index)

### 5.2 Fluxo real ponta a ponta

- [ ] Recebe webhook
- [ ] Busca transcript
- [ ] Analisa call
- [ ] Indexa e enriquece via RAG
- [ ] Persiste no banco sem falha
- [ ] UI reflete dados processados

Evidências:

- [ ] Um `call_id` completo com trilha de eventos anexado

---

## 6) Gate de frontend e experiência

- [ ] Login funcional com ambiente alvo
- [ ] Rotas críticas carregam sem erro
- [ ] Páginas que dependem de `GrowthPlatform` exibem dados reais
- [ ] Sem regressões visíveis nas telas principais
- [ ] Bundle de produção dentro de limite aceitável para o projeto

Evidências:

- [ ] Print/URL/execução E2E anexada

---

## 7) Gate de segurança e governança

- [ ] Chaves não expostas em logs/comandos compartilhados
- [ ] Rotação planejada para qualquer chave potencialmente exposta
- [ ] Auditoria mínima de permissões em service role concluída
- [ ] Webhook signature validation ativa
- [ ] Plano de rollback validado e executável

---

## 8) Gate de observabilidade

- [ ] Logs estruturados com `call_id`, `step`, `status`, `duration_ms`
- [ ] Erros críticos aparecem com contexto de diagnóstico
- [ ] Alertas básicos definidos (falha de função, backlog, stuck pipeline)
- [ ] `RELEASE-EVIDENCE.md` atualizado com evidência da rodada

---

## 9) Gate de release automatizado

- [ ] `npm run preflight:go-live` = PASS
- [ ] `npm run preflight:release` = PASS
- [ ] Variáveis obrigatórias preenchidas (`E2E_TEST_*`, `SUPABASE_*`, `E2E_RAG_CALL_ID`)

---

## 10) Decisão final Go/No-Go

### Critérios de GO

- [ ] Todos os gates críticos (2, 3, 4, 5, 9) em PASS
- [ ] Nenhum risco severo aberto sem mitigação
- [ ] Responsável técnico aprovou com evidência

### Critérios de NO-GO

- [ ] Divergência de migrations/schema
- [ ] Falha em função crítica do pipeline
- [ ] RAG sem ingestão/sem resposta útil
- [ ] `preflight:release` falhando em item obrigatório

---

## 11) Registro de riscos residuais (obrigatório)

- [ ] Risco 1:
  - Impacto:
  - Mitigação:
  - Prazo:
  - Dono:
- [ ] Risco 2:
  - Impacto:
  - Mitigação:
  - Prazo:
  - Dono:

---

## 12) Assinatura da validação

- [ ] Tech Lead:
- [ ] Produto/Operação:
- [ ] Data/hora da aprovação final:
- [ ] Decisão: `GO` / `NO-GO`
