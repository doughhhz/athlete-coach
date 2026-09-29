# Motor de treino

Status: **canônico; planejamento físico definido na Phase 5**

## Responsabilidade

Representar prescrição, execução, cálculo de performance e propostas de progressão sem delegar matemática ao LLM. O motor não substitui julgamento clínico e não diagnostica dor ou lesão.

## Modelo de planejamento

```text
Program -> Block -> Week -> Day -> Exercise Prescription
                                      |
                                      v
Workout Session -> Performed Exercise -> Performed Set
```

Prescrição e execução são entidades distintas. Mudanças no programa são versionadas; sessões concluídas continuam ligadas à versão efetivamente utilizada.

Uma prescrição inclui exercício e ordem; cada série planejada possui seu próprio alvo. A métrica é `reps`, `seconds` ou `meters`, com mínimo e máximo positivos. RIR 0–10 e descanso em segundos são faixas opcionais. Tempo usa quatro fases separadas por hífen (`3-1-X-0`), onde `X` indica intenção explosiva. Carga é não prescrita, escolhida pelo atleta/orientada por RIR, ou absoluta em kg. Percentual de 1RM e progressão não existem nesta fase.

## Lifecycle e revisão

Drafts são editáveis. A ativação valida toda a hierarquia e ocorre atomicamente. A regra originalmente aprovada dizia que ativar uma revisão concluía o ativo anterior; essa parte foi superseded pela ADR-0025 porque registrava como conclusão normal um ciclo apenas substituído. Agora, ativar qualquer novo draft, independente ou revisão, arquiva o ativo anterior na mesma transação e não preenche `completed_at`. Estruturas ativas, concluídas e arquivadas são protegidas por triggers. Uma revisão editável é um clone completo com novos UUIDs e lineage para o programa anterior. `completed` significa ciclo encerrado normalmente por conclusão explícita; `archived` significa retirado/guardado, inclusive por substituição, e não implica conclusão.

Regra canônica: **conclusão registra o término normal do lifecycle. Substituição aposenta o programa anterior, preservando sua prescrição histórica e lineage.**

Supersets/circuitos foram postergados: uma entidade de grouping sem semântica de execução validada criaria ambiguidade para o futuro Runner. Ordem explícita sustenta o core atual.

## Ciclo de uma sessão

1. preparar snapshot da prescrição;
2. iniciar sessão localmente com ID e timestamps;
3. registrar séries de modo incremental e resiliente;
4. aplicar validações e cálculos determinísticos;
5. concluir/cancelar explicitamente;
6. sincronizar com idempotência;
7. produzir métricas derivadas;
8. opcionalmente solicitar análise do Coach usando os resultados calculados.

## Implementação da execução na Phase 6

Criar a sessão significa começar: `in_progress -> completed | abandoned`. Start copia atomicamente a hierarquia necessária e snapshots planejados, mantendo source IDs. Um workout iniciado no Programa A permanece ligado a A mesmo após replacement por B. Completed exige todas as séries completed ou skipped; abandoned preserva performance e deixa pendentes como não executadas, sem convertê-las artificialmente em skipped.

Performance registra realidade e não é obrigada a coincidir com a prescrição. Correções são aceitas enquanto a sessão está ativa; estados terminais e filhos ficam imutáveis. Descanso usa timestamps opcionais como fonte de verdade e duração da sessão é derivada. Extra sets, substituição manual, analytics e progressão foram postergados.

## Métricas determinísticas

Definições finais e fórmulas serão aprovadas antes de código. Exemplos previstos:

- volume de repetições: soma de repetições válidas;
- tonelagem: soma de carga × repetições, respeitando unidade e convenção por exercício;
- sets e frequência por exercício/grupo e janela;
- aderência: realizado versus prescrito com política explícita;
- RIR médio ponderado ou não, conforme decisão documentada;
- e1RM por fórmula versionada e aplicabilidade definida;
- PRs por categoria comparável;
- quedas de performance dentro/entre sessões;
- intervalos de descanso a partir de timestamps confiáveis;
- tendências com janela, mínimo de amostras e tratamento de outliers definidos.

Não existe uma única definição universal para volume, aderência, PR ou readiness. Escolhas devem entrar no Decision Ledger e nos metadados do cálculo.

### Fórmulas implementadas na Phase 7

- duração terminal: `completed_at|abandoned_at - started_at`, em segundos inteiros;
- target/RIR/rest attainment: comparação inclusiva com ranges; missing é `not_measured` ou `not_planned`;
- reps, seconds e meters são somados separadamente apenas em sets completed;
- `epley-v1`: 1 rep retorna carga registrada; 2–12 reps usam `load_kg × (1 + reps/30)`; outros casos são inelegíveis;
- PR é específico do exercício, exige valor estritamente maior que todo valor anterior e nunca transforma a primeira observação em evento.

`actual_load_kg` não possui semântica biomecânica uniforme entre implementos. Por isso não existe tonelagem, trabalho mecânico ou agregação global de cargas. Comparações permanecem dentro do mesmo exercício canônico e a UI usa “carga registrada”.

## Progressão

Progressão é uma política determinística configurável, não texto livre do LLM. Uma política recebe histórico elegível, prescrição, resultado, recuperação relevante e constraints; retorna proposta e explicação estruturada. A IA pode interpretar a proposta ou sugerir revisão, mas não inventa cálculos.

Mudanças potencialmente estratégicas entram como recomendação e exigem aceite explícito antes de alterar a versão ativa do programa.

## Invariantes iniciais

- carga e reps não podem ser silenciosamente alteradas pela IA;
- toda grandeza tem unidade;
- uma série concluída pertence a uma única sessão e exercício realizado;
- correções após conclusão mantêm autoria e histórico;
- cálculos excluem dados inválidos segundo regra explícita e registram o motivo;
- falha de rede não deve apagar uma série confirmada localmente;
- séries de aquecimento, trabalho, falha e técnicas especiais devem poder ser diferenciadas no futuro sem suposições atuais.

## Testes futuros essenciais

Fórmulas, conversões de unidade, arredondamento, sessões incompletas, duplicação por retry, correção histórica, fusos horários, séries sem carga externa e regressões após mudança de algoritmo.

## Longitudinal signals v1

Últimos 28 dias civis são comparados aos 28 anteriores. `absoluteDelta = current - previous`; `relativeDelta = (current - previous) / abs(previous)` só com denominador não-zero. Frequência é sessões distintas com série concluída. Carga/e1RM seguem exercise-specific/Epley v1. Não há tendência qualitativa, causalidade, tonelagem ou recomendação.

## Phase 9 Coach boundary

O Coach recebe métricas calculadas e pode interpretá-las, mas não recalcula performance nem produz `ProgramRevision`. `training_adjustment` é somente proposta textual com `requiresHumanReview = true`; não há CTA, RPC ou mutation para aplicá-la.

## Phase 10 — Materialização controlada

Uma `CoachProposal` nunca é um `ProgramRevision`. O validator reutiliza `assertPrescriptionSet` para target, RIR, descanso e carga e proíbe mudança de métrica, IDs pendentes e operations não suportadas. Na aprovação, o baseline deve continuar ativo na mesma revisão. A RPC cria novos IDs e revision/lineage pelo mesmo modelo de clone da Phase 5, altera somente sets-alvo no novo draft, preserva a origem e não ativa. Retry de decisão materializada retorna o mesmo ledger/draft.

## Phase 11 — Intervention outcomes (`intervention-outcome-v1`)

- Exposição: sessão completed/abandoned com ≥1 série completed do mesmo exercício canônico; skipped/pending/in_progress não contam.
- Baseline: até 3 exposições mais recentes antes de `activated_at`. Post: até 3 primeiras exposições do programa de intervenção após `activated_at`; a janela fecha ao completar 3 ou quando o programa deixa de estar ativo.
- Escopos: todas as séries do exercício e séries da prescrição alterada.
- Métricas por escopo: séries por exposição (só exercício), média de reps/segundos/metros por série, maior carga registrada, melhor e1RM `epley-v1`, taxa dentro do alvo, cobertura de carga, cobertura/atingimento/média de RIR, cobertura/atingimento/média do descanso medido. Médias são fatos descritivos da janela, não tendência.
- `absoluteDelta = after − before`; `relativeDelta = (after − before)/|before|`, null se before for 0 ou valor ausente. Arredondamento pertence à apresentação.
- e1RM e carga só são comparados dentro do mesmo `exercise_id`; troca de exercício é limitação e não comparação.
- Limitações determinísticas incluem ações concorrentes, edição manual, valor ativado diferente, exercício trocado, exposições ausentes/insuficientes/desiguais, janela aberta ou encerrada cedo, baseline de outros programas ou de intervenção anterior, RIR/descanso/carga ausentes ou parciais e peso corporal indisponível/alterado (apenas contexto, sem ajuste de performance).
- Add/remove set e frequência não são interventions suportadas; aprendizado de volume/frequência permanece futuro.

## Phase 12 — Response Memory (`individual-response-memory-v1`)

- Grupo: `exercise_id` + dimensão (`target`, `planned_rir`, `planned_rest`, `absolute_load`) + métrica para `target`; key `exerciseId.dimension[.metric]`.
- Assinatura: valores ativados antes → depois; direção estrutural apenas quando inequívoca (faixas: ambos limites no mesmo sentido ou um fixo; alargar/estreitar = `mixed`).
- Strict comparable: alteração ativada identificável, exposições antes/depois, sem confounder estrutural, observação da dimensão presente e comparação relevante com delta. Não é experimento controlado.
- Agregados sobre strict: contagens de sinais, ausentes, mín., máx., mediana (média par = média dos dois centrais), totais de amostras. Sem média, sem agregação de deltas relativos, sem pesos de recência.
- Volume, frequência e seleção de exercício continuam sem grupos: faltam interventions add/remove set, scheduling e replace exercise.

## Phase 13 — Set count

- Add: série anexada ao fim com snapshot explícito; remove: set existente; sequências renumeradas 1..n; mínimo de 1 set por prescrição; remoções/ajustes duplicados e cópia de set removido são rejeitados.
- Contagem líquida por prescrição: `beforeSetCount`, `afterSetCount`, `absoluteDelta`. Remove + add com contagem igual não é intervenção de `set_count`.
- Outcome: séries planejadas, concluídas e reps por exposição (denominador = exposições que contêm sets do escopo), carga registrada, e1RM, target, RIR e descanso, sempre separando planejado de concluído.
- Proibido: volume muscular, sets efetivos/hard sets, stimulus, tonnage, workload, MEV/MAV/MRV, número ótimo de séries, progressão automática.

## Phase 14 — Troca de exercício

- Candidatos: relação armazenada obrigatória, direção preservada, catálogo canônico, sem IDs inventados.
- Materialização: séries, alvos, RIR, descanso e tempo preservados; carga pela `loadTransition` (`preserve_non_absolute` só sem carga absoluta, `athlete_selected`, `explicit_absolute` nova). Sem conversão de carga.
- Outcome: baseline do exercício de origem e pós do exercício ativado lado a lado (séries planejadas/concluídas, reps por exposição, alvo, cobertura de RIR/descanso); carga registrada e 1RM estimado não comparáveis entre exercícios; PRs nunca transferidos; histórico prévio do novo exercício separado.
- Futuro, não implementado: intervenção de frequência e modelagem de volume por músculo.

## Phase 15 — Governança de mudanças na prescrição

`coach-governance-v1` classifica pela direção estrutural em demanda de treino, sem limiares de magnitude e sem escore numérico:

- **Revisão padrão** (menos exigente por construção): aumento de RIR planejado, aumento de descanso planejado, redução de carga absoluta, redução de séries — somente quando é a única ação.
- **Revisão reforçada**: troca de exercício (sempre; carga absoluta explícita na troca adiciona razão), mudança de alvo (sempre), aumento de séries ou mudança de estrutura, redução de RIR ou descanso, aumento ou introdução de carga absoluta, múltiplas ações, múltiplas prescrições, direções mistas de demanda e qualquer dúvida (baseline ausente, faixa que não muda de forma inequívoca).
- **Bloqueada** (nunca persistida): safety bloqueia orientação de treino, proposta inválida, ação desconhecida ou vazia.

Toda avaliação tem `requiresHumanReview: true`, `allowsAutomaticMaterialization: false` e `allowsAutomaticActivation: false`.

## Implementation Phase 16 — Auto-draft conservador

`coach-auto-draft-v1`: elegível apenas quando a proposta tem **uma** ação, sobre **uma** prescrição existente, sem mudar identidade do exercício nem estrutura de séries, e a governança a classifica como `standard_review` exclusivamente por aumento de RIR, aumento de descanso ou redução de carga absoluta existente. Remover série é `standard_review` na governança, mas é **inelegível** para auto-draft v1 (mudança estrutural). Sem limiares de magnitude (sem 5%/10%/20%); a magnitude fica visível para revisão humana. Rascunho automático não é intervenção executada: outcomes e memória só começam após ativação humana.

## Implementation Phase 17 — Diferenças de revisão

Categorias factuais: `exercise_changed`, `set_added`, `set_removed`, `target_changed`, `rir_changed`, `rest_changed`, `load_changed`, `tempo_changed`, `prescription_added`, `prescription_removed`, `program_structure_changed`; correspondência posicional (bloco/semana/dia/prescrição/série). Sem severidade (menor/maior). Mudanças fora das prescrições da proposta são registradas em `changesOutsideProposal`. Tempos factuais: `timeUntilActivationSeconds` e `timeUntilArchiveSeconds` (sem "hesitação", sem idade dependente de agora). Revisão acontece antes da camada de outcome: outcomes e memória continuam começando só na ativação humana.
