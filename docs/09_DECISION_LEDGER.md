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

### ADR-0009 — npm workspaces e matriz Expo da Phase 1

- Data: 2026-09-24
- Status: accepted
- Contexto: ADR-0007 deixou a ferramenta de monorepo pendente para a Phase 1; o shell precisa ser reproduzível e compatível com Expo Go.
- Regra anterior: monorepo conceitual sem package manager ou ferramenta escolhidos; stack Expo planejada sem versão instalada.
- Decisão: usar npm workspaces com lockfile único na raiz. O shell adota o template oficial estável `default@sdk-57`, efetivamente resolvido como Expo 57.0.25, React 19.2.3, React Native 0.86.3, Expo Router 57.0.23 e TypeScript 6.0.3. SDK 58 beta/`next` não foi adotado.
- Motivo/evidência: npm já integra o ambiente Node e atende ao único workspace executável; `create-expo-app@latest` e a documentação oficial indicavam SDK 57 como `latest` em 2026-09-24.
- Compatibilidade/validação: Node mínimo 22.13; `expo install --check`, lint, typecheck, testes, Metro e bundle iOS devem passar. Upgrades exigem nova verificação da matriz oficial.
- Impacto: `package.json`, `package-lock.json`, `apps/mobile`, README, arquitetura e fluxo de desenvolvimento.

### ADR-0010 — Navegação e tema estruturais do shell mobile

- Data: 2026-09-24
- Status: accepted
- Contexto: a navegação da fundação era hipótese; a Phase 1 exige cinco destinos explícitos sem implementar capacidades futuras.
- Regra anterior: áreas prováveis Hoje, Treino, Progresso, Coach e Perfil, sem definição de tabs.
- Decisão: o shell usa tabs Hoje, Treino, Nutrição, Progresso e Personal. Telas são placeholders explícitos, com Safe Area, rótulos acessíveis e tokens centralizados para light/dark automático.
- Motivo/evidência: critério explícito da Phase 1 e necessidade de validar a estrutura de navegação no iPhone.
- Hipótese: nomes, cores e identidade visual permanecem provisórios até pesquisa e decisão posterior.
- Impacto: `apps/mobile/app`, `apps/mobile/src/presentation`, UI/UX e testes do shell.

### ADR-0011 — Supabase local, migrations e boundary de acesso a dados

- Data: 2026-09-24
- Status: accepted
- Contexto: a Phase 2 precisa tornar a persistência reproduzível sem criar um projeto remoto nem acoplar a UI ao banco.
- Regra anterior: Supabase estava apenas planejado; `packages/data-access` e `supabase/` eram placeholders.
- Decisão: adotar Supabase CLI 2.117.0 local e versionada, migrations SQL como fonte do schema, pgTAP para integração, tipos gerados pelo CLI e `@supabase/supabase-js` 2.117.1 encapsulado em `packages/data-access`. Presentation não importa SDK Supabase nem consulta tabelas diretamente. Não adotar ORM ou repository genérico.
- Motivo/evidência: reset local, 27 testes de banco e geração de tipos executados contra a stack real; o teste arquitetural impede o atalho `UI -> supabase.from`.
- Compatibilidade/validação: qualquer alteração segue migration -> reset -> testes de banco -> tipos -> typecheck/testes gerais. A CLI usa temporários confinados a `.cache/` para evitar a falha observada no temp global do Windows.
- Impacto: raiz do workspace, `supabase/`, `packages/data-access`, infraestrutura mobile, testes e documentação.

### ADR-0012 — Identidade mínima do atleta e autorização no banco

- Data: 2026-09-24
- Status: accepted
- Contexto: o produto precisa de uma identidade de domínio distinta da autenticação antes de modelar perfil ou outros agregados.
- Regra anterior: `Athlete` era somente agregado conceitual e as cardinalidades físicas estavam abertas.
- Decisão: `auth.users` permanece identidade técnica; `public.athletes` usa UUID próprio, `user_id` único com foreign key e `ON DELETE CASCADE`, timestamps e nenhuma informação de perfil. `anon` não recebe grants; `authenticated` recebe CRUD sujeito a quatro policies explícitas de ownership; `service_role` é reservado ao backend.
- Motivo/evidência: menor schema capaz de sustentar identidade, isolamento e evolução por domínio; testes positivos e negativos verificam grants, constraints e RLS.
- Impacto: migration inicial, testes pgTAP, tipos gerados, arquitetura e modelo de dados.

### ADR-0013 — Convenções físicas iniciais de dados

- Data: 2026-09-24
- Status: accepted
- Contexto: IDs, timestamps, unidades, precisão e deleção precisam de defaults antes da entrada de dados quantitativos.
- Regra anterior: IDs e schema físico seriam decididos na Phase 2; unidades/timezone eram parte do significado sem representação padrão.
- Decisão: usar UUID em entidades principais; `timestamptz` para instantes absolutos semanticamente UTC; unidade canônica explícita por campo/contrato; `numeric`, integer escalado ou tipo específico conforme precisão; nenhuma política global de soft delete. `athletes` usa deleção física e cascade consciente. Não criar schemas físicos `raw`, `derived` e `coach` antecipadamente.
- Motivo/evidência: evitar timestamps ambíguos, números sem unidade, floating point indiscriminado e abstrações prematuras.
- Impacto: migrations e modelos futuros, boundaries de entrada/apresentação e documentação canônica.

## Hipóteses registradas (não decisões de produto)

- `athlete-coach` é apenas nome técnico do diretório.
- inglês em nomes de domínio/código e português na documentação inicial; convenção definitiva pode mudar.
- monorepo é adequado à separação proposta; npm workspaces resolveu a ferramenta conforme ADR-0009.
- o primeiro usuário é individual, mas isolamento por usuário será obrigatório.
