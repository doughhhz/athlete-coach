# Motor de treino

Status: **canônico, conceitual**

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

Uma prescrição poderá incluir exercício, ordem, séries, faixa de repetições, carga/intensidade alvo, RIR/RPE alvo, descanso, tempo/cadência e observações. Nem todos os campos serão obrigatórios para todo método.

## Ciclo de uma sessão

1. preparar snapshot da prescrição;
2. iniciar sessão localmente com ID e timestamps;
3. registrar séries de modo incremental e resiliente;
4. aplicar validações e cálculos determinísticos;
5. concluir/cancelar explicitamente;
6. sincronizar com idempotência;
7. produzir métricas derivadas;
8. opcionalmente solicitar análise do Coach usando os resultados calculados.

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
