# Personal Trainer por IA

Status: **canônico, conceitual**
Este documento não é o System Prompt definitivo.

## Papel

O Coach interpreta contexto estruturado, comunica padrões, levanta hipóteses, recomenda ações e acompanha seus resultados. Ele não é calculadora oficial, banco de dados, profissional clínico nem autoridade autônoma para alterar fatos e planos.

A Phase 7 não introduz IA. Derived Performance é calculada deterministicamente e poderá futuramente entrar no Context Builder com fórmula, versão, unidade e proveniência. O Coach não recalcula, reclassifica ou reescreve esses resultados.

## Pipeline

```text
Authenticated request
  -> AI Gateway
  -> Input Safety Gate
  -> Context Builder
  -> Coach Orchestrator
  -> deterministic tools / retrieval
  -> LLM Provider Adapter
  -> Output Schema Validation
  -> Output Safety Gate
  -> user-visible response + auditable metadata
```

Gates podem interromper, restringir contexto, solicitar confirmação ou devolver orientação segura sem chamar o LLM.

## Contratos conceituais

### AI Gateway

Autentica, autoriza, limita uso, aplica idempotência, correlaciona logs e seleciona o fluxo. Nunca aceita uma instrução do cliente como autorização para ler todo o histórico.

### Context Builder

Monta contexto mínimo para a finalidade declarada. Separa Raw, Derived e Coach Intelligence; inclui fontes, datas, unidades, versões e frescor; exclui dados sem consentimento ou sem relevância.

### Coach Orchestrator

Escolhe template/policy versionada, solicita ferramentas determinísticas e exige uma saída estruturada. Recomendações que mudam estratégia geram proposta para o Decision Ledger, não mutação direta.

### Safety Layer

Detecta sinais, limita escopo e impede conselhos incompatíveis com as regras de segurança. Regras críticas devem ser determinísticas quando possível; moderação do provider é defesa adicional, não única.

### Provider Adapter

Contrato interno aproximado: modelo/capacidades, mensagens estruturadas, tool calling, schema de saída, timeout, cancelamento, consumo e erros normalizados. O adapter Gemini fica apenas no backend.

## Athlete Dossier e memória

A memória longitudinal é curada, tipada, referenciada e revogável. Não enviar o dossier inteiro por padrão. Um novo aprendizado requer evidência e pode permanecer como hipótese até avaliação. Contradições não são resolvidas por sobrescrita silenciosa.

Memória deve distinguir:

- fato atual confirmado;
- histórico/snapshot;
- padrão derivado;
- observação do coach;
- hipótese não confirmada;
- decisão e resultado.

## Saídas e ações

Respostas futuras devem preferir schema validável com: resumo, evidências citadas por ID, interpretação, incertezas, recomendações, riscos/safety, perguntas necessárias e ação proposta. Texto livre é renderização, não contrato de negócio.

O modelo não executa diretamente mudanças irreversíveis. Ações propostas passam por validação de domínio, safety e, quando relevante, confirmação do usuário.

## Proveniência mínima

Registrar request/correlation ID, propósito, versão do contexto/policy/prompt, provider, modelo, parâmetros relevantes, IDs de evidência, resultado validado, safety outcome, latência e uso/custo disponível. Não persistir cadeia de pensamento nem dados sensíveis desnecessários.

## Avaliação futura

- grounding em evidências fornecidas;
- consistência com métricas determinísticas;
- utilidade e clareza;
- calibragem de incerteza;
- taxa de saída inválida;
- comportamento diante de sinais de risco;
- não invenção de dados;
- estabilidade suficiente entre providers.

Fixtures sintéticas e dados anonimizados devem anteceder testes com dados reais.

## Questões abertas

Modelo Gemini inicial, estratégia de custos, retenção pelo provider, regiões, streaming, embeddings/RAG, policy de consentimento, ciclos de memória e requisitos jurídicos. Nenhuma dessas escolhas está aprovada nesta fase.

## Dossier boundary before AI

Phase 8 não integra LLM. O futuro Personal AI recebe `AthleteTrainingDossier` versionado e futuramente drill-down específico de evidência; acesso irrestrito ao banco não é sua interface primária. Recomendações futuras exigem schema, validação determinística e aprovação humana/policy.

## Contrato implementado na Phase 9

O Coach é técnico, longitudinal, conservador e orientado pela evidência individual. A prioridade é dossier, métricas determinísticas, contexto canônico, declaração atual e conhecimento geral. Strings do atleta são dados não confiáveis separados da policy `coach-system-v1`.

`CoachAnalysisRequest v1` contém dossier, pergunta, modo e até seis mensagens. `CoachAnalysis v1` separa resumo, observations, hypotheses, recommendations revisadas por humano, questions, uncertainties, evidenceUsed e safetyFlags. Confiança baixa/média/alta é qualitativa. JSON e evidence IDs são validados; referência inexistente invalida toda análise. Não há tools, DB, web, mutations ou chain-of-thought. Gemini é adapter HTTP server-side e testes usam fixture provider. Chat não é persistido.

## CoachProposal v1

Proposal generation é uma segunda chamada opcional (`coach-proposal-v1`) para reduzir custo e intervention bias. `{"proposal": null}` representa no-change. Actions permitidas: `adjust_prescription_target`, `adjust_prescription_rir`, `adjust_prescription_rest` e `adjust_absolute_load_target`. Cada action carrega rationale, evidence e IDs de day/prescription/set fornecidos. Add/remove set e replace exercise foram postergados; não existe patch genérico.

Output do provider é não confiável: Zod valida o envelope e o domínio revalida ownership, source/revision, evidence e invariantes. Safety flags que bloqueiam training advice impedem proposal. O prompt não solicita chain-of-thought e proíbe medical adaptation, mutations e ativação. Falha de geração não invalida a análise anterior. A cadeia futura é `Decision → ProgramRevision → Workouts → Derived Performance → Longitudinal Signals → Outcome Evaluation`; outcome scoring não pertence a esta fase.

## Phase 11 — Prior interventions como contexto

O dossier v2 fornece `interventionHistory` (até 10 decisões) com status de outcome, mudanças proposta/ativada, amostras, comparações e limitações; evidências `coach_decision` passam a ser citáveis e validadas pelo grounding existente. `coach-system-v2` e `coach-proposal-prompt-v2` exigem tratar outcomes como evidência observacional, respeitar amostras, citar confounding, não afirmar causalidade, não prometer resposta futura e não repetir/reverter mudança só pelo sinal de um delta. A cadeia `Decision → ProgramRevision → Workouts → Derived Performance → Outcome Evaluation` agora existe como projeção factual; interpretação continua humana/Coach e nunca altera prompts, proposals ou programas automaticamente.

## Phase 12 — Coach Learning Policy

O dossier v3 envia `responseMemory` bounded; o Coach pode citar `response_memory_group` e `coach_decision` validados pelo grounding existente. `coach-system-v3` instrui: memória é observacional; repetição não é causalidade; nenhum padrão vira regra; considerar amostras, confounders, cobertura e o valor ativado; declarar observações contraditórias; não descartar episódios contrários; não dizer que o atleta "responde melhor" sem qualificação; não assumir repetição; conhecimento geral não apaga evidência individual; evidência individual não é experimento; toda recomendação segue validator e aprovação humana. `coach-proposal-prompt-v3`: a memória nunca autoriza proposta por si e um delta positivo passado não basta para repetir. Linguagem adequada: "Em duas intervenções comparáveis…", "Os episódios observados apontaram em direções diferentes", "Há apenas uma intervenção comparável". Sem web, RAG, embeddings, chain-of-thought ou multi-agentes.

## Phase 13 — Prompts v4

`coach-system-v4` acrescenta a política de quantidade de séries (não é volume muscular; mais/menos não é melhor/pior; planejado ≠ concluído; nunca volume ótimo). `coach-proposal-prompt-v4` gera `coach-proposal-v2` com add/remove estruturados, mudanças pequenas e opcionais, sem repetir/reverter mudanças por deltas passados. O modelo não gera UUIDs finais; a validação determinística e a aprovação humana continuam obrigatórias.

## Runtime das Edge Functions

`coach-analyze`, `coach-propose` e `coach-decide` inicializam no runtime Deno local do Supabase (ADR-0067). Sem `GEMINI_API_KEY`, as functions de IA respondem de forma normalizada (`503 coach_unavailable`) após a autenticação; nenhuma chave vai ao cliente. A chamada real ao Gemini não faz parte da validação local.

## Phase 14 — Prompts v5 e candidatos

O dossier v5 traz `exerciseReplacementCandidates` apenas para os exercícios do programa ativo. `coach-system-v5` afirma que troca muda identidade do movimento, relação é contexto e não equivalência, nunca comparar carga ou 1RM entre exercícios, nunca transferir PR nem converter carga, histórico de trocas é observacional e safety prevalece. `coach-proposal-prompt-v5` gera `coach-proposal-v3`: IDs só dos candidatos, relação obrigatória, transição de carga explícita, sem uso de troca como tratamento, sem repetir troca por observação passada; a proposta continua opcional.

## Phase 15 — Iniciativa proativa governada

Nenhum prompt ou contrato de IA foi alterado (`coach-proposal-v3`, `coach-system-v5`, `coach-proposal-prompt-v5` permanecem). O modelo não recebe nem produz classe de revisão; texto do modelo como "baixo risco" não tem efeito. Em modo proativo, `coach-analyze` pode fazer uma segunda chamada (proposta) após a análise, contando no rate limit; safety que bloqueia orientação de treino impede a chamada. `coach-propose` (manual) aceita `analysisRequestId` e devolve a proposta já existente sem nova chamada. Limitação conhecida: o fluxo manual ainda recebe a análise de volta do cliente, e o rate limit é em memória por instância.

## Correção pós-Implementation Phase 15 — Análise autoritativa

Nenhum contrato de IA mudou (`coach-analysis-v1`, `coach-system-v5`, `coach-proposal-prompt-v5`, `coach-proposal-v3`, dossier v5). A análise validada (schema + grounding contra o dossier da análise + safety de saída) é gravada como registro autoritativo antes de ser devolvida. A proposta usa o snapshot como interpretação e valida evidências, IDs e candidatos contra o dossier e o programa **atuais**; se o programa ativo mudou desde a análise, responde `409 stale_analysis` sem chamar o provider. Resolve a limitação da Implementation Phase 15 (análise devolvida pelo cliente no fluxo manual). O rate limit continua em memória por instância.

## Implementation Phase 16 — Autoridade fora do modelo

Nenhum prompt ou contrato mudou (`coach-system-v5`, `coach-proposal-prompt-v5`, `coach-proposal-v3`, dossier v5, outcome v3, IRE v4, memória v3). O modelo não recebe nem produz elegibilidade de auto-draft; texto como "aplicar automaticamente" é ignorado. A mesma `analysisRequestId` com outra pergunta ou contexto → `409 analysis_request_conflict` sem chamada ao Gemini.

## Implementation Phase 17 — Dossier v6 e prompts v6

`athlete-training-dossier-v6` adiciona `draftReviewHistory` compacto (até 8 itens: decisão, origens, estado, categorias, valores preparado/revisado, referências) sem estrutura de programa nem proposta duplicada; v5 permanece histórico. `coach-system-v6` = v5 + política de revisão: supervisão não é correção; ativação não prova acerto; edição não prova erro; nunca inferir confiança do atleta; nunca pedir/expandir autonomia a partir do histórico; fisiologia vem só de interventionHistory/responseMemory; sem taxas ou scores. `coach-proposal-prompt-v6` = v5 + regra: ativação sem alterações não justifica repetir, edição/arquivamento não proíbe; saída continua `coach-proposal-v3`. Novo tipo de evidência aditivo `coach_draft_review` (mesmo padrão de `response_memory_group`), sem mudar as versões `coach-analysis-v1`/`coach-proposal-v3`.

## Implementation Phase 18 — Dossier v7

`athlete-training-dossier-v7` = v6 com evidência de revisão v2 (`matchingStrategy`, categoria `sequence_changed`). Prompts permanecem `coach-system-v6` e `coach-proposal-prompt-v6`: as regras de raciocínio não mudaram e o modelo nunca recebe identificadores de linhagem.

## Implementation Phase 20 — Sinais de progressão determinísticos (ADR-0118)

`athlete-training-dossier-v8` = v7 + `progressionSignals` (`progression-signals-v1`). O sistema decide se as 3 sessões concluídas mais recentes de uma prescrição ficaram todas acima do planejado (valor ≥ alvo máximo e RIR > RIR máximo) ou todas abaixo (valor < alvo mínimo e RIR < RIR mínimo). Com carga absoluta prescrita, o sistema também calcula a faixa de carga: +2,5% a +5% (0,5 kg, mínimo +1 kg) ou −5% a −10%. Com carga escolhida pelo atleta, o sinal pede só orientação. `coach-proposal-prompt-v7` = v6 + regra de usar a faixa. A validação rejeita carga fora da faixa e mudança de carga do programa em sinal de orientação. O modelo interpreta e pode não propor nada; ele não calcula a faixa. `coach-system-v6`, `coach-analysis-v1` e `coach-proposal-v3` não mudaram.

## Implementation Phase 21 — Programa inicial pelo Personal (ADR-0119)

`initial-program-prompt-v1` deriva de `docs/11_PERSONAL_SPEC.md` (`personal-spec-v1`): conhecimento integrado sem afirmar credenciais, todos os dados ponderados, limites do sistema, segurança, `cannot_build`, saída em português e instrução de reparo. O modelo recebe fatos calculados, notas do atleta (dados não confiáveis), o envelope e o catálogo permitido; nunca recebe o nome. A saída `initial-program-v1` passa por schema, validação determinística (com uma tentativa de reparo) e revisão humana como rascunho. Os prompts do Coach (`coach-system-v6`, `coach-proposal-prompt-v7`) não mudaram nesta fase; alinhá-los à folha completa fica para uma versão futura.
