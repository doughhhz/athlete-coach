# Constituição do projeto

Status: **canônico**
Versão: 1.0
Última revisão: 2026-09-24

## Missão

Construir uma plataforma pessoal mobile que ajude um atleta a planejar, executar e compreender treino, recuperação, corpo e nutrição ao longo do tempo, com apoio explicável de um Personal Trainer baseado em IA.

## Princípios permanentes

### 1. IA interpreta. O sistema calcula.

Este princípio é inegociável. Volume, tonelagem, séries, frequência, aderência, tendências, médias, PRs, e1RM, RIR médio, queda de performance, descanso, progressões e estatísticas nutricionais devem ser calculados deterministicamente quando isso for possível. A IA recebe resultados calculados e pode contextualizar, explicar, levantar hipóteses e recomendar ações.

Toda fórmula deve ser versionada, ter unidade explícita, política de arredondamento e testes. Alterar uma fórmula pode mudar resultados históricos; por isso requer decisão registrada e, quando necessário, versionamento do cálculo.

### 2. Três classes de informação

- **Raw Data:** fatos fornecidos pelo atleta ou sensores. A IA não os reescreve.
- **Derived Data:** resultados reproduzíveis gerados por algoritmos determinísticos.
- **Coach Intelligence:** interpretações, hipóteses, recomendações, decisões e explicações, sempre com proveniência.

Essas classes não compartilham a mesma semântica nem fingem ter o mesmo grau de certeza. Correções de Raw Data são ações explícitas do usuário ou importações reconciliadas, com trilha de auditoria.

### 3. Segurança antes de otimização

O sistema não diagnostica, não substitui profissionais de saúde e não apresenta hipótese como fato clínico. Sinais preocupantes interrompem recomendações potencialmente arriscadas e orientam procura por profissional ou serviço adequado. A experiência deve deixar claras limitações e incertezas.

### 4. Privacidade, controle e minimização

Dados de saúde e rotina são sensíveis. Coletar apenas o necessário; tornar consentimento, retenção, exportação e exclusão explícitos; limitar contexto enviado ao LLM; não registrar secrets nem dados sensíveis desnecessários em logs. A política jurídica detalhada será definida antes de uso real.

### 5. Explicabilidade e auditabilidade

Recomendações estratégicas devem informar evidências usadas, hipótese, decisão, horizonte de avaliação e resultado. O Decision Ledger preserva o histórico, inclusive decisões rejeitadas ou revertidas.

### 6. Dependências apontam para o domínio

O domínio não conhece UI, banco, framework, Supabase ou Gemini. Aplicação coordena casos de uso por portas. Infraestrutura implementa adapters. A apresentação transforma intenção do usuário em chamadas à aplicação.

### 7. IA e infraestrutura são substituíveis

Gemini é o provider inicial planejado, não a identidade do produto. Providers implementam um contrato interno. Prompts, schemas, modelos, custos e telemetria pertencem à infraestrutura do backend e podem evoluir sem contaminar o domínio.

### 8. Mobile durante treino é um contexto crítico

Registrar uma série deve exigir poucos toques, tolerar conectividade ruim e evitar distrações. Acessibilidade, legibilidade, feedback imediato e prevenção de perda de dados têm prioridade sobre densidade visual.

### 9. Evolução incremental e honesta

Não construir módulos completos antes de seus pré-requisitos. Placeholders devem ser identificados como tais. Nenhuma UI, integração ou resultado simulado pode sugerir capacidade inexistente.

### 10. Documentação cumulativa

Os documentos `docs/00` a `docs/10` são canônicos. Mudanças preservam a regra anterior, registram a nova, justificam a transição, listam impacto e atualizam o Decision Ledger. Nenhum prompt ou sessão futura substitui silenciosamente decisões aprovadas.

## Hierarquia de decisão

1. segurança e requisitos legais aplicáveis;
2. esta Constituição;
3. decisões aceitas no Decision Ledger;
4. demais documentos canônicos;
5. código e testes;
6. hipóteses e notas temporárias.

Conflitos devem ser explicitados e resolvidos documentalmente antes de implementação estrutural.

## Critérios mínimos de qualidade

- TypeScript estrito e contratos explícitos;
- validação nas fronteiras externas;
- testes para regras determinísticas e invariantes;
- migrations versionadas e políticas de acesso revisadas;
- telemetria sem exposição indevida de dados;
- acessibilidade e estados offline/erro considerados desde o desenho;
- relatório final a cada etapa e revisão humana antes de avançar de fase.

## Phase 15 — Iniciativa sem autoridade

- **The Coach may act proactively in preparing advice, but training state changes remain governed by deterministic policy and human authority.**
- **Initiative does not imply authority.**
- **Review class is an operational governance classification, not a medical or physiological risk score.**

A classe de revisão é calculada por política determinística e versionada no domínio; o LLM nunca define, reduz ou influencia essa classe. Nenhum modo permite materialização ou ativação automáticas (ADR-0074, ADR-0075).

## Correção pós-Implementation Phase 15 — Autoridade da análise

- **Client-returned Coach analysis is display data, never authoritative coaching state.**
- **Safety state used for proposal generation must originate from a server-owned analysis record.**

## Implementation Phase 16 — Autoridade limitada de rascunho

- **Automatic draft creation is limited authority over an inactive revision, never authority over the active training program.**
- **Standard review is necessary but not sufficient for automatic draft eligibility.**

Ativação de programa é sempre uma ação humana explícita. Ativação automática não é o "próximo toggle": exigiria uma decisão de autoridade independente e nova ADR.

## Implementation Phase 17 — Supervisão não é validação

- **Human review behavior is evidence about oversight, not proof that a proposal was correct.**
- **User acceptance does not validate a coaching intervention physiologically.**
- **Auto-draft authority may not expand itself from review history.**

## Implementation Phase 18 — Identidade de revisão

- **Revision identity is not sequence identity.**
- **Reordering an existing training element does not make it a new element.**
- **Lineage identifies structural continuity; it does not imply semantic equivalence of changed exercise content.**

## Correção pós-Implementation Phase 18 — Escopo de edição

- **A partial editing surface must never imply a full-aggregate replacement.**
- **Saving one visible training node must preserve every untouched node in the draft.**
