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

## Governança

Qualquer nova capacidade de IA ou health data requer threat modeling, revisão de safety, testes adversariais, avaliação de privacidade e plano de observabilidade. Incidentes devem gerar registro, contenção, análise e alteração versionada; jamais apagar o histórico para esconder o problema.

## Disclaimer

Um aviso de responsabilidade é necessário, mas não substitui design seguro, limites técnicos ou escalonamento adequado.
