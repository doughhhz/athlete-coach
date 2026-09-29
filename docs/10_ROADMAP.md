# Roadmap incremental

Status: **canônico em sequência; datas não definidas**

Cada fase termina com validação e revisão humana. Concluir uma fase não autoriza iniciar automaticamente a seguinte.

Estado de execução em 2026-09-26: Phases 0 a 6 concluídas; Phase 7 implementada e validada, aguardando revisão humana; Phase 8 não iniciada.

## Phase 0 — Foundation

Constituição, especificação, arquitetura, modelo conceitual, safety, UX, ledger, roadmap, estrutura e Git. Saída: decisões revisáveis, sem app executável.

## Phase 1 — Mobile Shell

Criar Expo + TypeScript estrito, Expo Router, lint/format/testes mínimos, tema e navegação placeholder acessível. Escolher package manager/workspace. Depende da aprovação da Phase 0.

Implementação: concluída em um shell sem dados ou lógica de domínio, conforme ADR-0009 e ADR-0010. A passagem para a Phase 2 depende de revisão humana.

## Phase 2 — Data Architecture

Projetar schema físico, migrations, Auth, RLS, contratos Zod, repositories e estratégia offline/sync. Definir privacidade, retenção e exportação antes de dados reais. Depende de 1 e do modelo conceitual aprovado.

Implementação desta fase: infraestrutura local Supabase reproduzível, identidade mínima `athletes`, grants/RLS, testes pgTAP, tipos gerados e factory tipada concluídos. Contratos Zod, repositories, offline/sync, retenção e exportação permanecem deliberadamente para as capacidades que introduzirem I/O e dados reais; não houve antecipação de um perfil ou modelo completo.

## Phase 3 — Athlete Profile

Perfil, objetivos com histórico, disponibilidade, preferências, constraints e consentimentos. Depende de 2.

Implementação: Auth por e-mail/senha, identidade idempotente, onboarding atômico, perfil editável, objetivo ativo/histórico preservável, contexto/disponibilidade e histórico manual de peso. Consentimento para IA não foi antecipado porque nenhum dado é enviado a provider. Offline sync, exportação e exclusão por UI permanecem gates futuros documentados.

## Phase 4 — Exercise Catalog

Catálogo, músculos, equipamentos, instruções, variações e substituições. Resolver fonte/licença de conteúdo e mídia. Depende de 2; usa preferências/constraints de 3.

Implementação: taxonomia anatômica, catálogo interno bilíngue, aliases, busca/filtros, instruções originais, relações factuais e modelo de proveniência de mídia. O mobile expõe biblioteca e detalhe na tab Treino. Não há prescription, providers externos, ativos de mídia nem escolha contextual de substituição.

## Phase 5 — Training Program Engine

Programas versionados, blocos, semanas, dias, prescrições e políticas determinísticas iniciais. Depende de 3 e 4.

Implementação: agregado físico e tipado, lifecycle transacional, um ativo por atleta, drafts editáveis, histórico imutável, clone de revisão, alvos por série e builder/lista/detalhes mobile concluídos. Correção dirigida da Phase 5: substituição arquiva o ativo anterior, enquanto somente a conclusão explícita registra encerramento normal. Supersets foram postergados; execução observada e progressão permanecem fora de escopo.

## Phase 6 — Workout Runner

Execução resiliente/offline, séries, carga, reps, RIR, descanso, retomada e sincronização idempotente. Depende de 5 e estratégia offline de 2.

Implementação: aggregate de execução, snapshot planejado, performance observada, lifecycle transacional, uma sessão ativa, retomada online, registro/correção/skip, conclusão/abandono e histórico factual. Offline completo, extras e substituições foram postergados explicitamente; nenhuma métrica derivada foi antecipada.

## Phase 7 — Performance Engine

Definições/formulas versionadas, volume, tonelagem, aderência, e1RM aplicável, PRs e tendências. Depende de dados reais estruturados de 6.

Implementação: projections read-only, métricas de sessão, attainment factual, histórico cronológico por exercício, Epley v1 e personal bests conservadores. Tonelagem, scores, tendência interpretativa e progressão foram explicitamente postergados por semântica insuficiente ou pertencimento a fases futuras.

## Phase 8 — AI Coach

AI Gateway, Context Builder, Orchestrator, Safety Layer, schemas, evals e adapter Gemini no backend. Depende de 2, 3, 7 e revisão formal de safety/privacidade. Não inclui autonomia irrestrita.

## Phase 9 — Workout Analysis

Análise pós-treino baseada em métricas calculadas, evidências e recomendações auditáveis. Depende de 7 e 8.

## Phase 10 — Recovery / Readiness

Check-ins de sono, fadiga, dor muscular, energia, estresse e motivação; readiness determinístico/interpretado claramente separado. Depende de 2, 3 e safety; integra com 7/9.

## Phase 11 — Nutrition

Metas, alimentos, porções, refeições, macros, calorias e histórico. Requer fonte/licença, unidades, limites clínicos e revisão de safety. Depende de 2, 3 e 8 apenas onde IA agregar valor.

## Phase 12 — Athlete Dossier

Projeção longitudinal tipada, evidências, frescor, consentimento, invalidação e memória auditável. Depende de 3, 5–11 e protocolo de privacidade.

## Phase 13 — Weekly / Monthly Intelligence

Agregações determinísticas e análises periódicas com decisões/resultados. Depende de 7, 9, 10, 11 e 12, além de volume mínimo de dados.

## Phase 14 — Progress Analytics

Dashboards, comparações, tendências corporais/treino/nutrição e explicações de mudanças. Depende de 7, 10–13 e definições estáveis de métricas.

## Phase 15 — Apple Health / HealthKit

Consentimentos granulares, importação/deduplicação, proveniência e conflitos. Depende de modelo de dados maduro, estratégia de privacidade e fluxos estáveis de 10/14.

## Phase 16 — Advanced Features

Somente após validação: novos providers/modelos, multimodalidade, automações controladas, exportações avançadas, integrações adicionais e personalização profunda. Cada item exige proposta própria, dependências, riscos e critérios de saída.

## Dependências críticas

```text
0 -> 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7
               |                   |
               +-------------------+-> 8 -> 9
2 + 3 + Safety ----------------------> 10
2 + 3 + Safety ----------------------> 11
3 + 5..11 + Privacy -----------------> 12 -> 13 -> 14 -> 15
validated foundation -------------------------------> 16
```

## Gates transversais

Nenhuma fase que manipule dados reais avança sem segurança de acesso e recuperação. Nenhuma fase de IA avança sem schemas, evals, safety, consentimento e observabilidade. Nenhuma fórmula entra sem definição, versão e testes. Nenhuma integração de terceiros entra sem revisar termos, privacidade, disponibilidade e custo.

## Phase 8 — Athlete Training Dossier & Longitudinal Signals — complete

Contrato v1 on-demand, janelas 7/28/lifetime, exposição, comparação, cobertura, evidência limitada e UI factual estão implementados. “Phase 8 — AI Coach” foi superseded pela ADR-0034. AI/Coach permanece Phase 9+; nenhum código de IA foi implementado.

## Phase 9 — Personal AI Foundation — complete

Gateway autenticado, provider boundary, Gemini HTTP server-side, contratos estruturados, grounding, safety pré/pós, prompt versionado, fake provider e UI Personal foram implementados. A antiga “Phase 9 — Workout Analysis” foi absorvida como modos iniciais sem alterar programas. Autonomia, proposals executáveis e ledger runtime permanecem futuros.

## Phase 10 — Structured Coach Proposals — complete

Contrato versionado, geração sob demanda, validator determinístico, Runtime Coaching Decision Ledger, rejeição humana e materialização transacional draft-only foram implementados. O roadmap antigo que chamava Phase 10 de Recovery/Readiness está superseded por esta entrega; Recovery/Readiness permanece futuro. Ativação automática, outcome scoring, causal attribution e aprendizagem/autonomia permanecem explicitamente fora de escopo.

## Phase 11 — Intervention Outcomes & Individual Response Evidence — complete

Episode/activation semantics, fidelity proposta vs ativado, janelas por exposição, comparações factuais versionadas, individual response evidence acumulada, dossier v2, prompts v2, UI factual e correção do re-save de drafts (ADR-0055) foram implementados e validados. Fora de escopo e não implementados: adaptação/aprovação/ativação automática, inferência causal, previsão de volume/frequência ótimos, ML/RL/reward/fine-tuning, score oculto, readiness/fadiga, nutrição, HealthKit, benchmarking populacional, experimentação A/B e Coach autônomo. A antiga numeração “Phase 11 — Nutrition” permanece futura, como na nota da Phase 10.

## Phase 12 — Athlete Response Memory & Coach Learning Policy — complete

IRE v2, Response Memory v1 derivada e bounded, classificação strict/context-only, agregação observacional com contradições explícitas, dossier v3, Coach Learning Policy (prompts v3), UI factual e cenário integrado foram implementados sem tabela ou migration. Fora de escopo e não implementados: mutação/aceite/ativação automáticos, Coach autônomo, inferência ou estimativa causal, ML/RL/reward/bandits/treino de modelo, pesos aprendidos, valores ótimos, scoring muscular, readiness, nutrição, HealthKit, wearables, web/RAG/embeddings e multi-agentes. O nome antigo "Phase 12 — Athlete Dossier" já havia sido absorvido pela Phase 8 (ADR-0034).

## Phase 13 — Set-Count Interventions & Response Learning Expansion — complete

Proposal v2 com add/remove set, validator e espelho puro, RPC transacional, compatibilidade v1, outcome v2 com `set_count`, IRE v3, Response Memory v2, Dossier v4, prompts v4, UI de revisão/builder/outcome/memória e cenário integrado foram implementados. Futuro separado e não implementado: intervenção de frequência, troca de exercício e modelagem de volume por músculo. Fora de escopo: effective/hard sets, landmarks, número ótimo de séries, progressão, aprovação/ativação automáticas, Coach autônomo, causalidade, ML/RL, HealthKit, readiness, nutrição, web/RAG, embeddings e multi-agentes. Dívida registrada: Edge Functions não inicializam no runtime Deno local por resolução de módulos (pré-existente).

## Correção pós-Phase 13 — Edge Functions bootáveis no Deno

Import map versionado e extensões `.ts` explícitas tornaram as três Edge Functions inicializáveis no runtime local, com smoke HTTP. Sem nova funcionalidade nem alteração de regra de negócio; nenhuma Phase 14 iniciada.

## Phase 14 — Exercise Replacement Intelligence & Cross-Exercise Outcome Semantics — complete

Auth antes da configuração do provider, candidatos determinísticos por relação, `coach-proposal-v3` com transição de carga, RPC revalidando no banco, outcome v3 com pares entre exercícios sem deltas, IRE v4, memória v3 com pares direcionados, dossier v5, prompts v5, UI e cenário integrado foram implementados. Fora de escopo: troca automática, ranking/melhor exercício, conversão de carga, delta de 1RM/carga entre exercícios, transferência de PR, frequência, volume muscular, aprovação/ativação automáticas, Coach autônomo, causalidade, ML/RL, HealthKit, nutrição, web/RAG e multi-agentes.

## Phase 15 — Coach Governance, Proactive Mode & Risk-Based Review Classes — complete

Numeração de fase de implementação (a "Phase 15 — Apple Health / HealthKit" acima pertence ao plano original de produto e continua futura). Política determinística `coach-governance-v1`, preferência de autonomia manual/proativa com opt-in, envelope de governança no ledger, idempotência por `analysisRequestId`, orquestração proativa isolada em `coach-analyze`, revalidação e confirmação de revisão reforçada na materialização, UI e cenário integrado. Fora de escopo: materialização ou ativação automáticas, agente em background/agendado, escore de risco médico, ML/RL, "Conservative Auto-Draft" (apenas documentado), Phase 16.

## Convenção de numeração (ADR-0081)

- **Product Roadmap Phase N**: plano original de produto neste documento (ex.: Product Roadmap Phase 15 — Apple Health / HealthKit, ainda futura).
- **Implementation Phase N**: sequência de execução (ex.: Implementation Phase 15 — Coach Governance, Proactive Mode & Risk-Based Review Classes, concluída).

Seções históricas não foram renumeradas. Relatórios e prompts futuros devem sempre qualificar a numeração; "Phase 16" sem qualificador é ambíguo.

## Correção pós-Implementation Phase 15 — Authoritative Coach Analysis Handoff — complete

Registro autoritativo `coach_analysis_runs`, handoff de proposta só por `analysisRequestId`, rejeição de payload forjado, análise idempotente, semântica de desatualização antes do provider e decisões ligadas a registros não bloqueados. Fora de escopo: Conservative Auto-Draft, materialização/ativação automáticas, Coach em background, persistência de chat, memória vetorial, web/RAG, ML/RL, Apple Health, nutrição e qualquer Implementation Phase 16.

## Implementation Phase 16 — Conservative Auto-Draft Authority & Idempotent Analysis Request Binding — complete

Fingerprint de requisição com conflito 409, preferência `draft_authority_mode` separada e opt-in, política `coach-auto-draft-v1`, RPC backend-only sobre o motor único de materialização, provenance `human | auto_draft` com `approved_at` apenas humano, UI "Rascunho preparado", cenário integrado de 31 passos. Fora de escopo: ativação automática, mutação do programa ativo, auto-draft de troca/estrutura/alvo, Coach em background ou agendado, proposta automática pós-treino, push, adaptação médica, escore de risco, ML/RL, web/RAG, Apple Health, nutrição, multi-agentes e qualquer Implementation Phase 17.

## Implementation Phase 17 — Human Review Evidence & Auto-Draft Audit Loop — complete

Projeção derivada `coach-draft-review-evidence-v1` e histórico `coach-draft-review-history-v1` (sem migration), dossier v6, prompts v6, UI factual de revisão e "Revisões do Personal", cenário integrado de 23 passos. Fora de escopo: reward, score, taxas, feedback subjetivo, aprendizado de política, ampliação de auto-draft, ativação automática, Coach em background, ML/RL e qualquer Implementation Phase 18.

## Implementation Phase 18 — Stable Training Structure Lineage & Identity-Preserving Revision Diffs — complete

Linhagem estável nos cinco níveis, atribuição controlada pelo servidor, fallback legado explícito, matcher canônico único para revisão e fidelidade, evidência de revisão v2, dossier v7 e cenário integrado de 22 passos. Fora de escopo: ampliação de auto-draft, ativação automática, reward/score, ML/RL, Coach em background e qualquer Implementation Phase 19.
