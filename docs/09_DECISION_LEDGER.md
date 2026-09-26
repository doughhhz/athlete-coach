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

### ADR-0014 — Modelo físico do perfil e histórico mutável do atleta

- Data: 2026-09-25
- Status: accepted
- Contexto: a Phase 3 introduz os primeiros dados pessoais reais e precisa separar atributos estáveis de observações/objetivos mutáveis.
- Regra anterior: `public.athletes` continha apenas identidade; perfil, objetivo, disponibilidade e Body eram conceituais.
- Decisão: `athlete_profiles` guarda nascimento/altura/nome/timezone 1:1; `athlete_training_contexts` guarda contexto atual; disponibilidade usa linhas por weekday ISO explícito; peso é Raw Data append-only em `body_weight_entries`; objetivos possuem vigência e no máximo um ativo por índice parcial. Sexo/gênero não é coletado sem finalidade concreta.
- Motivo/evidência: minimização, integridade histórica e necessidades explícitas do futuro Training Engine. Idade é derivada e peso mais recente é consultado, evitando duplicação destrutiva.
- Compatibilidade/validação: constraints técnicas detectam erro de entrada sem avaliação clínica; FKs/cascades, cardinalidade, histórico e RLS são cobertos por pgTAP.
- Impacto: migration Phase 3, domain, application, data-access, UI, privacidade e modelo de dados.

### ADR-0015 — Auth estrutural e conclusão atômica do onboarding

- Data: 2026-09-25
- Status: accepted
- Contexto: sessão, criação de identidade e múltiplos registros do onboarding não podem produzir acesso incorreto nem estado parcial.
- Regra anterior: o cliente Supabase existia sem telas Auth, repositories ou lifecycle de onboarding.
- Decisão: usar exclusivamente Supabase Auth por e-mail/senha e um cliente mobile; representar `BOOTING`, `CONFIGURATION_ERROR`, `SIGNED_OUT`, `SIGNED_IN_ONBOARDING_REQUIRED` e `SIGNED_IN_READY`; proteger grupos com a API disponível no Expo Router 57; criar atleta explicitamente por RPC idempotente; concluir onboarding em RPC `SECURITY INVOKER`, transacional, serializada por atleta e marcar `onboarding_completed_at` somente ao final.
- Motivo/evidência: sessão restaurável, navegação previsível, concorrência segura e ausência de persistência parcial. RLS permanece a autorização real.
- Compatibilidade/validação: testes de rotas e casos de uso, pgTAP positivo/negativo, rollback de payload inválido e retry sem duplicação.
- Impacto: root layout, Auth/onboarding/Profile, application, data-access, migration e testes.

### ADR-0016 — Validação compartilhada e repositories específicos na Phase 3

- Data: 2026-09-25
- Status: accepted
- Contexto: o primeiro I/O real exige contratos reutilizáveis e mapeamento seguro sem levar Supabase à apresentação.
- Regra anterior: Zod estava planejado e Data Access continha somente factory/tipos; repositories aguardavam casos de uso reais.
- Decisão: adotar Zod 4.6.5 para credenciais, perfil, objetivo, contexto, disponibilidade, peso, onboarding e validação de respostas externas; ativar `domain` e `application` como workspaces; implementar portas/casos de uso e repositories específicos, sem `BaseRepository<T>`, ORM, Zustand ou TanStack Query.
- Motivo/evidência: validação igual entre formulário/aplicação, defesa em runtime na boundary e responsabilidades rastreáveis. Estado React local basta para o draft e contexto de sessão desta fase.
- Compatibilidade/validação: unitários de schemas/domínio/aplicação, contrato de mapper e teste arquitetural de dependências.
- Impacto: manifests/lockfile, packages `domain`, `application`, `data-access`, composição mobile e documentação.

### ADR-0017 — Identidade canônica de exercício

- Data: 2026-09-25
- Status: accepted
- Contexto: catálogos externos podem mudar IDs, disponibilidade e termos.
- Regra anterior: `Exercise` era conceitual; fonte e identidade estavam abertas.
- Decisão: exercícios, anatomia e equipamentos usam UUID e slug internos estáveis. Mapeamentos externos são metadados opcionais N:1 e nunca identidade de domínio. O catálogo interno é a fonte canônica.
- Motivo/evidência: integridade referencial, independência de provider e evolução reproduzível.
- Impacto: migration/seed Phase 4, domain, application, data-access e futuras prescrições.

### ADR-0018 — Taxonomia anatômica

- Data: 2026-09-25
- Status: accepted
- Contexto: busca, filtros e descrição muscular exigem granularidade coerente sem pseudo-precisão.
- Regra anterior: `Muscle` era um conceito sem hierarquia física.
- Decisão: adotar `body_regions -> muscle_groups -> muscles`; subdividir porções somente onde agregam valor anatômico. A relação exercício-músculo usa `primary`, `secondary` e `stabilizer`, sem percentuais ou scores.
- Motivo/evidência: filtros factuais e nomenclatura anatômica auditável sem simular medição de ativação.
- Impacto: schema, seed, modelos de domínio e UI da biblioteca.

### ADR-0019 — Exercise separado de Prescription

- Data: 2026-09-25
- Status: accepted
- Contexto: o movimento é conhecimento global; sua execução em um programa depende do atleta e do contexto.
- Regra anterior: o Training Engine já separava prescrição de execução, mas a fronteira com o catálogo não estava física.
- Decisão: `Exercise` descreve o movimento. `Prescription` descreverá como o atleta deve executá-lo naquele contexto. Sets, reps, carga, RIR, descanso, tempo, progressão e ranges não entram no catálogo.
- Motivo/evidência: impedir recomendação implícita, preservar reuso e manter Phase 5 fora de escopo.
- Impacto: domain Exercise, schema Phase 4, UI e futuro Training Program Engine.

### ADR-0020 — Proveniência de mídia de exercício

- Data: 2026-09-25
- Status: accepted
- Contexto: mídia futura pode ser própria, licenciada ou transmitida por provider, com direitos e cache distintos.
- Regra anterior: `ExerciseMedia` era conceitual e fonte/licença permaneciam abertas.
- Decisão: modelar `exercise_media` com tipo, `source_type`, localização coerente, provider/asset externo quando aplicável, licença, atribuição e políticas de uso/cache. Nenhum ativo, URL externa ou bucket é criado na Phase 4.
- Motivo/evidência: impedir mídia sem proveniência e evitar infraestrutura vazia antes de uma fonte licenciada.
- Impacto: migration e testes Phase 4; futuros storage/provider adapters.

### ADR-0021 — Agregado físico de programa de treinamento

- Data: 2026-09-25
- Status: accepted
- Contexto: a Phase 5 precisa representar planejamento explícito e ordenado sem antecipar execução.
- Regra anterior: `TrainingProgram`, blocos, semanas, dias e prescrições eram somente conceituais.
- Decisão: adotar `TrainingProgram -> TrainingBlock -> TrainingWeek -> TrainingDay -> ExercisePrescription -> PrescriptionSet`, com UUIDs, sequências positivas únicas por pai e exercícios referenciados pelo catálogo canônico.
- Motivo/evidência: alvos por série permitem prescrições heterogêneas sem duplicar identidade/anatomia do exercício.
- Impacto: domain, application, data-access, migration, RLS, mobile e testes.

### ADR-0022 — Lifecycle, ativação imutável e revisão

- Data: 2026-09-25
- Status: superseded por ADR-0025
- Contexto: programas utilizados não podem ser reescritos silenciosamente e a troca de ativo precisa ser atômica.
- Regra anterior: mudanças seriam versionadas, sem lifecycle físico definido.
- Decisão: usar `draft`, `active`, `completed`, `archived`; somente draft é estruturalmente mutável. Um índice limita um ativo por atleta. Ativação conclui o ativo anterior na mesma transação. Revisão clona todo o agregado com novos UUIDs e `supersedes_program_id` único.
- Motivo/evidência: preserva a intenção histórica e cria uma boundary simples para sessões futuras.
- Compatibilidade/validação: triggers protegem filhos, RPCs serializam operações e pgTAP cobre ativação, imutabilidade e clone.
- Impacto: schema, repositories, builder, detalhes e futura Phase 6.

### ADR-0023 — Alvo tipado por série

- Data: 2026-09-25
- Status: accepted
- Contexto: nem todo movimento é prescrito por reps e séries do mesmo exercício podem divergir.
- Regra anterior: a prescrição conceitual admitia séries/faixas sem representação fechada.
- Decisão: cada `PrescriptionSet` possui métrica `reps`, `seconds` ou `meters`, faixa positiva, RIR opcional 0–10, descanso opcional em segundos, tempo opcional de quatro fases e carga `unprescribed`, `athlete_selected` ou absoluta em kg. Não há %1RM nem progressão.
- Motivo/evidência: representação compacta, unitária e validável no domínio, aplicação e banco.
- Impacto: domínio Training, UI de builder/detalhes e constraints SQL.

### ADR-0024 — Prescription versus Performance

- Data: 2026-09-25
- Status: accepted
- Contexto: alvos planejados não são observações de uma sessão executada.
- Regra anterior: prescrição e execução já eram entidades conceitualmente distintas.
- Decisão: tornar explícito que **Prescription representa intenção planejada; Performance representa execução observada**. A Phase 5 não persiste reps, carga, RIR, descanso ou duração realizados.
- Motivo/evidência: evita transformar plano em fato e preserva a separação entre planejamento e Raw Data futuro.
- Impacto: modelo, linguagem da UI, schema e escopo das Phases 5 e 6.

### ADR-0025 — Substituição aposenta sem concluir

- Data: 2026-09-26
- Status: accepted
- Contexto: ADR-0022 definiu simultaneamente `completed` como encerramento normal e a ativação de uma revisão como conclusão automática do ativo anterior. Uma substituição antecipada não prova que o ciclo planejado terminou e produziria histórico falso para análises longitudinais e Coach Intelligence.
- Regra anterior: ativação concluía o ativo anterior na mesma transação, preenchendo `completed_at`.
- Decisão: manter `draft`, `active`, `completed`, `archived`. Conclusão registra o término normal do lifecycle e somente `CompleteTrainingProgram` faz `active -> completed`. Ativar qualquer novo draft arquiva o ativo anterior na mesma transação, preenche `archived_at` e não preenche `completed_at`. Revisões preservam `new.supersedes_program_id = old.id`; o programa anterior e toda sua estrutura permanecem imutáveis.
- Motivo/evidência: replacement e completion são eventos semanticamente distintos; separar os timestamps impede falsos positivos históricos sem introduzir um quinto status.
- Compatibilidade/migração: uma migration substitui somente o RPC de ativação. Não há remapeamento automático de linhas históricas porque não existe evidência determinística para distinguir conclusões explícitas de substituições anteriores.
- Validação: pgTAP cobre conclusão explícita, substituição independente, substituição de revisão, lineage, imutabilidade, unicidade do ativo e rollback de ativação falha; integração local verifica a semântica de replacement.
- Impacto: `activate_training_program`, testes de banco/integração, apresentação mobile, Training Engine, Data Model, Architecture e UI/UX.

### ADR-0026 — Aggregate de Workout Session e snapshot planejado

- Data: 2026-09-26
- Status: accepted
- Contexto: execução não pode ser confundida com planejamento nem depender de joins futuros.
- Decisão: usar `WorkoutSession -> WorkoutExercise -> WorkoutSet`, com source IDs e snapshot estruturado dos targets. Performance observada ocupa campos separados. **Performance records reality; divergence from prescription is valid data.**
- Impacto: migration Phase 6, domain, application, data-access, UI e testes.

### ADR-0027 — Lifecycle e imutabilidade histórica do workout

- Data: 2026-09-26
- Status: accepted
- Decisão: sessão nasce `in_progress`, termina `completed` ou `abandoned`; uma ativa por atleta. Completion exige sets resolvidos. Abandon preserva performance e pending. Correções são permitidas somente enquanto ativa; clientes não alteram nem apagam histórico terminal.
- Impacto: RPCs, triggers, RLS, casos de uso e UX.

### ADR-0028 — Retomada online e relógios por timestamp

- Data: 2026-09-26
- Status: accepted
- Decisão: servidor é authoritative; retomada reconstrói o aggregate. Falha de save preserva inputs na tela e permite retry. Não há sync engine/cache concorrente. Duração e descanso usam timestamps, nunca contagem persistida de intervalos JS.
- Motivo: resiliência honesta sem last-write-wins silencioso ou complexidade offline prematura.
- Impacto: Runner, repository e documentação. Offline completo permanece futuro.

### ADR-0029 — Extras e substituições postergados

- Data: 2026-09-26
- Status: accepted
- Decisão: a Phase 6 não expõe extra sets nem substituição manual/automática. O schema não usa ordinal global rígido, mas toda série atual referencia sua origem prescrita; um modelo futuro deverá distinguir explicitamente extras e contexto de substituição.
- Motivo: não inventar targets retrospectivos nem contaminar o core de Raw Data.
- Impacto: escopo do Runner e fases futuras.

### ADR-0030 — Raw Performance versus Derived Performance

- Data: 2026-09-26
- Status: accepted
- Decisão: Derived Data é uma projection read-only e reproduzível de Workout Raw Data. Calculadores nunca alteram sets, sessões, snapshots ou programas. **Derived Data must be reproducible from Raw Data. Missing measurement is not failure.**
- Impacto: domain Performance, read repository, aplicação, UI e testes.

### ADR-0031 — Epley v1 e performance estimada

- Data: 2026-09-26
- Status: accepted
- Decisão: `epley-v1` aceita sets completed em reps, carga registrada positiva e 1–12 reps. Uma rep retorna a própria carga; 2–12 usam `load × (1 + reps/30)`. RIR não ajusta a fórmula e arredondamento pertence à apresentação. **Estimated performance is not measured performance.**
- Limites: comparação somente no mesmo exercício; implementos não são universalmente equivalentes.
- Impacto: calculators, UI, fixtures e futura evolução versionada.

### ADR-0032 — Semântica conservadora de personal record

- Data: 2026-09-26
- Status: accepted
- Decisão: max logged load e e1RM PR são específicos do exercício. A primeira observação é baseline; somente valor estritamente maior que o best anterior é evento. Tie/lower não são recorde. Sets completed em sessões abandoned continuam elegíveis; skipped/pending não.
- Impacto: ordenação cronológica, projections e UI.

### ADR-0033 — Derived metrics sem armazenamento persistente

- Data: 2026-09-26
- Status: accepted
- Decisão: usar queries RLS, modelos validados e calculadores puros; não criar `performance_metrics`, caches ou materializações. Mudanças futuras de fórmula produzem recomputação versionada sobre Raw Data intacto.
- Motivo: eliminar staleness e rebuild migrations prematuras.
- Impacto: banco permanece sem novas entidades de métricas; Data Access é read-only.

## Hipóteses registradas (não decisões de produto)

- `athlete-coach` é apenas nome técnico do diretório.
- inglês em nomes de domínio/código e português na documentação inicial; convenção definitiva pode mudar.
- monorepo é adequado à separação proposta; npm workspaces resolveu a ferramenta conforme ADR-0009.
- o primeiro usuário é individual, mas isolamento por usuário será obrigatório.

### ADR-0034 — Athlete Training Dossier Contract

- **Anterior:** Phase 8 iniciaria AI Coach e o dossiê estava em fase posterior.
- **Nova:** `athlete-training-dossier-v1` precede IA e organiza contexto, histórico, sinais, cobertura e evidência.
- **Motivo:** contrato auditável sem acesso irrestrito do futuro Coach ao banco.
- **Status:** accepted; sequência anterior superseded.

### ADR-0035 — Civil longitudinal windows

Janelas usam data civil IANA, início inclusivo/fim exclusivo, últimos 7/28 dias incluindo hoje e períodos anteriores adjacentes. Delta relativo é null sem denominador válido.

### ADR-0036 — Bounded evidence

Dossiê on-demand limita detalhes a 12 sessões e expõe truncamento. Evidências são tipadas e exposições trazem até três sessões ordenadas. Sem cache ou graph database.

### ADR-0037 — Signals are not conclusions

“The dossier organizes evidence; it does not interpret it.” “A longitudinal signal is a factual comparison, not a coaching conclusion.” O contrato proíbe recommendation, interpretation, score, fatigue/readiness e sugestões.
