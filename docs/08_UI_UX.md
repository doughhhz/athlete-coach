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

Áreas prováveis: Hoje, Treino, Progresso, Coach e Perfil. Isto é hipótese de arquitetura de informação, não definição de tabs nem UI final. A validação ocorrerá na Phase 1.

## Conteúdo e tom

Linguagem breve, específica e não julgadora. Evitar culpa por baixa aderência, jargão desnecessário e antropomorfização que sugira consciência ou autoridade clínica. Datas, unidades e comparações precisam de contexto.

## Acessibilidade e localização

Acessibilidade é critério de aceite, não melhoria posterior. Strings devem ser localizáveis desde a implementação; idioma inicial ainda é questão aberta. Não codificar texto de negócio disperso em componentes.

## Validação futura

Testar registro de série sob tempo, retomada após interrupção, uso offline, correção de erro, compreensão de recomendações, legibilidade, VoiceOver e Dynamic Type. Não produzir UI final antes de protótipos e critérios de fluxo.
