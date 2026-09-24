# Instruções para agentes

## Antes de trabalhar

Leia este arquivo, `docs/00_CONSTITUTION.md`, `docs/09_DECISION_LEDGER.md` e os documentos do domínio afetado. A pasta `docs/` é a fonte canônica de decisões do produto e da arquitetura.

## Regras inegociáveis

1. **IA interpreta. O sistema calcula.** Métricas objetivas pertencem a código determinístico, versionado e testado.
2. Raw Data, Derived Data e Coach Intelligence permanecem separados na modelagem, persistência e interface.
3. Raw Data é imutável para a IA. Correções humanas devem ser auditáveis; nunca disfarçar uma interpretação como fato.
4. Nenhum secret pode existir no cliente, no código versionado, em logs ou fixtures. A chave do provedor de LLM pertence ao backend seguro.
5. Componentes de UI não contêm regra de negócio. Casos de uso orquestram; o domínio calcula; adapters acessam serviços externos.
6. O provider de LLM é substituível. Código de domínio e aplicação não importa SDK do Gemini.
7. Safety Gate é uma fronteira obrigatória antes e depois de qualquer chamada de IA ligada à saúde.

## Preservação de decisões

Documentos são cumulativos e canônicos. Não apague ou reescreva silenciosamente uma regra aprovada. Para mudar uma decisão:

1. registre a regra anterior;
2. registre a regra nova;
3. explique motivo e evidências;
4. liste os documentos e módulos afetados;
5. adicione uma entrada ao `docs/09_DECISION_LEDGER.md`;
6. marque a decisão anterior como superseded, sem apagar o histórico.

Requisitos não fornecidos devem ser registrados como hipótese, não apresentados como fato.

## Boundaries e estilo

- TypeScript estrito; tipos explícitos nas fronteiras públicas.
- Validar I/O externo com Zod quando a dependência for introduzida.
- Preferir funções puras no domínio e nomes baseados na linguagem do produto.
- Organizar por domínio/capacidade, evitando pastas genéricas que concentrem responsabilidades.
- Dependências apontam para dentro: apresentação e infraestrutura podem depender de aplicação/domínio; domínio não depende delas.
- Estado remoto pertence a TanStack Query; Zustand fica restrito a estado local/transitório. Não duplicar a mesma fonte de verdade.
- Datas persistidas em UTC com timezone original quando semanticamente relevante; unidades sempre explícitas.
- Compartilhamento em `packages/shared` exige uso real por mais de um módulo; não criar abstrações preventivas.

## Testes

Toda lógica determinística precisa de testes unitários, incluindo limites, unidades e arredondamento. Adapters exigem testes de contrato; fluxos críticos, testes de integração; boundaries arquiteturais devem ser verificáveis. IA deve ser testada com schemas, fixtures e avaliações, nunca por comparação literal frágil de texto.

## Encerramento de cada etapa

Não avance automaticamente para outra fase. O relatório final deve informar: estado inicial, arquivos criados/modificados, árvore relevante, decisões, hipóteses, itens não implementados, riscos, inconsistências, validações, `git status`, commit (se houver) e próximo passo recomendado.
