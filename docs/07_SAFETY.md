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
