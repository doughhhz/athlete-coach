# Roadmap incremental

Status: **canônico em sequência; datas não definidas**

Cada fase termina com validação e revisão humana. Concluir uma fase não autoriza iniciar automaticamente a seguinte.

Estado de execução em 2026-09-25: Phases 0 a 4 concluídas; Phase 5 implementada e aguardando revisão humana; Phase 6 não iniciada.

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

Implementação: agregado físico e tipado, lifecycle transacional, um ativo por atleta, drafts editáveis, histórico imutável, clone de revisão, alvos por série e builder/lista/detalhes mobile concluídos. Supersets foram postergados; execução observada e progressão permanecem fora de escopo.

## Phase 6 — Workout Runner

Execução resiliente/offline, séries, carga, reps, RIR, descanso, retomada e sincronização idempotente. Depende de 5 e estratégia offline de 2.

## Phase 7 — Performance Engine

Definições/formulas versionadas, volume, tonelagem, aderência, e1RM aplicável, PRs e tendências. Depende de dados reais estruturados de 6.

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
