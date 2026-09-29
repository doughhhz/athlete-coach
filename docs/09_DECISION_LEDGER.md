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

### ADR-0038 — AI Gateway e provider boundary

- Data: 2026-09-26
- Status: accepted
- Decisão: somente `coach-analyze` autenticado chama `CoachModelProvider`; Gemini é adapter HTTP server-side configurável. Mobile, application e domain não importam provider.
- Motivo: proteger secrets, permitir substituição e normalizar falhas.
- Impacto: packages/ai, application Coach, Edge Function, mobile e arquitetura.

### ADR-0039 — Dossier e proveniência histórica

- Data: 2026-09-26
- Status: accepted
- Decisão: dossier é contexto factual primário. Sessões resolvem programa/revisão/lineage pela hierarquia imutável a partir do training day; Raw Workout não ganha campo redundante.
- Motivo: impedir joins arbitrários pelo modelo.
- Impacto: dossier, query de Workout e grounding.

### ADR-0040 — Structured Coach Analysis e grounding

- Data: 2026-09-26
- Status: accepted
- Decisão: JSON v1 validado separa observação, hipótese, recomendação, incerteza e safety. Referência ausente invalida output; confidence é qualitativa; chain-of-thought não é persistido.
- Motivo: fatos não podem ser redefinidos nem citações falsas exibidas.
- Impacto: domain, application, providers, testes e Personal.

### ADR-0041 — Safety e controle humano

- Data: 2026-09-26
- Status: accepted; a parte "nenhuma autonomia" foi parcialmente superseded pela ADR-0075 (preparação proativa de propostas, opt-in; nenhuma mutação de estado de treino sem ação humana). Safety determinístico e ausência de mutation/tool call permanecem.
- Decisão: safety determinístico antes/depois do modelo; recomendações são propostas textuais com revisão humana. Nenhuma mutation, tool call ou autonomia.
- Motivo: risco de saúde e controle do atleta.
- Impacto: policy, prompt, gateway, UX e roadmap.

### ADR-0042 — Conversa efêmera bounded

- Data: 2026-09-26
- Status: accepted
- Decisão: até seis mensagens anteriores em memória; sem `coach_threads/messages`.
- Motivo: primeira análise útil não exige retenção; persistência ampliaria privacy, deletion e RLS prematuramente.
- Impacto: mobile, request contract e data model.

### ADR-0043 — Structured Coach Proposal Contract

- Data: 2026-09-27
- Status: accepted; vocabulário superseded pela ADR-0062 (coach-proposal-v2); v1 permanece válido para snapshots históricos
- Decisão: `coach-proposal-v1` é separado de `CoachAnalysis` e aceita somente ajustes de target, RIR, descanso e carga absoluta. Não há JSON Patch, add/remove set ou replace exercise nesta fase.
- Motivo: vocabulário pequeno permite validação completa e impede escolha de tabela/coluna pelo modelo.
- Impacto: domain, application, AI provider, Edge e Personal.

### ADR-0044 — Validator determinístico autoritativo

- Data: 2026-09-27
- Status: accepted
- Decisão: schema, ownership, programa/revisão ativa, evidence, IDs e invariantes de `PrescriptionSet` são revalidados fora do LLM antes de persistir e novamente antes de materializar.
- Motivo: output do modelo é untrusted e não redefine fatos ou safety.
- Impacto: domínio, testes e transaction boundary.

### ADR-0045 — Decisão humana e materialização somente em draft

- Data: 2026-09-27
- Status: accepted
- Decisão: aprovação explícita materializa clone draft e nunca ativa programa. `approved_at` e `materialized_at` são atômicos; não existe estado aprovado sem draft.
- Motivo: preservar o lifecycle da Phase 5 e o controle humano.
- Impacto: RPC, UI de revisão e Program Builder.

### ADR-0046 — Runtime Coaching Decision Ledger

- Data: 2026-09-27
- Status: accepted
- Decisão: `coach_decisions` guarda snapshot versionado, provenance e lifecycle `proposed → rejected | stale | materialized`, com RLS e imutabilidade terminal. Este ledger do atleta é distinto deste documento, o Project Decision Ledger.
- Motivo: a proposta e a decisão são fatos históricos auditáveis mesmo sem persistência de chat/dossier completo.
- Impacto: data model, repository, security e histórico Personal.

### ADR-0047 — Staleness e idempotência

- Data: 2026-09-27
- Status: accepted
- Decisão: source program/revision precisa continuar ativo na aprovação; caso contrário a decisão vira stale sem draft. Row lock, estado terminal, lineage única e retorno do mesmo registro materializado tornam retries idempotentes.
- Motivo: impedir aplicação em baseline diferente e revisões duplicadas por double tap/retry.
- Impacto: RPC transacional, testes e UX.

### ADR-0048 — Intervention Episode semantics

- Data: 2026-09-28
- Status: accepted
- Contexto: Phase 11 relaciona decisões do Coach a treino posterior.
- Regra anterior: `coach_decisions` registrava proposta/decisão; não havia noção de intervenção executada.
- Decisão: proposal ≠ materialized draft ≠ intervenção. `InterventionEpisode` é derivado de `CoachDecision` + programa materializado + `activated_at`. Outcome só começa quando o programa materializado foi efetivamente ativado; draft nunca ativado (`draft` → `awaiting_activation`; arquivado sem `activated_at` → `never_activated`) não é intervenção. `coach_decisions.status` não recebe `successful/failed/worked`; outcome é camada separada.
- Motivo/evidência: `activated_at` é preservado ao arquivar/concluir (constraint da Phase 5); `materialized_program_id` é `on delete restrict`, logo o draft não pode ser apagado.
- Impacto: domain `outcomes`, application, dossier, UI.

### ADR-0049 — Outcome evidence is non-causal (`intervention-outcome-v1`)

- Data: 2026-09-28
- Status: accepted; versão corrente intervention-outcome-v2 (ADR-0063/0065)
- Decisão: **Post-intervention change is evidence, not proof of causation.** `InterventionOutcomeEvaluation` expõe antes, depois, `absoluteDelta`, `relativeDelta` (null com denominador zero ou valor ausente), amostras por métrica, cobertura, limitações e evidências. Proibidos: improved/worsened/success/failure/effective, score, tonnage, ajuste por peso corporal, resposta muscular. Eligibility factual: `not_materialized`, `awaiting_activation`, `never_activated`, `awaiting_post_exposure`, `limited_data`, `evaluable` (= computável para todo exercício afetado, não confiável clinicamente). Requisito técnico mínimo: ≥1 exposição antes e ≥1 depois.
- Storage: nenhuma tabela, view ou cache. Projeção reconstruída sob demanda a partir de `coach_decisions`, programas/revisões, `activated_at` e workouts brutos (mesma política da ADR-0033).
- Impacto: domain, application, docs, UI.

### ADR-0050 — Exposure-based before/after windows

- Data: 2026-09-28
- Status: accepted
- Decisão: exposição = sessão terminal (completed/abandoned) com ≥1 série completed do mesmo `exercise_id` canônico; skipped/pending não criam exposição; sessões em andamento são ignoradas. Baseline = até 3 exposições mais recentes com `started_at` < `activated_at` (qualquer programa; `baseline_includes_other_programs` quando aplicável). Post = até 3 primeiras exposições com `started_at` ≥ `activated_at` **e** proveniência (training day → programa) igual ao programa de intervenção. Dois escopos: todas as séries do exercício e séries da prescrição alterada (source set ID antes; set correspondente ativado depois).
- Stop condition: a janela pós fecha ao atingir 3 exposições ou quando o programa de intervenção deixa de estar ativo (substituição/arquivo/conclusão). É determinística via proveniência imutável, mas mais conservadora que "revisão que altera o mesmo exercício": qualquer nova ativação encerra a janela (limitação documentada).
- Motivo: calendário mistura frequência, semanas sem treino e exercícios ausentes. Janelas civis de 7/28 dias do Dossier continuam como contexto separado.
- Impacto: domain e documentação.

### ADR-0051 — Proposal vs activated intervention fidelity

- Data: 2026-09-28
- Status: accepted; cálculo de mudanças adicionais refinado pela ADR-0065 (comparação com o draft materializado esperado)
- Decisão: outcome avalia o programa **realmente ativado**. Cada action registra source, proposto, materializado (reconstruído: a RPC aplica a action literalmente e não há snapshot do draft) e ativado. A correspondência usa o caminho estrutural (sequências bloco/semana/dia/prescrição/set) com o mesmo exercício; fallback: única prescrição do mesmo exercício no mesmo dia. `InterventionFidelity` informa localização, identidade do exercício, igualdade do valor e diferenças adicionais (target, RIR, descanso, carga, tempo, número de sets, exercício) além de prescrições alteradas no resto do programa. Não existe fidelity score. Múltiplas actions ou edições manuais na prescrição geram `multiple_variables_changed_concurrently`.
- Impacto: domain, UI e integração.

### ADR-0052 — Individual Response Evidence contract

- Data: 2026-09-28
- Status: accepted; regra de agrupamento superseded pela ADR-0056 (v2 inclui target metric)
- Decisão: `individual-response-evidence-v1` agrupa episódios ativados apenas por `exercise_id` + dimensão (`target`, `planned_rir`, `planned_rest`, `absolute_load`). Cada episódio mantém prescrição antes/proposta/ativada, fatos, comparações, amostras e limitações próprios; não há média entre episódios, preferência, reward, bandit, RL ou alteração automática de prompts/proposals/programas. **Individual response is learned as accumulated evidence across comparable exposures, not as a single causal conclusion.** Volume/frequência exigem futuras interventions add/remove set e scheduling antes de qualquer aprendizado legítimo.
- Impacto: domain/application.

### ADR-0053 — Athlete Training Dossier v2

- Data: 2026-09-28
- Status: accepted; v2 permanece histórico; versão corrente superseded pela ADR-0060 (v3)
- Regra anterior: `athlete-training-dossier-v1` (ADR-0034) sem histórico de intervenções.
- Decisão: `athlete-training-dossier-v2` mantém todos os campos e significados de v1 e adiciona `interventionHistory` (até 10 decisões mais recentes por `proposedAt` desc/ID, com `totalAvailable/included/hasMore`, status de outcome, mudanças, amostras, comparações sem evidência inline, limitações e evidências). `null` significa não carregado. Evidence vocabulary ganha `coach_decision`. Metadata de `CoachAnalysis` aceita v1 (histórico) e v2 e passa a registrar a versão real do dossier enviado. v1 não é alterado silenciosamente: permanece em snapshots históricos.
- Motivo: adicionar seção muda o contrato enviado ao provider; bump explícito evita quebra silenciosa.
- Impacto: domain, application schemas, Edge Functions, mobile, testes e integração.

### ADR-0054 — Coach prompt policy for prior interventions

- Data: 2026-09-28
- Status: accepted; prompts v2 permanecem históricos; versão corrente superseded pela ADR-0061 (v3)
- Regra anterior: `coach-system-v1` e prompt de proposal sem política sobre outcomes.
- Decisão: `coach-system-v2` = v1 literal + política: outcomes anteriores são evidência observacional com confounding; respeitar amostras; citar limitações; não afirmar causalidade; não assumir que delta passado garante resposta futura; não repetir/reverter mudança só pelo sinal do delta. Proposal prompt `coach-proposal-prompt-v2` (versão de prompt, distinta do schema `coach-proposal-v1`) proíbe repetição automática. v1 continua exportado como histórico. Nenhuma regra lexical determinística de causalidade foi adicionada ao output safety (limitação).
- Impacto: packages/ai, application (fallback de safety), testes.

### ADR-0055 — Corrective: re-saving draft structure

- Data: 2026-09-28
- Status: accepted
- Contexto: a integração da Phase 11 (editar o draft materializado antes de ativar) revelou defeito da Phase 5.
- Regra anterior: `replace_training_program_structure` apagava `training_blocks` e dependia de `ON DELETE CASCADE`.
- Evidência: durante o cascade o pai já foi removido e `assert_program_structure_mutable()` não resolve o programa, lançando `Only draft program structure can be changed`. Qualquer draft com estrutura (salvo antes, clone de revisão, draft materializado pelo Coach) não podia ser salvo novamente. Reproduzido no banco local.
- Decisão: migration nova `20260928120000_correct_draft_structure_replacement.sql` substitui somente a função, removendo filhos leaf-first. Guard, grants, ownership e semântica do draft inalterados; nenhuma migration anterior reescrita.
- Impacto: DB (12 asserções pgTAP novas), Program Builder e fluxo de revisão de proposals.

### ADR-0056 — Individual Response Evidence v2

- Data: 2026-09-28
- Status: accepted; IRE corrente é v3 com set_count (ADR-0063)
- Regra anterior (ADR-0052): `individual-response-evidence-v1` agrupava por `exercise_id` + dimensão.
- Decisão: `individual-response-evidence-v2` agrupa por `exercise_id` + dimensão + (para `target`) métrica do valor ativado; reps, segundos e metros nunca se misturam. Cada episódio passa a carregar resumo/data da proposta, programa de origem e de intervenção (id/revisão) e o contexto de peso corporal do outcome. Continua sem médias, preferências ou scores.
- Motivo: Response Memory precisa de grupos semanticamente compatíveis e de proveniência por episódio sem criar um segundo sistema paralelo.
- Impacto: domain outcomes, application, testes. `IndividualResponseEvidence` é a base (episódios organizados); `IndividualResponseMemory` é a projeção bounded para o Coach.

### ADR-0057 — Individual Response Memory contract

- Data: 2026-09-28
- Status: accepted; versão corrente individual-response-memory-v2 (ADR-0065)
- Decisão: `individual-response-memory-v1` é uma projeção derivada e reconstruível de `coach_decisions` + lineage de programas + workouts + outcomes (Phase 11). Sem tabela, cache, `learned_preferences`, `response_scores` ou pesos. Contém `notices`, `summary`, `groups` (`totalAvailable/included/hasMore`), `totalEpisodes`, `includedEpisodeDetails`, `omittedEpisodeDetails` e `truncation`. **Response Memory remembers observations, not truths.** **Repeated observational evidence may inform future reasoning, but it must not become an automatic training rule.**
- Bounding: até 10 grupos (alinhado ao histórico de 10 decisões) e até 5 episódios detalhados por grupo; agregados sempre usam todos os episódios do grupo. Drill-down (`GetResponseMemoryGroup`) não trunca.
- Ordem determinística: grupos por última ativação desc, depois key; episódios por `activatedAt` desc, depois decision ID. Sem decay, pesos de recência ou ranking por LLM.
- Identidade estável: key estruturada `exerciseId.dimension[.metric]`, sem UUID aleatório nem hashing.
- Impacto: domain `response-memory`, application, dossier, UI.

### ADR-0058 — Comparable intervention episode semantics

- Data: 2026-09-28
- Status: accepted
- Decisão: a assinatura (`NormalizedInterventionSignature`) usa o valor **ativado** (não o proposto). Direção estrutural `increase | decrease | unchanged | mixed | not_comparable`: valores simples comparam numericamente; faixas só têm direção quando os dois limites se movem no mesmo sentido ou um fica igual (ex.: 8–12 → 8–10 = decrease); alargar/estreitar é `mixed`; valor ausente, carga não absoluta ou métrica diferente é `not_comparable`. Não há buckets de magnitude.
- Strict comparable exige: alteração ativada identificável, ≥1 exposição antes e depois, nenhum confounder estrutural da Phase 11 (`multiple_variables_changed_concurrently`, `multiple_exercises_changed_concurrently`, `unproposed_changes_in_affected_prescription`, `program_revision_changed_other_prescriptions`, `exercise_identity_changed`, `proposed_action_not_present_at_activation`), observação da dimensão presente (`rir/rest/load_observations_missing` exclui) e ≥1 comparação relevante com delta. Os demais episódios são `context_only`, com os motivos, e nunca são apagados.
- Limitações de dados (cobertura parcial, janelas menores, contagens desiguais, baseline de outro programa ou de intervenção anterior, janela aberta, peso corporal) permanecem visíveis mas não excluem: intervenções sequenciais no mesmo exercício têm, por construção, o baseline sob a intervenção anterior, que é justamente o estado "antes".
- **Strict ≠ experimento controlado**: significa apenas comparável segundo regras estruturais.

### ADR-0059 — Observational aggregation without causality

- Data: 2026-09-28
- Status: accepted
- Decisão: por grupo e métrica (sets alterados: métricas que a Phase 11 marca relevantes à dimensão; exercício inteiro: séries por exposição, maior carga registrada, melhor e1RM), sobre episódios strict: contagens de deltas positivos/zero/negativos/ausentes, mínimo, máximo, **mediana** e totais de amostras antes/depois. Média não é calculada (amostras pequenas e outliers). Deltas relativos não são agregados. "Positivo" é aritmético (depois − antes > 0), nunca "melhor". `signPattern` e `contradictory` (positivo e negativo coexistem) tornam contradições explícitas; nenhum episódio antigo é removido por ser contraditório. `hasMultipleComparableEpisodes` (≥2 strict) é técnico, não "evidência forte". Proibidos: responder/non-responder, valores ótimos, confidence calculado, scores.
- Impacto: domain, UI, Coach.

### ADR-0060 — Athlete Training Dossier v3

- Data: 2026-09-28
- Status: accepted; v3 permanece histórico; corrente é v4 (ADR-0065)
- Regra anterior (ADR-0053): v2 com `interventionHistory`.
- Decisão: `athlete-training-dossier-v3` mantém v2 intacto e adiciona `responseMemory` bounded. Episódios da memória referenciam decisões (`coach_decision`) e trazem apenas observações compactas das métricas de resposta, sem fatos brutos por janela nem evidência inline, evitando duplicar `interventionHistory`. Novo evidence kind `response_memory_group` (id = key estável). `BuildInterventionContext` produz histórico e memória a partir de uma única computação de outcomes (antes: histórico isolado); a dívida de calcular todas as decisões antes de limitar permanece.
- Impacto: domain, application, Edge Functions, mobile, schemas Zod, testes, integração.

### ADR-0061 — Coach Learning Policy

- Data: 2026-09-28
- Status: accepted; prompts v3 permanecem históricos; correntes são v4 (ADR-0066)
- Regra anterior (ADR-0054): `coach-system-v2` e `coach-proposal-prompt-v2`.
- Decisão: `coach-system-v3` = v2 literal + Coach Learning Policy com 14 regras (evidência observacional, repetição ≠ causalidade, sem regra fixa, amostras, confounders, cobertura, alteração ativada, contradições explícitas, não descartar episódio contrário, sem "responde melhor" sem qualificação, sem garantia de repetição, conhecimento geral não apaga evidência individual, não é experimento, validator + aprovação humana obrigatórios) e reafirma que performance passada não supera safety. `coach-proposal-prompt-v3`: Response Memory nunca autoriza proposta por si; delta passado positivo sozinho não justifica repetir (nem negativo reverter). v1/v2 continuam exportados. Response Memory não altera prompts, proposals, programas ou modelos automaticamente.
- Loop documentado: Response Memory → interpretação do Coach → proposta estruturada → validator → aprovação humana → revisão → outcome → Response Memory. É aprendizado com controle humano, não autonomia.

### ADR-0062 — Proposal contract v2 and set-count actions

- Data: 2026-09-28
- Status: accepted; v2 permanece válido para snapshots; contrato corrente é coach-proposal-v3 (ADR-0068)
- Regra anterior (ADR-0043): `coach-proposal-v1` só permite ajustes de target, RIR, descanso e carga; add/remove set postergados.
- Decisão: `coach-proposal-v2` = ações v1 + `add_prescription_set` e `remove_prescription_set`. Add: `trainingDayId`, `exercisePrescriptionId`, `position: "end"` (sempre anexada ao fim), `copyFromPrescriptionSetId` opcional apenas como proveniência (mesma prescrição, não removido na mesma proposta) e `plannedSet` explícito com todos os campos (métrica, faixa, RIR, descanso, tempo, carga), validado por `assertPrescriptionSet` e com a mesma métrica das séries existentes. Remove: set existente da prescrição/dia/programa de origem. Rejeitados: remover o último set, remover/ajustar o mesmo set duas vezes, copiar de set removido, v1 contendo ações v2. Não há patch genérico, UUID gerado pelo modelo, replace exercise, frequência ou dias.
- Compatibilidade: Zod despacha por `schemaVersion` (v1 nunca é lido com o parser v2); o ledger aceita as duas versões e exige `proposal_snapshot.schemaVersion = proposal_schema_version`. Nenhum snapshot histórico foi migrado.
- Impacto: domain proposal, application schemas/validator, AI, RPC, UI de revisão.

### ADR-0063 — Set count is not muscle volume

- Data: 2026-09-28
- Status: accepted
- Decisão: **Set-count intervention changes the number of planned sets for a canonical Exercise; it does not represent muscle volume or training stimulus.** **More sets and fewer sets are factual prescription changes, not inherently better or worse.** Nova dimensão `set_count` (contagem de sets planejados por `ExercisePrescription`) em episode, outcome (`intervention-outcome-v2`), IRE (v3) e Response Memory (v2). Sem sets por músculo, effective/hard sets, tonnage, landmarks, valor ótimo ou "volume response". Remove + add que mantém a contagem é edição estrutural, gera `set_structure_changed_without_count_change` (confounder estrutural) e não forma grupo `set_count`.
- Impacto: domain, UI e prompts.

### ADR-0064 — Set-count materialization

- Data: 2026-09-28
- Status: accepted
- Decisão: nova migration `20260929120000_coach_proposal_v2_set_count.sql` redefine `materialize_coach_decision` (mesmo lock, idempotência e staleness): sets removidos não são copiados, sobreviventes mantêm a ordem e são renumerados 1..n, ajustes v1 aplicam-se ao set de origem, sets adicionados são anexados na ordem das ações a partir do `plannedSet` (novos UUIDs só na materialização). A RPC revalida entidades, duplicidade, cópia de set removido e contagem ≥ 1 por prescrição; o draft nunca é ativado. `domain.materializeProposalPrescription` é o espelho puro usado pelo validator, pela revisão e pela fidelidade. O builder ganhou "Remover série" (nunca o último set) para revisão humana real do draft.
- Impacto: DB (41 asserções pgTAP novas), domain, mobile.

### ADR-0065 — Set-count outcome semantics, Response Memory v2 and Dossier v4

- Data: 2026-09-28
- Status: accepted; versões correntes: intervention-outcome-v3, IRE v4, individual-response-memory-v3 e dossier v5 (ADR-0070/0072)
- Decisão: cada prescrição tocada por add/remove gera um snapshot `set_count` (antes/proposto/materializado/ativado + sets adicionados/removidos). O valor ativado é autoritativo (proposta 3→4 ativada com 5 = intervenção 3→5, fidelidade não exata). Fidelidade compara o programa ativado com o draft materializado esperado (espelho puro), então edições manuais aparecem como mudanças adicionais para todas as dimensões. Fatos passam a incluir sets planejados/pendentes e o número de exposições do escopo; métricas novas `planned_sets_per_exposure` e `actual_reps_per_exposure`, além de `completed_sets_per_exposure`, carga, e1RM, target, RIR e descanso relevantes a `set_count`. Contagens por exposição usam como denominador apenas as exposições que contêm sets do escopo (evita diluir o baseline com sessões de outros programas). Planejado ≠ concluído é sempre preservado; sem adherence score.
- Response Memory v2: grupo `exerciseId.set_count` (sem número de sets na key); cada episódio mantém antes/depois e direção increase/decrease; mesmas regras strict/context-only e agregados. Dossier `athlete-training-dossier-v4` mantém a forma v3, com conteúdo que pode incluir `set_count`.
- Impacto: domain outcomes/response-memory/dossier, application, UI, integração.

### ADR-0066 — Coach prompts v4 for set count

- Data: 2026-09-28
- Status: accepted; prompts v4 permanecem históricos; correntes são v5 (ADR-0072)
- Decisão: `coach-system-v4` = v3 literal + política: set count não é volume muscular; mais/menos séries não são melhores/piores por si; distinguir planejado de concluído; resposta observada é evidência observacional; nunca inferir número ótimo de séries ou volume ótimo nem usar MEV/MAV/MRV. `coach-proposal-prompt-v4` é derivado do v3 substituindo explicitamente as frases de vocabulário v1 (sem anexar regra contraditória): gera `coach-proposal-v2`, add/remove apenas com suporte de evidência, mudanças pequenas, sem remover o último set, sem frequência/dias/replace, sem aumentar séries porque a performance melhorou nem reduzir porque caiu, proposta continua opcional (`{"proposal":null}`).
- Impacto: packages/ai, application (fallback de safety), testes.

### ADR-0067 — Deno-compatible shared package resolution for Edge Functions

- Data: 2026-09-28
- Status: accepted
- Contexto: após a Phase 13, o runtime local (`supabase-edge-runtime-1.74.3`, Deno 2.1.4) passou do erro ambiental de TLS e revelou que nenhuma Edge Function inicializava: `coach-decide` falhava em `Module not found …/create-athlete-coach-supabase-client` (imports relativos sem extensão em `packages/data-access`) e `coach-analyze`/`coach-propose` em `Relative import path "@athlete-coach/domain"` (especificadores de workspace sem mapeamento). Defeito reproduzido também no código anterior à Phase 13.
- Regra anterior: as functions importavam `packages/*/src/index.ts` por caminho relativo e dependiam implicitamente da resolução do npm workspace, que não existe no Deno.
- Decisão: uma única estratégia runtime-native. (1) Todos os imports relativos dos packages usam extensão `.ts` explícita (convenção já adotada por domain, application e ai; `allowImportingTsExtensions` já habilitado; Node, TypeScript e Metro continuam funcionando). (2) Um import map versionado, `supabase/functions/deno.json`, mapeia apenas `@athlete-coach/domain`, `@athlete-coach/application`, `@supabase/supabase-js` e `zod` (mesmas versões fixadas nos package.json), ligado explicitamente a cada function por `import_map` em `supabase/config.toml`. Sem bundler, sem cópia de código, sem alteração de regra de negócio, auth, JWT, service role, secrets ou TLS.
- Evidência: boot real das três functions no runtime local e smoke HTTP (401 sem usuário, 400 para `athleteId` do cliente, 503 `coach_unavailable` sem `GEMINI_API_KEY`, 200 em `list`, 400/409 em erros de decisão).
- Impacto: packages/data-access, supabase/functions, supabase/config.toml, documentação. Novos especificadores de workspace usados pelas functions exigem entrada no import map.

### ADR-0068 — Exercise replacement proposal contract (coach-proposal-v3)

- Data: 2026-09-28
- Status: accepted
- Regra anterior (ADR-0043/0062): replace exercise fora do vocabulário.
- Decisão: `coach-proposal-v3` = ações v2 + `replace_exercise` com `trainingDayId`, `exercisePrescriptionId`, `sourceExerciseId`, `replacementExerciseId`, `relationshipContext` (igual às relações armazenadas) e `loadTransition` explícita. Ordem canônica na materialização: remoções → ajustes por série → séries adicionadas → troca (exercício + transição de carga) → sequência contígua. Rejeitados: origem diferente da prescrição, substituto inexistente/inativo ou igual à origem, sem relação armazenada, contexto de relação divergente (tipo ou direção), troca duplicada da mesma prescrição, `adjust_absolute_load_target` numa prescrição trocada, v1/v2 contendo troca. Zod despacha por `schemaVersion` (v1 e v2 nunca com o parser v3); correção: o schema v2 passou a usar a constante explícita v2. Nova migration `20260930120000` aceita v3 e redefine `materialize_coach_decision`, que revalida tudo no banco, aplica a troca somente no draft (histórico e programa de origem intactos), é idempotente e respeita staleness.
- **Exercise replacement changes canonical movement identity.** **Performance history remains attached to the Exercise that was actually performed.**
- Impacto: domain proposal, application schemas/validator, AI, DB (45 asserções pgTAP), revisão mobile.

### ADR-0069 — Exercise relations are context, not equivalence; deterministic candidates

- Data: 2026-09-28
- Status: accepted
- Decisão: candidatos de troca são exercícios do catálogo com ao menos uma linha armazenada em `exercise_relations` com a origem, em qualquer direção armazenada, cada relação com tipo e direção reais (`candidate_to_source` = "candidato é <tipo> de origem"; `source_to_candidate` = "origem é <tipo> de candidato"). Relações de mão única (`variation_of`, `regression`, `progression`) nunca são espelhadas em runtime. Candidatos são construídos pelo backend (`GetExerciseReplacementCandidates` sobre o repositório do catálogo, novo método read-only `listRelationEdges`) somente para os exercícios do programa ativo (até 12 exercícios de origem × 6 candidatos, com truncamento declarado) e enviados no dossier; o modelo só escolhe IDs dessa lista e o validator usa essa lista, nunca a saída do modelo. Cobertura limitada do catálogo é aceita e documentada; o atleta pode trocar manualmente no builder. **An ExerciseRelation provides structured context, not proof of equivalence or suitability.**
- Impacto: domain `exercise/replacement`, data-access, application, dossier, prompts.

### ADR-0070 — Cross-exercise outcome semantics (intervention-outcome-v3)

- Data: 2026-09-28
- Status: accepted
- Decisão: dimensão `exercise_replacement`. O exercício ativado é autoritativo (proposto A→B, ativado A→C = intervenção A→C, fidelidade não exata) e o contexto de relação é reconstruído para o par ativado; sem relação armazenada → `replacement_relation_missing`. A prescrição trocada sai das comparações do mesmo exercício e gera um `CrossExerciseObservationPair`: baseline = últimas exposições de A antes da ativação; pós = primeiras exposições do exercício ativado no programa de intervenção (mesma janela/parada da Phase 11); histórico anterior do novo exercício separado em `replacementPriorHistory`. Fatos lado a lado sem delta: séries planejadas/concluídas e reps por exposição, taxa dentro do alvo, cobertura de RIR e descanso. `best_logged_load_kg` e `best_estimated_one_rep_max_kg` ficam em `nonComparableMetrics`, cada um no histórico do seu exercício. **Load and estimated 1RM are not directly comparable across different canonical Exercises.** PRs nunca são transferidos. Mudanças simultâneas (séries, RIR etc.) continuam confounding; a troca em si não é confounder da própria dimensão. Edição manual do exercício no draft é mudança adicional (episódio context-only), coerente com a Phase 13.
- Impacto: domain outcomes, IRE v4, UI.

### ADR-0071 — Replacement load transition policy

- Data: 2026-09-28
- Status: accepted
- Decisão: `loadTransition` obrigatória: `preserve_non_absolute` (somente se nenhuma série afetada tem carga absoluta), `athlete_selected` ou `explicit_absolute` com uma nova carga planejada para o exercício substituto. Carga absoluta nunca é copiada; não há conversão barra/halter/máquina/peso corporal, percentuais ou multiplicadores. Validada no domínio, no Zod e na RPC.
- Impacto: domain, application, DB, UI de revisão, prompt de proposta.

### ADR-0072 — Directed replacement memory, Dossier v5 and prompts v5

- Data: 2026-09-28
- Status: accepted
- Decisão: IRE v4 e `individual-response-memory-v3` agrupam trocas por par direcionado `sourceExerciseId.exercise_replacement.replacementExerciseId` (A→B ≠ B→A ≠ A→C), usando o exercício ativado. Grupos de troca não têm agregados numéricos entre exercícios; expõem contagens (episódios, strict/context-only, exposições, séries planejadas/concluídas pós), relações observadas e episódios com histórico prévio do novo exercício. "Strict" significa apenas que episódios do mesmo par são estruturalmente comparáveis entre si; o antes/depois dentro de cada episódio continua sendo entre exercícios diferentes. `athlete-training-dossier-v5` adiciona `exerciseReplacementCandidates` (bounded) e evidência `exercise`. `coach-system-v5` e `coach-proposal-prompt-v5` (derivado do v4 substituindo as frases de vocabulário) proíbem comparar carga/1RM entre exercícios, transferir PR, converter carga, ranquear exercícios, inventar IDs e usar troca como tratamento de dor/lesão; safety continua autoritativo.
- Impacto: domain, application, AI, Edge Functions, mobile.

### ADR-0073 — Authentication before provider configuration disclosure

- Data: 2026-09-28
- Status: accepted
- Contexto: `coach-propose` respondia `503 coach_unavailable` a requisições com anon key e sem usuário porque checava `GEMINI_API_KEY`/service role antes de autenticar; `coach-decide` fazia o mesmo com o service role.
- Decisão: antes de `auth.getUser()` só são verificados os pré-requisitos da plataforma para validar o JWT (`SUPABASE_URL`, `SUPABASE_ANON_KEY`); configuração do provider e do service role só após usuário autenticado. Teste de arquitetura `tests/architecture/edge-auth-order.test.mjs` e smoke HTTP no runtime real. Contratos de erro inalterados.
- Impacto: supabase/functions, testes, segurança.

### ADR-0074 — Coach Governance Policy e classes de revisão determinísticas

- Data: 2026-10-01
- Status: accepted
- Decisão: `coach-governance-v1`, função pura no domínio (`assessCoachProposalGovernance`), produz `CoachGovernanceAssessment` com `reviewClass` `standard_review | elevated_review | blocked`, razões ordenadas e `requiresHumanReview: true`, `allowsAutomaticMaterialization: false`, `allowsAutomaticActivation: false`. Classificação pela direção estrutural em demanda de treino, sem limiares de magnitude e sem escore numérico; dúvida → reforçada; bloqueada nunca é persistida. O LLM nunca define a classe. **Review class is an operational governance classification, not a medical or physiological risk score.**
- Motivo: iniciativa proativa exige uma fronteira determinística, auditável e testável; escores numéricos de risco seriam interpretação clínica indevida.
- Impacto: domain `coach-governance`, application, ledger, mobile.

### ADR-0075 — Manual vs Proactive mode e fronteira de autoridade humana

- Data: 2026-10-01
- Status: accepted
- Regra anterior (ADR-0041): "Nenhuma mutation, tool call ou autonomia."
- Regra nova: preferência por atleta `manual` (padrão) | `proactive` (opt-in explícito). Em proativo, o Personal pode apenas continuar uma análise iniciada pelo atleta: analisar, gerar proposta e persisti-la como `proposed` para revisão. Nunca materializa, nunca ativa, nunca cria ProgramRevision sem ação humana; sem scheduler, timer, background, push ou cron. Mutation e tool call continuam proibidas ao modelo. **The Coach may act proactively in preparing advice, but training state changes remain governed by deterministic policy and human authority.** **Initiative does not imply authority.**
- Motivo/evidência: pedido de produto da Phase 15; a autoridade sobre estado de treino permanece no fluxo humano da ADR-0045.
- Impacto: DB (`athlete_coach_preferences`), application (`AnalyzeAthleteWithCoachAndGovernance`, preferências), `coach-analyze`, mobile. ADR-0041 marcada como parcialmente superseded, sem apagar o histórico.

### ADR-0076 — Revalidação no servidor e confirmação de revisão reforçada

- Data: 2026-10-01
- Status: accepted
- Decisão: antes de materializar, `ApproveCoachProposal` recalcula a governança com o programa de origem lido pelo JWT do usuário; a classe efetiva nunca é inferior à persistida (sem rebaixamento pelo cliente); revisão ou baseline divergente é dúvida → reforçada; reforçada exige `confirmElevatedReview: true` (resposta `409 elevated_review_confirmation_required` caso contrário); padrão mantém o passo único. O cliente só envia a confirmação humana, nunca a classe.
- Impacto: application, `coach-decide`, mobile.

### ADR-0077 — Idempotência proativa e isolamento de falhas

- Data: 2026-10-01
- Status: accepted; complementada pelas ADR-0078/0080 (a chave passa a identificar um registro de análise mantido pelo servidor; decisões novas exigem esse registro)
- Decisão: `analysisRequestId` é uma chave de idempotência do cliente (UUID validado, escopo do atleta, nunca autoridade). Índice único parcial `(athlete_id, analysis_request_id)` e a RPC backend-only `create_coach_decision(uuid,jsonb,jsonb)` retornam a decisão existente em retentativas; a aplicação procura a decisão existente antes de chamar o provider. `source_analysis_id` (gerado pelo modelo) não é chave. A análise é sempre devolvida; a proposta proativa informa `not_enabled | no_change | prepared | blocked | unavailable | invalid`, sem proposta falsa; a segunda chamada consome o rate limit. Futuro "Conservative Auto-Draft" apenas documentado, não implementado.
- Impacto: DB, data-access, application, Edge Functions, mobile, integração.

### ADR-0078 — Authoritative Coach Analysis Records; client analysis is non-authoritative

- Data: 2026-10-02
- Status: accepted
- Regra anterior (Implementation Phase 15, ADR-0077 e limitação registrada em 05_AI_COACH): o fluxo manual `coach-propose` recebia a `CoachAnalysis` de volta do cliente e usava seus `safetyFlags`.
- Regra nova: **Client-returned Coach analysis is display data, never authoritative coaching state.** **Safety state used for proposal generation must originate from a server-owned analysis record.** Toda análise concluída e validada é gravada em `coach_analysis_runs` (snapshot estruturado imutável, safety derivado, proveniência de provider/modelo/versões e do programa ativo). `coach-propose` aceita somente `{ analysisRequestId }` (schema estrito; campos extras → 400). O gerador aceita apenas o registro autoritativo. Não é persistência de chat. Retenção até política futura explícita; removido com o atleta.
- Evidência: auditoria mostrou que remover `blocksTrainingAdvice` do corpo levaria à chamada do provider; teste de regressão cobre o caso.
- Impacto: DB, data-access, application, Edge Functions, mobile, docs.

### ADR-0079 — Analysis request identity, idempotency and drift semantics

- Data: 2026-10-02
- Status: accepted; a regra "mesmo id com texto diferente devolve o registro" foi superseded pela ADR-0085 (fingerprint → 409 analysis_request_conflict)
- Decisão: `analysisRequestId` (UUID do cliente ou gerado pelo servidor, nunca do modelo) é a identidade; `UNIQUE (athlete_id, analysis_request_id)`. Retentativa com registro existente devolve o registro (`analysisReused: true`) sem reconstruir dossier nem chamar o provider — mesmo que o texto da pergunta mude (a identidade é o id). Falhas não são gravadas. Drift: o snapshot é a interpretação exibida; a validade da proposta usa o programa e o dossier atuais; programa ativo diferente do registrado (id ou revisão, ou existência) → `StaleCoachAnalysisError` (`409 stale_analysis`) antes do provider. A staleness da materialização (ADR-0045) continua.
- Impacto: application, Edge Functions, mobile.

### ADR-0080 — Proposal handoff through server-owned analysis

- Data: 2026-10-02
- Status: accepted
- Decisão: decisões novas são criadas por `create_coach_decision_for_analysis`, que exige um registro do mesmo atleta e não bloqueado, e delega à criação governada da ADR-0077 (idempotência de uma decisão por análise preservada; manual e proativo compartilham a mesma decisão). A RPC de 3 argumentos da Implementation Phase 15 permanece backend-only por compatibilidade, sem uso pela aplicação (teste de arquitetura). FK composta não adicionada: linhas e testes existentes da Implementation Phase 15 têm request ids sem registro; a integridade para novas decisões é garantida pela RPC. Modo proativo entrega o registro recém-gravado ao gerador, sem ida e volta pelo cliente.
- Impacto: DB, data-access, application, testes.

### ADR-0081 — Numeração: Product Roadmap vs Implementation Sequence

- Data: 2026-10-02
- Status: accepted
- Contexto: o roadmap original de produto numera "Phase 15 — Apple Health / HealthKit"; a sequência de execução usou "Phase 15" para Coach Governance & Proactive Mode.
- Decisão: documentos históricos não são renumerados. A partir de agora, prompts, relatórios e docs identificam a numeração: **Product Roadmap Phase N** (plano original em 10_ROADMAP) ou **Implementation Phase N** (sequência executada). "Phase 16" sem qualificador é ambíguo e deve ser evitado.
- Impacto: 10_ROADMAP, relatórios futuros.

### ADR-0082 — Conservative Auto-Draft authority (Implementation Phase 16)

- Data: 2026-10-03
- Status: accepted
- Regra anterior (ADR-0045/0075): toda materialização era aprovação humana explícita; nenhuma materialização automática.
- Regra nova: permissão opcional `draft_authority_mode` (`manual_draft` padrão | `standard_auto_draft`), independente de `autonomy_mode`, com consentimento explícito; operacional somente quando `autonomy_mode = proactive` (armazenada sem efeito caso contrário). O servidor pode criar **apenas um rascunho inativo** quando `coach-auto-draft-v1` autoriza. **Automatic draft creation is limited authority over an inactive revision, never authority over the active training program.**
- Impacto: DB, domínio, aplicação, Edge, mobile. ADR-0045 permanece válida para materialização humana; ADR-0075 é complementada (iniciativa continua sem autoridade sobre o programa ativo).

### ADR-0083 — Auto-draft eligibility is narrower than governance

- Data: 2026-10-03
- Status: accepted
- Decisão: `coach-auto-draft-v1` (domínio, puro, versionado, separado de `coach-governance-v1`) exige origem proativa, `standard_review` e exatamente um ajuste escalar menos exigente (RIR ↑, descanso ↑, carga absoluta existente ↓). **Standard review is necessary but not sufficient for automatic draft eligibility.** Remoção/adição de séries, alvo, troca de exercício, direções mais exigentes, carga introduzida, múltiplas ações/prescrições e dúvida → `ineligible`; safety, proposta inválida e ação desconhecida → `blocked`. Sem escore e sem limiares de magnitude. Governança e elegibilidade são recalculadas imediatamente antes da materialização; a elegibilidade registrada na criação também precisa ser `eligible`.

### ADR-0084 — Materialization authority provenance

- Data: 2026-10-03
- Status: accepted
- Decisão: `materialization_origin` (`human | auto_draft`) sem novos status. `approved_at` permanece exclusivamente humano: rascunho automático tem `approved_at = NULL` (auto-draft **não** é aprovação humana), enquanto `materialized_at` e `materialized_program_id` registram o fato da materialização e `materialization_origin` registra a autoridade real. A origem é definida dentro da transição controlada (trigger lendo configuração de transação definida só pela RPC backend), nunca por coluna enviada. Linhas históricas materializadas foram preenchidas com `human` (fato histórico). Um único motor de materialização (`materialize_coach_decision`) é reutilizado pela RPC `auto_draft_coach_decision`.

### ADR-0085 — Analysis request fingerprint

- Data: 2026-10-03
- Status: accepted
- Regra anterior (ADR-0079): mesmo `analysisRequestId` com outra pergunta devolvia a análise original (limitação registrada).
- Regra nova: `request_fingerprint` = SHA-256 (Web Crypto nativo) da serialização canônica (`coach-analysis-request-fingerprint-v1`, modo, pergunta aparada, até 6 mensagens de contexto como pares [papel, conteúdo]) — sem JWT, chave, timestamps ou metadados aleatórios; arrays evitam dependência da ordem de chaves. Mesmo id + mesmo fingerprint → reutiliza; diferente (ou registro legado sem fingerprint) → `409 analysis_request_conflict`, sem Gemini, sem sobrescrever. `analysisRequestId` é a identidade idempotente; `request_fingerprint` vincula essa identidade à requisição semântica. O fingerprint **não** é autenticação, segredo, identidade do usuário nem assinatura: serve apenas à integridade idempotente. A pergunta bruta não é armazenada.

### ADR-0086 — Active program human-only activation boundary

- Data: 2026-10-03
- Status: accepted
- Decisão: auto-draft só pode criar uma revisão `draft`. Não existe caminho Coach → ativação nem Coach → mutação do programa ativo: o Coach nunca altera, ativa, conclui ou arquiva o programa ativo por conta própria e nunca inicia outcome. A RPC de auto-draft não referencia ativação/transição de programa e verifica que o resultado é `draft`; testes de arquitetura guardam domínio, aplicação, Edge e migration. Rascunho automático não gera outcome nem memória até ativação humana. Ampliação do conjunto elegível e ativação automática ficam documentadas como futuras e **não implementadas**; ativação automática exigiria decisão de autoridade independente.

### ADR-0087 — Human review evidence as a derived projection (Implementation Phase 17)

- Data: 2026-10-04
- Status: accepted; correspondência posicional complementada pela ADR-0094 (evidência v2 com linhagem; v1 histórico)
- Decisão: `coach-draft-review-evidence-v1` descreve o que aconteceu com um rascunho materializado durante a revisão humana: `awaiting_review | activated_unchanged | activated_with_edits | archived_without_activation | limited_data`, comparação por ação (origem → materializado esperado → revisado/ativado), categorias factuais e contagens. Reconstruída de ledger + ciclo de vida do programa, sem migration nem snapshot duplicado. Só existe para decisões materializadas; rejeição de proposta não é arquivamento de rascunho. Funciona igualmente para `human` e `auto_draft`. Redação "o rascunho revisado difere", sem atribuir autor.
- Impacto: domínio, aplicação, mobile, integração.

### ADR-0088 — Review behavior is oversight evidence, never a quality signal

- Data: 2026-10-04
- Status: accepted
- Decisão: **Human review behavior is evidence about oversight, not proof that a proposal was correct.** **User acceptance does not validate a coaching intervention physiologically.** Sem score, taxa de aceitação/sucesso, confiança, reward, feedback subjetivo, aprendizado de preferência ou de política. O histórico expõe apenas contagens transparentes (`coach-draft-review-history-v1`, itens limitados com `totalAvailable/included/hasMore` e ordenação determinística).

### ADR-0089 — Dossier v6, coach-system-v6 and coach-proposal-prompt-v6

- Data: 2026-10-04
- Status: accepted; dossier corrente passou a v7 pela ADR-0094 (prompts v6 mantidos)
- Decisão: `athlete-training-dossier-v6` = v5 + `draftReviewHistory` compacto (≤ 8 itens, contagens, referências `coach_draft_review`). `coach-system-v6` e `coach-proposal-prompt-v6` são v5 verbatim + regras de revisão (supervisão ≠ correção, sem inferir confiança, sem expandir autoridade, fisiologia só por outcomes). v1–v5 permanecem históricos. O tipo de evidência `coach_draft_review` é aditivo nos enums de evidência (precedente: `response_memory_group`), sem alterar as versões dos contratos de análise/proposta.

### ADR-0090 — Auto-draft policy isolation from review history

- Data: 2026-10-04
- Status: accepted
- Decisão: **Auto-draft authority may not expand itself from review history.** `coach-auto-draft-v1` permanece exatamente com RIR ↑, descanso ↑ e redução de carga absoluta existente; testes de arquitetura garantem que política/orquestração de auto-draft e governança não importam o módulo de revisão e que o conjunto elegível não mudou; o módulo de revisão não tem caminho para ativar, materializar ou escrever no ledger. Qualquer próxima decisão de autoridade deve ser nova ADR baseada em arquitetura (fronteiras, reversibilidade, verificações determinísticas), nunca em "aceitação" nem em autoavaliação do modelo.

### ADR-0091 — Stable training structure lineage (Implementation Phase 18)

- Data: 2026-10-05
- Status: accepted
- Regra anterior (Phases 11, 13, 14, 17): correspondência entre revisões por posição (bloco/semana/dia/prescrição/série) com heurísticas por exercício; reordenar parecia troca de exercício ou séries removidas/adicionadas.
- Decisão: `lineage_id` estável nos cinco níveis estruturais, preservado por clone, materialização (Coach, set-count, troca, auto-draft) e salvamento de rascunho; novo nó → nova linhagem; removido → ausente. **Revision identity is not sequence identity.** **Reordering an existing training element does not make it a new element.** **Lineage identifies structural continuity; it does not imply semantic equivalence of changed exercise content.** Linhagem não é row id, sequence nem exercício.
- Impacto: DB, domínio, data-access, builder mobile, integração.

### ADR-0092 — Server-controlled lineage assignment

- Data: 2026-10-05
- Status: accepted
- Decisão: linhagem imutável; qualquer insert direto recebe nova linhagem; só RPCs confiáveis (clone, materialização, salvamento validado) preservam linhagem. O salvamento aceita `lineageId` apenas se existir no mesmo nível do mesmo rascunho, sem duplicatas; cópia de série no cliente deve omitir `lineageId`. `lineage_tracked` é forçado e imutável.

### ADR-0093 — Legacy lineage fallback

- Data: 2026-10-05
- Status: accepted
- Decisão: backfill conservador — cada linha existente é raiz; relações entre revisões anteriores à migration não são inferidas. Comparações usam `lineage` somente quando a revisão comparada tem `lineage_tracked` e ambas as estruturas têm linhagem completa; caso contrário `legacy_position`, exposto explicitamente (`matchingStrategy`). Preferir continuidade desconhecida a ligação falsa.

### ADR-0094 — Lineage-aware review and fidelity matching

- Data: 2026-10-05
- Status: accepted
- Decisão: um único matcher canônico (`training/lineage.ts`) para evidência de revisão e fidelidade de outcome. `coach-draft-review-evidence-v2`/`coach-draft-review-history-v2` (v1 histórico) adicionam `matchingStrategy` e `sequence_changed`; `athlete-training-dossier-v7` (v6 histórico). Fidelidade de outcome: correspondência de prescrição/série por linhagem quando disponível; contrato `intervention-outcome-v3` e semântica fisiológica inalterados (em modo linhagem, `set_count` também sinaliza série substituída com a mesma contagem, preservando a sensibilidade anterior); comportamento legado idêntico. Prompts não mudam (v6). `coach-auto-draft-v1` inalterado.

### ADR-0095 — Full aggregate builder state; viewport is not save scope

- Data: 2026-10-06
- Status: accepted
- Contexto (reproduzido): com rascunho Bloco 1 (Dia A, Dia B) + Bloco 2 (Dia C), o builder carregava só `blocks[0].weeks[0].days[0]`, enviava apenas Dia A a `replace_training_program_structure` (substituição do agregado inteiro) e Dia B e Dia C eram apagados. Também: exercícios fora do catálogo eram descartados, notas/instruções/cues/dia preferido não eram reenviados e faixas de RIR/descanso eram colapsadas.
- Decisão: **A partial editing surface must never imply a full-aggregate replacement.** **Saving one visible training node must preserve every untouched node in the draft.** O builder mantém o agregado inteiro (modelo puro na aplicação) e sempre salva a árvore completa; a seleção de dia é só viewport; trocar de dia não descarta edições.
- Impacto: aplicação, mobile, integração, testes de arquitetura.

### ADR-0096 — Explicit structural deletion and verified whole-tree saves

- Data: 2026-10-06
- Status: accepted
- Decisão: ausência de um nó no viewport nunca significa remoção; remoção só por operação explícita (`removePrescription`, `removeSet`). A RPC de salvamento rejeita árvores incompletas e verifica o resultado antes do commit, de forma atômica, preservando a validação de linhagem (desconhecida, de outro atleta, nível errado, duplicada). Rascunhos de Coach, proativos, auto-draft, set-count e troca preservam alterações em dias não editados. `coach-auto-draft-v1`, ativação humana, contratos de Coach, dossier e prompts inalterados.

### ADR-0097 — Explicit Training Structure Editing

- Data: 2026-10-07
- Status: accepted
- Regra anterior (ADR-0095, UI da correção pós-Implementation Phase 18): o builder só adicionava dias; blocos e semanas não podiam ser adicionados, removidos ou reordenados. A navegação era uma lista única de dias.
- Regra nova: blocos, semanas e dias são adicionados, removidos e reordenados (↑/↓) por operações tipadas e puras em `structureEdits`, reutilizando o mesmo módulo. Não há um segundo conceito de edição, JSON Patch ou mutação genérica. Novos nós não carregam linhagem (o servidor atribui), e reordenar preserva a linhagem. A navegação passa a ser Bloco → Semana → Dia; a lista única de dias é **superseded** por essa hierarquia. A semântica de persistência (árvore inteira, ADR-0095) não muda.
- Motivo/evidência: a limitação "sem CRUD de bloco/semana" registrada no Roadmap da correção pós-Implementation Phase 18. O cenário integrado de 26 passos (adição, remoção, reordenação, rascunho de Coach, auto-draft, logout/login) passa, assim como o pgTAP `structure_editing`.
- Afetados: `packages/application/src/training/program-structure-editor.ts`, builder mobile, `structure-labels.ts`, docs 02/03/04/08/10.

### ADR-0098 — Structural Deletion Requires User Intent

- Data: 2026-10-07
- Status: accepted
- Estende a ADR-0096 (não a substitui): remover bloco, semana ou dia exige uma ação explícita **e** uma confirmação. A confirmação mostra contagens factuais calculadas no editor (`structureSummaries`), sem linguagem alarmista e sem checkbox ou opção pré-selecionada.
- O último nó de cada nível não pode ser removido (`structureRemovalRules`, espelhando o `min(1)` do schema e da RPC). A UI substitui a ação pela explicação da invariante, e o editor lança `StructuralInvariantError`.
- A remoção vale apenas para o rascunho em memória até o salvamento. A linhagem removida nunca é reciclada: tentar reanexá-la é rejeitado pela RPC.

### ADR-0099 — Unsaved Draft Navigation Guard

- Data: 2026-10-07
- Status: accepted
- Decisão: qualquer edição (estrutura, séries, nomes, inclusive o nome do programa) torna o rascunho _dirty_. Sair do builder com alterações não salvas pede confirmação via `usePreventRemove`, com as opções "Continuar editando" e "Descartar alterações".
- Trocar de bloco, semana ou dia não é sair. Descartar não salva. O estado _dirty_ só é limpo após um salvamento bem-sucedido e permanece após uma falha. A navegação pós-salvamento só acontece depois que o estado limpo é renderizado.
- "Salvar e sair" foi rejeitado nesta fase: o salvamento pode falhar por validação (dia sem exercício) ou por rede, e sair não deve depender de um resultado que o atleta não viu.
- Modelo puro: `draft-edit-session.ts`.

### ADR-0100 — Atomic New Program Creation

- Data: 2026-10-08
- Status: accepted
- Regra anterior: o builder criava o programa (`createProgramDraft`, insert direto e durável) e, em outra chamada, salvava a estrutura (`saveProgramStructure`). Uma falha na segunda etapa deixava um rascunho vazio, e a nova tentativa criava outro. Reproduzido localmente: uma intenção gerou 2 rascunhos, 1 deles órfão e vazio.
- Regra nova: **"Creating a training program is one transactional user intent, not a sequence of independently durable mutations."** A criação de programa novo usa `create_training_program_with_structure`, em uma transação: programa e árvore completa, ou nada. A estrutura é gravada pela função canônica `replace_training_program_structure`, sem duplicação. O programa nasce como raiz nova: `draft`, sem `supersedes`, com linhagem nova (linhagem do cliente é rejeitada). Não há job de limpeza de órfãos: a prevenção é transacional.
- Afetados: migration `20261006120000`; aplicação (`CreateTrainingProgramWithStructure`, schema, port); data-access; gateway e builder mobile; testes; docs 00/02/03/04/08/10.

### ADR-0101 — Creation Intent Idempotency

- Data: 2026-10-08
- Status: accepted
- Decisão: **"Retrying the same creation intent must resolve to the same draft."** O `creationRequestId` (UUID) é gerado uma vez por intenção e reutilizado após falha de rede, timeout ou resultado desconhecido. Ele é só identidade: o servidor deriva atleta, dono, status, linhagem e timestamps.
- A unicidade é por atleta (`athlete_id, creation_request_id`). A impressão digital é determinística e calculada no servidor a partir do payload semântico validado, seguindo o padrão da análise autoritativa do Coach (ADR-0085), mas calculada no servidor porque o payload inteiro chega à RPC e assim não pode ser forjado. Retentativas concorrentes são serializadas por advisory lock, com o índice único como garantia final.

### ADR-0102 — Program Creation Retry Conflict Semantics

- Data: 2026-10-08
- Status: accepted
- Decisão: o mesmo atleta, com o mesmo `creationRequestId` e um payload semântico diferente, recebe `program_creation_conflict` (SQLSTATE 23505, HTTP 409). Não sobrescreve, não devolve silenciosamente o existente e não cria outro. A aplicação normaliza para `ProgramCreationConflictError` com `existingProgramId` (lido via RLS, do próprio atleta), e a UI oferece abrir o programa já criado.
