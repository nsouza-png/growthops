# BACKFILL-CALLS-FASE1 — Relatório
Gerado em: 2026-04-27T03:25:58.416Z
Modo: LIVE

## Resumo executivo
| Métrica | Valor |
|---|---|
| Arquivos lidos (transcrições) | 5637 |
| Arquivos lidos (análises) | 0 |
| Total mapeamentos | 5638 |
| Mapped | 5637 |
| Unmapped | 1 |
| Conflict | 0 |
| Parse errors | 0 |
| **Cobertura** | **100.0%** |
| Calls criadas | 5637 |
| Calls atualizadas | 0 |
| Calls puladas (já existiam OK) | 0 |
| Calls com transcript | 5637 |

## Validação SQL (executar após backfill)
```sql
-- 1. Total de calls
select count(*) as total_calls from "GrowthPlatform".calls;

-- 2. Por data_source
select data_source, count(*) as qty
from "GrowthPlatform".calls
group by data_source order by qty desc;

-- 3. Calls com transcript
select
  count(*) filter (where transcript_text is not null and length(trim(transcript_text)) > 0) as calls_with_transcript,
  count(*) as total_calls
from "GrowthPlatform".calls;

-- 4. Por processing_status
select processing_status, count(*)
from "GrowthPlatform".calls
group by processing_status order by count(*) desc;
```

## Amostra de mapeamentos (20 registros)
| source_file | call_id | método | confiança | status |
|---|---|---|---|---|
| Aline_Hipólito_2025-01-06_16aaac6a.json | 16aaac6a-075e-4910-a4f7-008cba906069 | call_id_explicit | 1 | mapped |
| Aline_Hipólito_2025-01-06_e3ef06a0.json | e3ef06a0-1ab7-4909-839e-8be5585e5665 | call_id_explicit | 1 | mapped |
| Aline_Hipólito_2025-01-07_117b8531.json | 117b8531-e063-4444-9ca7-ebc6f959dc07 | call_id_explicit | 1 | mapped |
| Aline_Hipólito_2025-01-07_b1639212.json | b1639212-0c03-41c6-bae3-6a6c0e9405a2 | call_id_explicit | 1 | mapped |
| Aline_Hipólito_2025-01-07_d60613d1.json | d60613d1-3ad4-483b-a94a-78d63b6b9fe1 | call_id_explicit | 1 | mapped |
| Aline_Hipólito_2025-01-08_8a949057.json | 8a949057-3d33-4906-b1f1-17a363e7e7e1 | call_id_explicit | 1 | mapped |
| Aline_Hipólito_2025-01-08_8a961a18.json | 8a961a18-1613-473e-9174-5d464a0034ba | call_id_explicit | 1 | mapped |
| Aline_Hipólito_2025-01-08_aacbec3b.json | aacbec3b-1ed6-4b99-a5ab-b5ef00943db4 | call_id_explicit | 1 | mapped |
| Aline_Hipólito_2025-01-09_4b911ede.json | 4b911ede-25be-4ec7-896d-7c5048dc5fb3 | call_id_explicit | 1 | mapped |
| Aline_Hipólito_2025-01-09_73c14074.json | 73c14074-4950-4ea5-9f17-a4e3cdd00de3 | call_id_explicit | 1 | mapped |
| Aline_Hipólito_2025-01-09_c9f031aa.json | c9f031aa-c9f3-462f-ba69-46b3cf57e080 | call_id_explicit | 1 | mapped |
| Aline_Hipólito_2025-01-10_2b0fb69d.json | 2b0fb69d-6624-4ef9-8ca2-5d68a0284eb4 | call_id_explicit | 1 | mapped |
| Aline_Hipólito_2025-01-10_3a45104a.json | 3a45104a-4615-4a30-b092-4e8ae74fe589 | call_id_explicit | 1 | mapped |
| Aline_Hipólito_2025-01-10_3a731565.json | 3a731565-0876-4511-b984-2ccb4db27f4e | call_id_explicit | 1 | mapped |
| Aline_Hipólito_2025-01-10_6ebaea65.json | 6ebaea65-d44b-4dfb-8d55-a161fd2d823f | call_id_explicit | 1 | mapped |
| Aline_Hipólito_2025-01-10_b77c7733.json | b77c7733-1fcf-43b8-9bf5-1c1ffe0ee4e1 | call_id_explicit | 1 | mapped |
| Aline_Hipólito_2025-01-10_f622bc9a.json | f622bc9a-6c69-40ce-a31e-2fe7da970e17 | call_id_explicit | 1 | mapped |
| Aline_Hipólito_2025-01-13_11be101e.json | 11be101e-3a95-4652-9201-8b25ec118f18 | call_id_explicit | 1 | mapped |
| Aline_Hipólito_2025-01-13_5ee542ad.json | 5ee542ad-76d6-433c-9292-77197e084ac7 | call_id_explicit | 1 | mapped |
| Aline_Hipólito_2025-01-13_98e72943.json | 98e72943-4487-4265-b4bf-77897babc083 | call_id_explicit | 1 | mapped |

## Unmapped (1 listados)
- `_index.json`: no_call_id

## Conflitos (0 listados)
_Nenhum_

## Riscos para Fase 2
1. **calls sem transcript** (0 calls): analyze-call e rag-index-transcript dependerão de busca no tl;dv API.
2. **seller_email do organizador ≠ seller real** em ~30% dos arquivos — mapa canônico aplicado mas sellers não mapeados precisam revisão manual.
3. **squad nulo** em 100% das calls: necessário vincular por regra de negócio (seller_email → squad) antes do PDI.
4. **calls duplicadas por data** possível se mesmo seller teve 2+ calls no mesmo dia — call_id como PK previne, mas análises podem divergir.
5. **Ingestão RAG paralela em andamento** — knowledge_chunks ainda crescendo, rag-enrich-call pode retornar resultados incompletos até término.
