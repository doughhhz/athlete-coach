# Segurança e saúde

Status: **canônico**

## Limites de atuação

O sistema não deve:

- diagnosticar lesão ou doença;
- substituir médico, fisioterapeuta ou nutricionista clínico;
- incentivar a continuidade de exercício diante de sintomas preocupantes;
- inventar dados clínicos, medições ou certezas;
- transformar correlação em causalidade;
- tratar hipótese, estimativa ou saída de IA como fato observado;
- recomendar mudança arriscada sem considerar constraints conhecidas;
- ocultar que uma recomendação foi gerada por IA.

## Safety Gate em camadas

1. **Entrada:** identifica sinais e pedidos fora de escopo antes de montar contexto.
2. **Contexto:** impede uso indevido de dados, verifica constraints e frescor.
3. **Ferramentas/ações:** valida parâmetros e bloqueia mutações não autorizadas.
4. **Saída:** checa conteúdo, certeza indevida e compatibilidade com evidências.
5. **Interface:** apresenta alertas e próximos passos sem linguagem diagnóstica.

O LLM não é o único responsável por safety. Regras críticas precisam de implementação determinística, testes e versionamento.

## Categorias conceituais de resposta

- **Informação geral:** responder com limites e contexto.
- **Incerteza ou dado insuficiente:** declarar limite e solicitar apenas o necessário.
- **Sinal potencialmente preocupante:** interromper recomendação de treino afetada e orientar avaliação profissional apropriada.
- **Possível emergência:** orientar busca imediata de serviço de emergência local; não prolongar triagem conversacional.

Listas clínicas específicas, limiares e linguagem localizada não estão definidos e exigem revisão profissional antes de implementação.

## Princípios de comunicação

Ser direto, calmo e não alarmista; não afirmar diagnóstico; distinguir urgência de cautela; não prometer resultado; explicar por que uma recomendação foi limitada; facilitar acesso a ajuda adequada.

## Privacidade e segurança técnica

- consentimento por finalidade para uso de dados pela IA;
- minimização de contexto e retenção;
- isolamento por usuário e RLS;
- secrets exclusivamente no backend;
- criptografia em trânsito e controles do provedor;
- logs sem conteúdo sensível por padrão;
- exportação, correção e exclusão definidas antes de produção;
- resposta a incidentes e política de vulnerabilidades antes de lançamento.

Na fundação Supabase, a publishable key é deliberadamente pública e sua segurança depende de Auth, grants mínimos e RLS. Apenas `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` podem chegar ao bundle mobile. Secret key, `service_role`, JWT secret e credenciais administrativas pertencem exclusivamente ao backend/ambiente seguro e não aparecem em exemplos, logs ou código cliente.

Seeds e testes usam somente identidades artificiais. Dados futuros de saúde/fitness exigem minimização, least privilege e mensagens de erro sem informações pessoais desnecessárias. A stack local não deve ser exposta à internet para conectar um aparelho físico.

Na Phase 3, nome preferido, nascimento, altura, timezone, objetivo, rotina, experiência, disponibilidade, constraints, preferências e histórico de peso tornam-se dados pessoais persistidos. Sua finalidade é explícita no perfil e na futura personalização do Training Engine. RLS isola cada atleta; não há analytics, Gemini, outro provider de IA ou envio de texto livre a terceiros. Campos livres nunca entram em logs. Limites de peso/altura detectam provável erro de digitação e não classificam saúde, corpo ou risco clínico.

Não existe ainda uma alegação de conformidade jurídica completa. Antes de produção, o produto precisa definir retenção, exportação portátil, exclusão acessível, resposta a incidentes e revisão dos cascades. Consentimento/transparência específicos serão decididos antes de qualquer processamento por IA; não há checkbox jurídico vazio nesta fase.

## Governança

Qualquer nova capacidade de IA ou health data requer threat modeling, revisão de safety, testes adversariais, avaliação de privacidade e plano de observabilidade. Incidentes devem gerar registro, contenção, análise e alteração versionada; jamais apagar o histórico para esconder o problema.

## Disclaimer

Um aviso de responsabilidade é necessário, mas não substitui design seguro, limites técnicos ou escalonamento adequado.

## Safety do Personal — Phase 9

Safety é código fora do prompt e atua antes/depois do provider. O pre-check bloqueia aconselhamento diante de dor aguda, possível lesão, sintomas graves/emergência, diagnóstico/medicação e práticas extremas de peso. O Coach não diagnostica tecido, prescreve tratamento ou recomenda ignorar dor. O post-check degrada afirmações clínicas proibidas; missing data vira incerteza e evidence inexistente invalida a resposta. As regras lexicais são uma barreira inicial, não detecção clínica completa nem proteção absoluta contra injection.

## Phase 10 — Safety de proposals

Uma análise com `blocksTrainingAdvice` não pode iniciar proposal de treinamento. O modelo não converte dor aguda, possível lesão, medicação ou perda extrema de peso em redução de carga, troca de exercício ou retorno terapêutico. Mesmo uma proposta schema-valid é inerte até validação determinística e decisão humana. O sistema não classifica magnitude como ciência fisiológica sem regra canônica; não foram inventados thresholds pseudocientíficos.

## Phase 11 — Outcomes sem causalidade

Comparações antes/depois não são apresentadas como prova de que uma mudança “funcionou”. O contrato não contém score, sucesso/fracasso ou classificação qualitativa; peso corporal é contexto e não normaliza performance. Não há adaptação automática, RL, bandits ou experimentação com prescrições. A política de prompt proíbe afirmações causais, mas não existe filtro lexical determinístico de causalidade no output (limitação registrada na ADR-0054). Leituras de histórico de decisões usam o JWT do atleta e o domínio filtra novamente sessões, programas e pesos por `athleteId`.

## Phase 12 — Memória não supera safety

Histórico de performance nunca justifica continuar com dor ou sintomas; os gates da Phase 9/10 permanecem antes de qualquer uso da memória, e o prompt v3 reafirma isso. A memória é dado não confiável para fins de instrução (textos de programa/exercício não viram instruções). Leituras usam o JWT do atleta e o domínio refiltra por `athleteId`; mistura entre atletas é falha crítica e é testada. Não há ML, RL, pesos aprendidos ou adaptação automática.

## Phase 13 — Mudanças de séries

Adicionar ou remover séries é proposta revisada por humano, materializada apenas em draft e nunca ativada automaticamente. Safety da Phase 9/10 continua bloqueando propostas quando há sinais de dor, lesão ou sintomas; histórico de séries não supera essas regras. Não há inferência de volume ideal nem adaptação automática.

## Phase 14 — Troca não é tratamento

Dor aguda, possível lesão ou questões médicas continuam bloqueadas pelo safety gate antes de qualquer proposta; o prompt v5 proíbe usar `replace_exercise` como tratamento. Autenticação agora precede qualquer revelação de configuração do provider nas Edge Functions (ADR-0073).

## Phase 15 — Proatividade não contorna safety

Safety bloqueante impede a chamada de proposta proativa e resulta em status `blocked` sem persistência. A classe de revisão é governança operacional, não risco médico ou fisiológico, e nunca é exibida como "baixo/alto risco". Revisão reforçada exige confirmação humana verificada no servidor; o cliente não pode rebaixar a classe nem escolher origem. Nenhuma materialização ou ativação automática.

## Correção pós-Implementation Phase 15 — Safety com proveniência no servidor

O cliente não consegue remover `safetyFlags` ou `blocksTrainingAdvice`: `coach-propose` rejeita (400) qualquer campo além de `analysisRequestId` e carrega o estado de safety do registro imutável. Análise bloqueada → `422 proposal_blocked` sem chamada ao provider e sem decisão; o banco também recusa criar decisão a partir de registro bloqueado. IDs desconhecidos ou de outro atleta → mesmo `404 analysis_not_found`.

## Implementation Phase 16 — Safety acima do auto-draft

Análise com `trainingAdviceBlocked` → auto-draft `blocked`, sem rascunho nem materialização, verificado na aplicação e no banco. Não existe atalho como "reduzir carga por dor". Ativação permanece exclusivamente humana; nenhuma rota do Coach altera o programa ativo.

## Implementation Phase 17 — Revisão não amplia autoridade

O histórico de revisão nunca alimenta `coach-auto-draft-v1`, governança, ativação ou qualquer política (teste de arquitetura). Ativações repetidas sem alteração não liberam auto-draft mais amplo nem ativação automática. Nenhum reward, preferência aprendida, bandit ou ajuste de elegibilidade.

## Implementation Phase 18 — Sem ampliação de autoridade

Linhagem é infraestrutura de identidade. `coach-auto-draft-v1` permanece exatamente RIR ↑, descanso ↑ e redução de carga absoluta existente; ativação continua humana; nenhum reward ou score. Cliente não pode forjar linhagem de outro atleta, programa ou nível.
