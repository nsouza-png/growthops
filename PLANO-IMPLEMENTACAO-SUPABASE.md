# Plano seguro: implementar o projeto local no Supabase (remoto)

Este documento descreve um fluxo **ordenado e reversível** para alinhar o que está no repositório (`growthops-main`) com um **projeto Supabase remoto** (Postgres, histórico de migrations, Edge Functions e segredos). Use-o antes de go-live ou ao recuperar um ambiente com *drift*.

**Documentos relacionados:** `GO-LIVE-RUNBOOK.md`, `ROLLBACK-CHECKLIST.md`, `SYSTEM-LLM-HANDOFF.md`.

---

## 1. Objetivo e escopo

| Inclui | Não substitui |
|--------|----------------|
| Vincular o CLI ao projeto correto | Política de backup físico do Supabase (planos pagos) |
| Aplicar **somente** as migrations em `supabase/migrations/` | Migração de dados massiva entre orgs (trate à parte) |
| Orientar deploy de Edge Functions em `supabase/functions/` | CI/CD da sua empresa (integre depois deste plano) |
| Validar schema `GrowthPlatform` e RAG | Alteração de código da aplicação Vite |

**Contrato canônico no repositório**

- Migrations ativas (ordem):  
  `20260426010000_baseline_canonical.sql` → `20260426011000_rag_vector_store.sql` → `20260426012000_rag_call_output_columns.sql` → `20260426013000_rag_processing_locks.sql` → `20260426015000_gamefilm_contract_alignment.sql`
- Funções: apenas `supabase/functions/` (mais `_shared`).
- API: o `config.toml` expõe o schema `GrowthPlatform` na API — o remoto deve refletir o mesmo modelo após as migrations.

---

## 2. Princípios de segurança (leia antes de executar)

1. **Confirme o projeto** no Dashboard (ref do projeto) e compare com `supabase link` / `supabase/.temp/project-ref`. Erro de projeto = DDL no banco errado.
2. **`supabase migration repair --status applied` não executa SQL.** Ele só ajusta a tabela de histórico. Se marcar como `applied` sem o banco ter recebido o arquivo, o CLI pode **pular** `db push` e você fica com **histórico “verde” e schema incompleto**. Sempre valide com queries de existência (seção 7).
3. **SQL Editor** aceita apenas SQL. Não cole comandos de terminal (`npx`, `supabase`, caminhos de arquivo).
4. **Janela de mudança:** prefira horário de baixo uso; avise quem consome a API.
5. **Segredos:** após testes em terminal com URLs/chaves, considere **rodar chaves** no Dashboard se houve vazamento em histórico de shell ou chat.

---

## 3. Pré-requisitos

### 3.1 Ferramentas

- Node.js (compatível com o `package.json` do monorepo).
- Supabase CLI **via projeto** (ex.: `npx supabase --version` — alinhado a `^2.95.x` no `package.json`).
- Conta Supabase com permissão no projeto alvo.
- **Opcional:** Docker Desktop — necessário para `supabase start` / alguns fluxos de `db dump` locais; **não** é obrigatório só para `link` + `db push` + `functions deploy` no remoto.

### 3.2 Autenticação CLI

```powershell
npx supabase login
```

Guarde o token com segurança.

### 3.3 Raiz do repositório

Todos os comandos `npx supabase` abaixo pressupõem o diretório raiz do repositório (`growthops-main`), onde existem `supabase/config.toml` e `supabase/migrations/`.

---

## 4. Fase 0 — Congelar referência e checar projeto

1. Anote: **nome do projeto**, **ref** (string tipo `abcdefghijklmnop`), **org**.
2. No Dashboard: **Settings → General → Reference ID** — deve coincidir com o link local.
3. Link (se ainda não estiver linkado):

```powershell
cd "C:\caminho\para\growthops-main"
npx supabase link --project-ref SEU_PROJECT_REF
```

4. Confirme o link:

```powershell
type supabase\.temp\project-ref
```

---

## 5. Fase 1 — Inventário: histórico de migrations local vs remoto

```powershell
npx supabase migration list --linked
```

**Interpretação:**

- Colunas **Local** e **Remote** iguais para as cinco versões canônicas → histórico alinhado (ainda assim valide **objetos** na Fase 7).
- Versões só no remoto, ausentes na pasta local → *drift* ou repo antigo; **não** force `db push` sem estratégia (ver seção 6).
- Versões só no local → `db push` tende a aplicar as pendentes, se o remoto aceitar a ordem.

---

## 6. Fase 2 — Escolher o cenário (o ponto mais crítico)

### Cenário A — Projeto novo / vazio de migrations do GrowthOps

- Histórico remoto vazio ou irrelevante **e** equipe concorda que este repo é a fonte da verdade.
- Próximo passo: **Fase 4** (`db push`) após conferir que não há dados de produção que dependam de schema antigo.

### Cenário B — Remoto já tem migrations antigas não presentes neste repo

- Sintoma típico: erro do tipo *Remote migration versions not found in local migrations directory* (ver `GO-LIVE-RUNBOOK.md`).
- Ações possíveis (escolha **uma** linha com o time):
  - **B1 — Alinhar repo ao remoto:** `supabase db pull` (ou restaurar do Git) os arquivos que faltam, depois evoluir só com novas versões incrementais.
  - **B2 — Ambiente descartável:** criar **novo** projeto Supabase, linkar, `db push` do zero, reconfigurar secrets e front; migrar dados depois.
  - **B3 — Repair cirúrgico:** `supabase migration repair` **apenas** com entendimento explícito de cada versão marcada como `reverted` ou `applied`. Nunca use repair para “sumir” com erro sem ler a documentação oficial do comando para aquela versão do CLI.

### Cenário C — `migration list` mostra aplicado, mas o schema não existe (o mais perigoso)

- Causa típica: repair marcou `applied` sem executar os arquivos, ou SQL falhou no meio.
- Plano seguro:
  1. **Não** assuma que está íntegro.
  2. Para as **cinco** versões canônicas, alinhe o histórico com a **realidade** (comandos `repair` para `reverted` **somente** onde a equipe tiver certeza de que o SQL **não** foi aplicado — documente cada passo).
  3. Em seguida rode **`npx supabase db push --linked`** e acompanhe a saída; se algo falhar, pare e corrija (forward-fix migration nova, nunca editar arquivo já “oficialmente” aplicado no remoto sem coordenação).

---

## 7. Fase 3 — Aplicar DDL: `db push`

Quando o histórico estiver coerente com a intenção do Cenário A ou após corrigir C:

```powershell
npx supabase db push --linked
```

- Leia toda a saída. Erros de permissão, extensão `vector`, ou objeto já existente indicam ação específica (nem sempre repetir o push resolve).
- **Não** edite migrations canônicas já aplicadas no remoto para “consertar” — prefira um novo arquivo `YYYYMMDDHHMMSS_descricao.sql`.

---

## 8. Fase 4 — Edge Functions

Deploy das funções ativas (ajuste a lista ao que existir na pasta):

```powershell
npx supabase functions deploy --help
```

Padrão comum (exemplo — confira nomes reais em `supabase/functions/`):

```powershell
npx supabase functions deploy tldv-webhook --project-ref SEU_PROJECT_REF
npx supabase functions deploy enrich-call --project-ref SEU_PROJECT_REF
# ... demais funções listadas em supabase/functions/README.md
```

**Secrets** (Dashboard → Project Settings → Edge Functions → Secrets, ou CLI `secrets set`): alinhe com o que `_shared/env.ts` e cada função esperam (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, chaves OpenAI, tl;dv, etc.). Sem isso o pipeline quebra em runtime, mesmo com schema correto.

---

## 9. Fase 5 — Auth, URL e CORS

1. **Auth → URL configuration:** `SITE_URL` e redirect URLs compatíveis com o host do app (dev/staging/prod).
2. Se o front chama funções diretamente do browser, valide **CORS** e políticas conforme documentação Supabase para a sua versão.

---

## 10. Fase 6 — Validação técnica do banco

Execute no **SQL Editor** do Dashboard **ou** no terminal com query remota (CLI 2.95+):

```powershell
npx supabase db query --linked "select to_regclass('""GrowthPlatform"".calls') as calls, to_regclass('""GrowthPlatform"".user_roles') as user_roles;"
```

Checklist mínimo (todos devem resolver para OID/regclass não nulo onde aplicável):

- [ ] Schema `GrowthPlatform` existe.
- [ ] Tabelas centrais: `calls`, `call_analysis`, `user_roles` (e demais do handoff).
- [ ] RAG: `knowledge_files`, `knowledge_chunks`; função `public.match_knowledge_chunks` (ou equivalente definido na migration RAG).
- [ ] Extensões: `vector` (e outras exigidas pelo baseline).

Para inspecionar versão do servidor:

```sql
show server_version;
```

Compare com `major_version` em `supabase/config.toml` (hoje 17) — divergência grande pode exigir ajuste antes de próximos dumps locais.

---

## 11. Fase 7 — Validação operacional (scripts do repo)

Defina variáveis de ambiente (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, etc.) e rode na raiz:

| Comando | Objetivo |
|---------|----------|
| `npm run pipeline:health` | Chamadas presas no pipeline |
| `npm run audit:roles` | Coerência de papéis / tabelas esperadas |
| `npm run rag:runtime-check -- <call_uuid>` | RAG em cima de uma call real com transcript |

Gate de release (exige envs de E2E e call de teste — ver `GO-LIVE-RUNBOOK.md`):

```powershell
npm run preflight:release
```

**E2E:** `E2E_RAG_CALL_ID` deve ser UUID válido de `GrowthPlatform.calls.id` com `transcript_text` preenchido para o gate exercitar RAG de ponta a ponta.

---

## 12. Fase 8 — Aplicação front (Vite)

1. Em `app/.env.local` (ou variáveis do host): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` do **mesmo** projeto.
2. Subir o app e validar login + rota crítica (ex.: fluxo coberto por `npm run e2e:authenticated`).

---

## 13. Rollback e incidentes

- **DDL:** preferir **nova migration** que desfaça o efeito; rollback manual só em janela controlada (`ROLLBACK-CHECKLIST.md`).
- **Função problemática:** redeploy da versão anterior (Git) ou desabilitar gatilho na cadeia que a invoca.
- **Dados / RAG:** isolar por `call_id` e limpar vetores com `source = call:<call_id>:transcript` quando aplicável.

---

## 14. Referência rápida: erros frequentes

| Sintoma | Causa provável | Ação |
|---------|----------------|------|
| `relation "GrowthPlatform.xxx" does not exist` | Migrations não aplicadas ou projeto errado | Fases 0, 6, 7; depois `db push` |
| `Remote migration versions not found...` | Histórico remoto ≠ pasta `migrations/` | Seção 6 cenário B |
| `unknown command "sql"` | CLI sem subcomando `sql` | Usar `db query` ou SQL Editor |
| Erro SQL na linha `npx` | Comando de shell colado no SQL Editor | Rodar no PowerShell |
| Playwright não loga | Falta `VITE_*` no startup do dev server | Ver `GO-LIVE-RUNBOOK.md` |
| `snapshot:schema:linked` falha no Windows | Docker / link | Usar `npm run snapshot:schema` ou export manual |

---

## 15. Checklist final (go / no-go)

- [ ] Project ref confirmado em Dashboard e `supabase link`.
- [ ] `migration list --linked` coerente com a decisão do cenário A/B/C.
- [ ] `db push --linked` concluído sem erro ignorado.
- [ ] Funções deployadas + secrets definidos.
- [ ] Queries da seção 10 passando.
- [ ] `pipeline:health` e `audit:roles` OK.
- [ ] `preflight:release` OK (quando for critério de corte).
- [ ] Front aponta para o mesmo projeto; smoke manual ou E2E.

Quando todos os itens estiverem marcados, o ambiente remoto está **alinhado ao contrato** deste repositório para operação do GrowthOps.
