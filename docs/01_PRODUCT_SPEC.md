# Especificação do produto

Status: **canônico, nível conceitual**
Fase implementada mais recente: 7 — Performance & Derived Metrics Engine

## Visão

Uma plataforma pessoal para iPhone que reúne planejamento e execução de treino, histórico corporal, recuperação, nutrição e inteligência longitudinal. O diferencial é um Personal Trainer por IA que conhece somente o contexto autorizado, explica suas recomendações e aprende com decisões e resultados registrados.

## Usuário e contexto inicial

O usuário inicial é um único atleta usando o próprio iPhone. Não se assume neste momento marketplace, relação treinador-cliente, uso familiar, comunidade ou operação multi-tenant comercial. O produto deve, porém, manter isolamento por usuário desde o modelo de segurança.

## Objetivos do usuário

- registrar uma sessão rapidamente e sem perder o foco;
- executar uma prescrição e comparar planejado versus realizado;
- acompanhar progressão, aderência, recuperação e tendências;
- receber análises explicáveis que utilizem histórico relevante;
- entender por que uma mudança foi sugerida e se funcionou;
- acompanhar alimentação sem misturar estimativas com fatos registrados;
- manter uma memória longitudinal controlável e auditável.

## Capacidades planejadas

1. Perfil do atleta, objetivos, disponibilidade, preferências e limitações.
2. Catálogo de exercícios, músculos, equipamentos, instruções e substituições.
3. Programas estruturados em blocos, semanas, dias e prescrições.
4. Workout Runner para séries, carga, repetições, RIR, descanso e notas.
5. Motor de performance para métricas, PRs, tendências e progressão.
6. Check-ins de sono, fadiga, dor muscular, energia, estresse e motivação.
7. Peso, medidas e progresso corporal.
8. Metas e histórico nutricional, alimentos, refeições, macros e calorias.
9. Coach IA para análises, hipóteses, recomendações e decisões.
10. Athlete Dossier e revisões pós-treino, semanais e mensais.
11. Integração futura e consentida com Apple Health/HealthKit.

## Experiência desejada

### Durante o treino

A ação principal fica acessível com uma mão. A última série serve de referência, valores são editáveis, o descanso é visível e falhas de rede não apagam trabalho. Alertas não bloqueiam ações comuns sem motivo de segurança.

### Fora do treino

O usuário encontra tendências e explicações antes de dados brutos extensos, mas consegue rastrear cada conclusão até suas evidências. Recomendações distinguem claramente proposta, decisão aceita e mudança efetivamente aplicada.

### Com a IA

A conversa não é a única interface nem a fonte oficial dos dados. A IA recebe contexto mínimo e estruturado, declara limitações, não inventa medições e não altera plano ou fatos sem um fluxo explícito de aceite.

## Resultados de produto a validar

- menor atrito para registrar uma sessão completa;
- alta integridade e recuperabilidade do histórico;
- entendimento das recomendações e confiança calibrada;
- capacidade de avaliar se mudanças estratégicas melhoraram métricas escolhidas;
- uso longitudinal sem sobrecarga de entrada de dados.

Metas numéricas ainda não foram definidas e não devem ser inventadas antes de pesquisa/uso real.

## Fora do escopo atual

UI final, prescrição automática, programa de treino, integração Gemini, aconselhamento clínico, HealthKit, analytics, nutrição detalhada e monetização.

## Estado após a Phase 1

Existe um shell mobile executável e navegável, sem capacidades de domínio. As cinco áreas provisórias são Hoje, Treino, Nutrição, Progresso e Personal. Cada tela declara explicitamente seu estado de placeholder; isso não implica que treino, nutrição, analytics ou IA estejam implementados.

## Estado após a Phase 3

O usuário pode criar conta e entrar por e-mail/senha, concluir onboarding, restaurar a sessão, editar dados fundamentais e acrescentar pesagens sem destruir o histórico. O app persiste nome preferido, nascimento, altura, timezone IANA, objetivo, experiência, rotina, duração, ambiente, disponibilidade, observações e preferências. Cada campo tem uso futuro identificado para personalização ou Training Engine; sexo, nutrição e informações de localização exata não são coletados.

Hoje apresenta somente saudação, objetivo e peso mais recente efetivamente persistidos. As demais áreas continuam declarando ausência de implementação; nenhum resultado fictício é tratado como real.

## Estado após a Phase 4

A tab Treino oferece uma biblioteca canônica de anatomia e 37 exercícios comuns, com nomes PT/EN, busca por nomes/aliases, filtros factuais, instruções originais, músculos, equipamentos e relações explícitas. Ausência de mídia é informada sem imagem simulada. O catálogo descreve movimentos e não prescreve séries, repetições, carga, intensidade, descanso ou progressão.

## Estado após a Phase 5

A tab Treino lista programas reais por lifecycle e apresenta o programa ativo. Um builder manual cria um draft usando o catálogo canônico, com blocos, semanas, dias, exercícios e alvos explícitos por série para reps, segundos ou metros, RIR, descanso, tempo e carga. Ativação é transacional; uma nova revisão clona a estrutura com novos UUIDs e preserva o original. Substituir o ativo arquiva o programa anterior sem representá-lo como concluído; conclusão normal continua sendo uma ação explícita. Prescrição representa intenção planejada; performance representará execução observada somente na Phase 6.

## Questões abertas

## Estado após a Phase 6

Workout Session registra execução observada em aggregate próprio, com snapshot da prescrição, retomada online, séries completed/skipped, correção enquanto em andamento e histórico imutável após conclusão ou abandono. **Performance records reality; divergence from prescription is valid data.** Extras, substituições, analytics, progressão e interpretação foram postergados.

## Estado após a Phase 7

Progresso apresenta fatos históricos recalculados a partir de Raw Performance: contagens, reps, attainment, melhores cargas registradas, Epley v1 e histórico cronológico por exercício. **Derived Data must be reproducible from Raw Data. Missing measurement is not failure. Estimated performance is not measured performance.** Não há scores, tendências interpretativas, progressão ou Coach.

- nome e identidade visual do produto;
- idioma inicial da interface;
- estratégia offline e sincronização detalhada;
- unidades preferidas e suporte métrico/imperial;
- política de privacidade, retenção, exportação e exclusão;
- regras clínicas e locais de escalonamento;
- fontes e licenças para catálogo e mídia de exercícios/alimentos;
- métricas prioritárias e critérios de sucesso por fase.

## Phase 8 — dossiê longitudinal

Projeção versionada sob demanda com contexto mínimo, programa ativo, fatos de 7/28 dias e períodos anteriores, exposição por exercício, deltas, cobertura carga/RIR/descanso, peso mais recente e evidências limitadas. Reps, segundos e metros permanecem separados. O dossiê organiza evidência; não interpreta nem recomenda.

## Estado após a Phase 9

A tab Personal aceita perguntas e renderiza análise estruturada. A conversa mantém até seis mensagens anteriores somente em memória. Não há persistência de chat, autonomia, aplicação de recomendação ou alteração de programa. **The AI may interpret evidence, but it may not redefine facts. The AI proposes; deterministic systems validate; humans retain control.**

## Phase 10 — Propostas e decisão humana

Após uma análise, o atleta pode pedir opcionalmente uma proposta concreta. Toda proposta mostra mudança, motivo, evidência, limitações e programa/revisão de origem. O atleta pode rejeitar ou revisar; somente a ação explícita **Criar revisão em rascunho** materializa uma nova revisão. Não há aprovação, aplicação ou ativação automática. O histórico de decisões preserva proposed, rejected, stale e materialized; rejeição não treina o modelo.

## Phase 11 — Resposta observada a alterações

Depois que uma revisão criada a partir de uma proposta é **ativada**, o produto acompanha as primeiras sessões do mesmo exercício e mostra a comparação antes/depois com amostras, cobertura e limitações. Proposta sem ativação não é intervenção. A tela usa “Resposta observada”, “Comparação antes/depois”, “Evidência disponível” e “Poucos dados após a alteração”; nunca “funcionou”, sucesso ou efetividade. **Post-intervention change is evidence, not proof of causation.** O histórico acumulado por exercício e dimensão é contexto factual para o Personal, sem adaptação automática, score ou aprendizado de máquina. O objetivo anterior “entender se funcionou” permanece como intenção de produto, agora explicitamente limitado a evidência observacional.

## Phase 12 — Memória de resposta

O produto passa a organizar, por exercício e tipo de alteração, todas as intervenções ativadas anteriores: o que foi realmente ativado, quantas eram comparáveis, quais tinham mudanças simultâneas, variações numéricas observadas (contagem de positivas, zero e negativas, com amostras) e quando os episódios apontaram em direções diferentes. **Response Memory remembers observations, not truths.** O Personal considera essa memória como evidência observacional; ela nunca vira regra automática, preferência aprendida, valor ideal ou classificação do atleta. Não há botão para "ensinar" o Personal nem marcação manual de causa; feedback subjetivo, se existir no futuro, será Raw Data separado.
