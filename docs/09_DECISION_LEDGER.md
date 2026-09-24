# Decision Ledger arquitetural

Status: **canônico**

Este ledger preserva decisões sobre produto e arquitetura. O Decision Ledger do Coach, descrito no modelo de dados, é um conceito de produto separado, embora adote os mesmos valores de auditabilidade.

## Protocolo de mudança

Uma entrada contém ID, data, status, contexto, regra anterior, decisão, motivo, evidências, impacto, período de avaliação quando aplicável e conclusão. Status arquiteturais: `proposed`, `accepted`, `rejected`, `superseded`, `reverted`.

Para alterar uma decisão aceita:

1. criar nova entrada referenciando a anterior;
2. copiar/resumir a regra anterior sem apagá-la;
3. registrar nova regra, motivo e evidência;
4. listar documentos, código, dados e migrations afetados;
5. definir migração/compatibilidade e validação;
6. após aprovação, marcar a anterior como `superseded` e atualizar documentos.

Mudanças editoriais que não alteram significado não precisam de entrada. Dúvida sobre impacto favorece o registro.

## Decisões

### ADR-0001 — Constituição e documentação cumulativa

- Data: 2026-09-24
- Status: accepted
- Contexto: o projeto começa sem base anterior e precisa preservar decisões entre sessões.
- Regra anterior: inexistente.
- Decisão: `docs/00` a `docs/10` são canônicos; mudanças semânticas seguem este ledger.
- Motivo/evidência: requisito explícito da fundação.
- Impacto: todo o repositório.

### ADR-0002 — IA interpreta; sistema calcula

- Data: 2026-09-24
- Status: accepted
- Contexto: LLMs não oferecem reprodutibilidade suficiente para métricas objetivas.
- Regra anterior: inexistente.
- Decisão: cálculos objetivos são determinísticos, versionados e testados; IA apenas os interpreta/contextualiza.
- Motivo/evidência: auditabilidade, custo, confiabilidade e requisito central.
- Impacto: domain, application, AI, dados e UI.

### ADR-0003 — Separação de classes de informação

- Data: 2026-09-24
- Status: accepted
- Contexto: fatos, cálculos e interpretações têm proveniência e certeza diferentes.
- Regra anterior: inexistente.
- Decisão: Raw Data, Derived Data e Coach Intelligence permanecem conceitual e tecnicamente separados.
- Motivo/evidência: integridade histórica e confiança calibrada.
- Impacto: schema, APIs, dossier, analytics e apresentação.

### ADR-0004 — Arquitetura em camadas e domínio independente

- Data: 2026-09-24
- Status: accepted
- Contexto: UI, persistência e providers evoluem em ritmos diferentes.
- Regra anterior: inexistente.
- Decisão: presentation -> application -> domain; infraestrutura implementa portas e não é importada pelo domínio.
- Motivo/evidência: testabilidade e substituição de tecnologia.
- Impacto: layout do monorepo e imports futuros.

### ADR-0005 — Backend obrigatório para IA e provider substituível

- Data: 2026-09-24
- Status: accepted
- Contexto: a chave Gemini não pode estar no mobile e o produto não deve depender de um provider.
- Regra anterior: inexistente.
- Decisão: chamadas passam por backend seguro, gateway e adapter interno; Gemini é somente o provider inicial planejado.
- Motivo/evidência: segurança, governança e portabilidade.
- Impacto: Edge Functions, AI package, observabilidade e secrets.

### ADR-0006 — Stack planejada sem instalação prematura

- Data: 2026-09-24
- Status: accepted
- Contexto: a stack foi indicada, mas a Phase 0 não implementa aplicação.
- Regra anterior: inexistente.
- Decisão: planejar React Native, Expo, TypeScript, Expo Router, Zustand, TanStack Query, Zod e Supabase; instalar somente quando uma fase os usar.
- Motivo/evidência: reduzir superfície e evitar scaffold descartável.
- Impacto: roadmap e Phase 1/2.

### ADR-0007 — Monorepo conceitual, ferramenta pendente

- Data: 2026-09-24
- Status: accepted
- Contexto: mobile, domínio, adapters e backend precisam de boundaries explícitos.
- Regra anterior: inexistente.
- Decisão: usar estrutura `apps/`, `packages/`, `supabase/`, `tests/`; escolher package manager/workspace na Phase 1.
- Motivo/evidência: modularidade sem assumir ferramenta não solicitada.
- Impacto: estrutura do repositório.

### ADR-0008 — Safety em múltiplos gates

- Data: 2026-09-24
- Status: accepted
- Contexto: um único filtro pós-LLM não protege contexto, tools nem ações.
- Regra anterior: inexistente.
- Decisão: aplicar controles antes do contexto/modelo, em ferramentas/ações e após a saída; regras críticas são determinísticas.
- Motivo/evidência: domínio sensível de saúde e requisito de Safety Gate.
- Impacto: AI, application, UI, testes e observabilidade.

## Hipóteses registradas (não decisões de produto)

- `athlete-coach` é apenas nome técnico do diretório.
- inglês em nomes de domínio/código e português na documentação inicial; convenção definitiva pode mudar.
- monorepo é adequado à separação proposta; ferramenta continua aberta.
- o primeiro usuário é individual, mas isolamento por usuário será obrigatório.
