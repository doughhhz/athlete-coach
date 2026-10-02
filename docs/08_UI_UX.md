# Princípios de UI/UX

Status: **canônico, conceitual**

## Mobile first

O iPhone é a plataforma inicial. A interface deve respeitar safe areas, tamanhos de toque, Dynamic Type, VoiceOver, contraste, redução de movimento e modos claro/escuro quando implementados. Nenhuma decisão atual impede Android, mas paridade não é requisito da primeira fase.

## Contexto de treino

Durante uma sessão, o usuário pode estar cansado, com mãos ocupadas e atenção limitada. Portanto:

- ação primária e valores atuais ficam visíveis;
- registrar/editar uma série exige poucos toques;
- controles importantes funcionam com uma mão e têm alvos amplos;
- a próxima ação é inequívoca;
- descanso e progresso da sessão são legíveis de relance;
- confirmações são reservadas a ações destrutivas ou ambíguas;
- rascunhos persistem localmente e toleram interrupção/rede ruim;
- feedback de salvamento/sincronização é honesto;
- nenhum insight da IA bloqueia o registro normal, salvo safety aplicável.

## Hierarquia de informação

Fato, métrica derivada e interpretação do Coach devem ter rótulos e apresentação distinguíveis. Toda recomendação relevante permite ver evidências e estado (`proposed`, `accepted`, etc.). Incerteza não deve ser escondida por linguagem ou visual excessivamente confiante.

## Estados obrigatórios

Componentes e telas futuras consideram: inicial, carregando, vazio, offline, rascunho local, sincronizando, sucesso, erro recuperável, conflito e acesso negado. Skeleton não substitui explicação de espera indefinida. Erros oferecem próximo passo e preservam entrada do usuário.

## Navegação conceitual

Na fundação, as áreas prováveis eram Hoje, Treino, Progresso, Coach e Perfil, ainda como hipótese.

Para o shell da Phase 1, foram adotadas cinco tabs: Hoje, Treino, Nutrição, Progresso e Personal, conforme ADR-0010. Essa decisão valida somente a navegação estrutural da fase; não define a arquitetura de informação final nem afirma que as capacidades estejam implementadas.

O tema possui tokens centrais para light/dark e segue a preferência do sistema. Cores e nome do produto continuam provisórios, sem constituir identidade visual aprovada.

Na Phase 3, a raiz separa configuração, boot, Auth, onboarding obrigatório e app pronto. O onboarding usa oito telas de conteúdo mais a ação de conclusão na revisão: boas-vindas, dados pessoais/peso, objetivo, experiência, rotina, disponibilidade, observações e revisão. Rascunho é local e só é persistido pela confirmação atômica; fechar antes disso pode reiniciar o fluxo. Perfil é acessado por Hoje, sem sexta tab.

Na Phase 4, a tab Treino oferece acesso à Biblioteca de exercícios sem criar nova tab. Lista e busca possuem carregamento, erro recuperável, vazio e sucesso, com filtros por grupo muscular e equipamento. `/exercises/[slug]` mostra somente conhecimento factual, instruções, segurança e relações; ausência de mídia é declarada honestamente. Prescrição e recomendação permanecem ausentes.

Na Phase 5, Treino mostra o programa ativo, lista drafts/ativos/concluídos/arquivados e mantém acesso à Biblioteca. A apresentação distingue “Concluído normalmente” de “Arquivado (retirado)”, para não sugerir que um programa substituído terminou seu ciclo. Detalhes rotulam explicitamente “ALVOS PLANEJADOS”. O builder manual cria uma hierarquia mínima mobile-first, seleciona exercícios do catálogo canônico, valida alvos por série e leva à revisão antes da ativação. Não há ações de iniciar treino ou concluir série.

Na Phase 6, a tab destaca “Continuar treino”, dias ativos oferecem “Iniciar treino” e o Runner separa visualmente PLANEJADO de REALIZADO. Inputs permanecem montados após erro e oferecem retry; o servidor é a autoridade. Completion mostra pendências e abandono exige confirmação. Histórico e resumo exibem apenas fatos, sem score, PR, volume, elogio ou interpretação.

Na Phase 7, Progresso deixa de ser placeholder e mostra resumo factual total, melhores marcas por exercício e lista cronológica selecionável. “1RM estimado” nunca é apresentado como medido; baseline não recebe celebração falsa. Resumos de workout podem exibir reps, attainment e melhor e1RM elegível, sem julgamento, gráfico, score ou recomendação.

Campos mantêm labels, teclado coerente, mensagens não julgadoras e progresso visível. Estado vazio ou erro é textual, nunca uma tela branca ou dado simulado. O date input textual `AAAA-MM-DD` é uma limitação consciente desta versão e deve ser reavaliado com testes reais de acessibilidade/entrada no iPhone.

## Conteúdo e tom

Linguagem breve, específica e não julgadora. Evitar culpa por baixa aderência, jargão desnecessário e antropomorfização que sugira consciência ou autoridade clínica. Datas, unidades e comparações precisam de contexto.

## Acessibilidade e localização

Acessibilidade é critério de aceite, não melhoria posterior. Strings devem ser localizáveis desde a implementação; idioma inicial ainda é questão aberta. Não codificar texto de negócio disperso em componentes.

## Validação futura

Testar registro de série sob tempo, retomada após interrupção, uso offline, correção de erro, compreensão de recomendações, legibilidade, VoiceOver e Dynamic Type. Não produzir UI final antes de protótipos e critérios de fluxo.

## Progress longitudinal facts

Progresso mostra últimos 28 dias, período anterior, deltas numéricos, amostras e cobertura como numerador/denominador. Usa “comparação factual”, “carga registrada” e “1RM estimado”; não mostra score, julgamento, causalidade ou recomendação.

## Phase 9 — Personal

Personal oferece pergunta e estados de loading, sucesso estruturado, erro seguro, indisponibilidade e retry. Separa resumo, observações, hipóteses, sugestões e lacunas; safety aparece naturalmente. Confidence fica auditável sem percentual. Drill-down de evidência foi postergado. Não existe “Aplicar recomendação”.

## Phase 10 — Revisão de proposta

Recomendações elegíveis oferecem **Ver proposta de ajuste** sob demanda. A card mostra origem, rationale, evidence count e limitações; ações são **Rejeitar proposta** e **Revisar proposta**. A tela de revisão resolve o baseline e mostra diff factual Antes/Proposto. O CTA é **Criar revisão em rascunho**, acompanhado de aviso de que o ativo não muda até revisão e ativação posteriores. Sucesso oferece **Revisar rascunho**. Estados stale, loading, error/retry e histórico de decisões permanecem explícitos; não existe “Aplicar automaticamente”.

## Phase 11 — Resposta observada

Progresso ganha **Alterações acompanhadas**: proposta/data, status (aguardando ativação, coletando dados, poucos dados, comparação disponível, não ativada), exercício, alteração antes → aplicada, sessões observadas antes/depois, deltas numéricos e amostras, com estado vazio. No histórico do Personal, decisões com dados oferecem **Ver resposta observada**, que mostra ANTES, DEPOIS, DIFERENÇA, AMOSTRA e LIMITAÇÕES, proposto vs aplicado e o aviso de que mudança não é prova de causa. Loading, erro e retry são explícitos. Proibido: “Funcionou”, “Não funcionou”, sucesso, fracasso, efetividade, “Resultado da estratégia”.

## Phase 12 — Memória de resposta

Progresso ganha **Memória de resposta**: por exercício e alteração, intervenções registradas, comparáveis, com mudanças simultâneas ou dados limitados, contagem de variações do 1RM estimado (positivas/iguais/negativas) e aviso quando as observações apontam em direções diferentes, com truncamento declarado. O detalhe **Histórico observado** lista cada intervenção com data, revisão do programa, alteração ativada e direção, Antes/Depois/Variação numérica/Amostra e Limitações, marcando "Intervenção comparável" ou "Apenas contexto". O resultado observado de uma decisão oferece **Ver histórico relacionado**. Proibido: "Aprendeu que", "Funciona", "Ideal", "Ótimo", "Melhor estratégia", "O que funciona para você", classificações de responder.

## Phase 13 — Séries na revisão, no builder e na memória

A revisão da proposta mostra "Séries planejadas: X → Y", "Nova série" e "Série removida" com alvos factuais e aviso de que não representa volume muscular. O builder permite adicionar e remover séries individuais (nunca a última) ao revisar o rascunho. A resposta observada mostra séries planejadas (valor ativado) e, por sessão, séries planejadas e concluídas. A memória exibe "Quantidade de séries planejadas" com assinaturas "3 séries → 4 séries". Proibido: "volume ideal", "mais volume funcionou", "séries efetivas", séries por músculo.

## Phase 14 — Troca de exercício

Revisão: "Troca de exercício", Antes/Proposto, relações conhecidas ("X é variação de Y"), aviso "Essas relações contextualizam a troca e não significam equivalência de carga ou resultado", carga planejada anterior e carga após a troca. Builder: "Trocar exercício" mantém as séries e lembra que a carga não é convertida. Resposta observada: ANTES/DEPOIS com exercícios diferentes, exposições e fatos lado a lado, sem diferença numérica, com "Carga e 1RM estimado não são diretamente comparáveis entre exercícios diferentes". Memória: grupos "A → C". Proibido: melhor exercício, ranking, "funciona melhor", superioridade.

## Phase 15 — Modo do Personal e revisão reforçada

Seção "Modo do Personal" com Manual e Proativo; escolher Proativo abre o consentimento ("Após uma análise, o Personal poderá preparar propostas de ajuste automaticamente. Nenhuma alteração será aplicada ao seu treino sem sua revisão." + "Esse modo pode realizar uma chamada adicional ao serviço de IA.") e exige "Ativar modo proativo"; "Manter manual" é igualmente visível — sem dark patterns. Após a análise, um cartão informa o status proativo sem inventar proposta. Badges: "Solicitada por você" / "Preparada pelo Personal", "Revisão padrão" / "Revisão reforçada" na proposta, na revisão e no histórico. Revisão reforçada mostra "Esta proposta altera uma parte mais estrutural/intensa da prescrição. Revise os detalhes antes de criar a revisão." e o checkbox "Revisei as alterações propostas" desmarcado; revisão padrão mantém "Criar revisão em rascunho" em um passo.

## Correção pós-Implementation Phase 15 — Proposta por identidade da análise

Sem mudança visível no fluxo: analisar → ver resposta → "Ver proposta de ajuste". O app envia só o `analysisRequestId`. Se o programa mudou ou a análise não é reconhecida, a mensagem é "Seu programa ou a análise mudou. Faça uma nova análise para ver uma proposta."; se safety bloqueia, "Por segurança, nenhuma proposta de treino pode ser preparada para esta análise." O id vive só em memória da tela: após reiniciar o app, uma nova análise é necessária (sem persistência de conversa).

## Implementation Phase 16 — Rascunho automático visível

Seção "Criação automática de rascunho" (Desligada/Conservadora), separada do "Modo do Personal", sem pré-seleção, com confirmação ("Ativar criação conservadora" / "Manter desligada") e aviso "Só tem efeito quando o modo do Personal é Proativo." Cartão "Rascunho preparado" (com "Rascunho preparado automaticamente", "Uma revisão em rascunho foi preparada.", o que muda, classe de revisão, regra, revisão de origem ativa, nova revisão e CTA "Revisar rascunho" para o builder). Mensagens factuais para `existing_draft`, `stale`, `ineligible`, `blocked` e `failed`. Histórico e revisão mostram "Rascunho criado por você" ou "Rascunho preparado automaticamente pelo Personal". Proibido: "Proposta aprovada" para rascunho automático e qualquer controle de ativação automática. Builder e ativação não mudaram.

## Implementation Phase 17 — Revisão factual

Histórico de decisões: "Rascunho preparado automaticamente → Ativado sem alterações / Ativado após alterações / Aguardando revisão / Arquivado sem ativação". Detalhe: "Revisão do rascunho" com Antes / Preparado / Ativado (ou Revisado) e "Alterado durante a revisão", nota de que a comparação não identifica quem editou e de que a revisão não diz se a proposta estava certa. Progresso: "Revisões do Personal" apenas com contagens. Cartão de auto-draft mantém "Revisar rascunho". Proibido: aceitação, sucesso, acurácia, confiança, score, porcentagens, gamificação e polegares.

## Implementation Phase 18 — Revisão mais precisa

A revisão do rascunho ganha a categoria "Ordem" (reordenação) e deixa de reportar troca de exercício falsa quando exercícios apenas mudam de posição. Nenhum UUID de linhagem é exibido.

## Correção pós-Implementation Phase 18 — Navegação mínima entre dias

"Dia em edição": lista horizontal compacta com todos os dias ("Bloco · Semana · Dia (n)") e "+ Dia nesta semana". Campos de nome passam a editar o bloco/semana/dia selecionado. Aviso "Alterações não salvas em todo o programa — trocar de dia não as descarta." Dia vazio mostra "Este dia ainda não tem exercícios." (sem pular para outro dia); salvar com dia vazio informa quais dias precisam de exercício. Exercício fora do catálogo aparece como "Exercício fora do catálogo (mantido)" e não é descartado. RIR e descanso ganham campos mínimo/máximo, sem colapsar faixas. Reordenação por ↑/↓. Sem redesign da aba Treino.

## Implementation Phase 19 — Navegação Bloco → Semana → Dia e guarda de saída

Regra anterior (correção pós-Implementation Phase 18): "Dia em edição" era uma lista horizontal única com todos os dias ("Bloco · Semana · Dia (n)").

Regra nova (ADR-0097): há três seletores compactos em sequência, "Bloco", "Semana" e "Dia em edição", este último com os dias da semana selecionada e o número de exercícios. Cada nível tem:

- chips horizontais e "+ Bloco", "+ Semana neste bloco" ou "+ Dia nesta semana";
- ↑/↓ (alvos de 44 pt, desativados nas pontas);
- "Remover bloco", "Remover semana" ou "Remover dia".

No último nó, o botão de remover é substituído pela explicação da invariante, por exemplo "Único dia desta semana: uma semana precisa de ao menos um dia." Os campos "Nome do bloco", "Nome da semana" e "Nome do dia" editam a seleção.

Remoção (ADR-0098): `Alert` com o título `Remover dia "Treino A"?` e uma mensagem factual, por exemplo "Contém 2 exercícios e 5 séries. A remoção vale para o rascunho quando você salvar; sair sem salvar mantém a versão salva." Botões "Cancelar" e "Remover …"; não há checkbox nem opção pré-selecionada.

Saída com alterações não salvas (ADR-0099): voltar, gesto ou botão físico abrem "Sair sem salvar?" com "Continuar editando" e "Descartar alterações". Não há "Salvar e sair". Rascunho limpo sai sem pergunta.

## Correção pós-Implementation Phase 19 — Salvar programa novo

"Salvar e revisar" em um programa novo faz uma única criação atômica.

- **Falha:** mostra o erro, não navega, mantém a estrutura local e o aviso de saída com alterações não salvas. Tocar de novo repete a mesma intenção, com o mesmo identificador.
- **Conflito** (a mesma intenção já criou um programa com outro conteúdo): "Este programa já foi criado em uma tentativa anterior com outro conteúdo. Nada foi alterado." e o botão "Abrir o programa já criado".
- **Sucesso:** o estado sujo é limpo e a tela navega para o programa, como antes.

## Implementation Phase 21 — "Seu programa"

A tela é oferecida uma vez após o onboarding e fica sempre acessível em Treino ("Pedir um programa ao Personal"). Perguntas curtas com "Sim/Não"; equipamentos são opcionais ("Não informar"/"Informar"). Durante a geração aparece "O Personal está montando seu programa…". Em caso de falha: "Tentar de novo com o Personal" e, quando cabível, "Usar modelo básico do sistema", com aviso de que não é personalizado. O detalhe do programa passa a mostrar descrição, dia da semana, foco e justificativa do dia, e "Por que este exercício".

## Identidade visual — dark minimal neon (ADR-0120)

O app é somente escuro. Tokens: fundo `#050B14`, superfícies `#0B1626`/`#0C1829`, borda `#17314D`, brilho `#0DA8FF`, primária `#16C8FF`, gradiente `#1EDCFF` → `#1D5CFF`, sucesso `#19E27A` e perigo `#FF4D67`, com tipografia Inter (500/600/700). A aba Treino mostra o card do treino do dia (duração estimada, séries, exercícios), o plano da semana (feito, planejado, descanso) e uma lista enxuta de exercícios. Nenhum valor é inventado: só dados calculados ou registrados.
