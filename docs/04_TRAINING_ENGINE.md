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
