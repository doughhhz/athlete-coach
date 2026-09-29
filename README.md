# Athlete Coach

Fundação arquitetural de um aplicativo mobile pessoal de treinamento, nutrição, performance e acompanhamento por IA. **Athlete Coach é um nome técnico provisório**, não uma decisão de marca.

> Princípio inegociável: **IA interpreta. O sistema calcula.**

## Estado atual

A **Phase 7 — Performance & Derived Metrics Engine** está implementada. O histórico bruto de treinos agora produz, por cálculo determinístico, resumos factuais, attainment, séries cronológicas por exercício, carga máxima registrada, 1RM estimado e recordes conservadores.

Raw Performance permanece imutável e separada de Derived Data. Métricas são recalculadas sob demanda; não há cache persistido, tonelagem global, score, progressão automática, LLM ou interpretação estratégica.

## Stack do shell

- npm workspaces e lockfile na raiz;
- Expo SDK 57, React 19.2.3, React Native 0.86.3 e TypeScript 6.0.3;
- Expo Router 57;
- ESLint e Prettier;

## Stack de dados

- Supabase CLI 2.117.0 como dependência local;
- PostgreSQL/Supabase local gerenciado pelo Docker Desktop;
- `@supabase/supabase-js` 2.117.1;
- AsyncStorage 2.2.0 e URL polyfill 4.0.0 para a infraestrutura React Native;
- migrations SQL, tipos gerados e testes pgTAP versionados.
- Zod 4.6.5 nas fronteiras de formulário, aplicação e respostas externas.

Dependências planejadas para fases futuras, ainda não instaladas:

- Zustand para estado local de interface/sessão;
- TanStack Query para estado remoto e cache;
- um AI Gateway no backend, inicialmente com adapter para Gemini.

A inclusão de qualquer dependência deve ocorrer somente na fase que realmente a utilizar.

## Mapa do repositório

```text
apps/mobile/            aplicação Expo e camada de apresentação
packages/domain/        regras e tipos de domínio, sem dependências de UI/infra
packages/application/   casos de uso e portas
packages/data-access/   adapters de persistência e consultas
packages/ai/            gateway, contexto, orquestração, safety e providers
packages/shared/        primitives realmente compartilhadas, mantidas mínimas
supabase/               migrations e Edge Functions futuras
tests/architecture/     validações de boundaries e decisões arquiteturais
docs/                   documentação canônica
```

## Como iniciar uma mudança

1. Leia [AGENTS.md](AGENTS.md) e os documentos canônicos afetados.
2. Identifique se a mudança altera uma decisão existente.
3. Se alterar, siga o protocolo de [Decision Ledger](docs/09_DECISION_LEDGER.md) antes de implementar.
4. Faça a menor mudança coerente, acompanhada por validações proporcionais ao risco.
5. Entregue um relatório final com mudanças, decisões, hipóteses, riscos, testes e estado do Git.

## Executar no Windows com Expo Go

Pré-requisitos: Node.js 22.13 ou mais recente, npm e Expo Go atualizado no iPhone 11. O computador e o iPhone devem estar na mesma rede local.

No PowerShell, a partir da raiz do repositório:

```powershell
npm install
npx expo login
npx expo whoami
npm run start
```

Informe suas credenciais somente no prompt local do Expo CLI. No iPhone, entre no Expo Go com a mesma conta e então leia o QR code exibido pelo terminal. Se a rede local bloquear a conexão, encerre o servidor com `Ctrl+C` e use:

```powershell
npm run start:tunnel
```

Validação local completa:

```powershell
npm run validate
```

## Supabase local no Windows

Pré-requisitos: Docker Desktop com engine Linux em execução, Node.js 22.13 ou superior e dependências instaladas com `npm install` ou `npm ci`.

```powershell
npm run supabase:start
npm run supabase:status
npm run db:reset
npm run db:test
npm run db:types
npm run test:integration:local
npm run validate
```

O teste integrado cria somente contas artificiais locais e percorre Auth, onboarding, programa e execução de treino. Execute `npm run db:reset` depois dele para remover os dados de teste.

Os scripts confinam arquivos temporários da CLI a `.cache/`, dentro do repositório e ignorada pelo Git. Para encerrar a stack:

```powershell
npm run supabase:stop
```

Copie `apps/mobile/.env.example` para `apps/mobile/.env.local` quando o app precisar inicializar o cliente. Use a URL e a **publishable key** do ambiente desejado; nunca use `service_role` ou secret key no mobile. O iPhone físico e o banco local são validados separadamente nesta fase, sem exposição pública da stack.

### Auth e onboarding no app

Para executar o fluxo funcional, crie `apps/mobile/.env.local` a partir de `apps/mobile/.env.example` e preencha somente:

```text
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

Depois reinicie o Metro sem reutilizar um processo anterior. Sem essas variáveis o app mostra `Backend não configurado`; não há fallback ou login simulado. O fluxo é conta -> sessão -> identidade do atleta -> onboarding -> Hoje/Perfil. Rascunhos ainda não enviados permanecem apenas na memória e podem ser perdidos ao fechar o app.

O Supabase local atende aos testes automatizados no computador. Não altere firewall nem exponha a stack local para conectar o iPhone. Para um teste futuro no aparelho físico, crie manualmente um projeto Supabase, revise as migrations, autorize explicitamente `supabase link`/`db push`, configure a URL e a publishable key desse projeto em `apps/mobile/.env.local`, e execute o Expo Go. Nenhum projeto remoto foi criado ou vinculado nesta fase.

### Workflow de mudança do banco

1. Criar uma migration com `npx supabase migration new <nome>`.
2. Executar `npm run db:reset`.
3. Executar `npm run db:test`.
4. Executar `npm run db:types`; nunca editar `database.types.ts` manualmente.
5. Executar `npm run typecheck` e `npm test`.
6. Revisar o diff e então criar o commit.

## Próximo passo recomendado

Revisar humanamente a Phase 8. AI Coach permanece Phase 9+ e não deve começar sem aprovação explícita e revisão formal de safety/privacidade.

## Phase 8 — Athlete Training Dossier & Longitudinal Signals

Implementada como projeção on-demand `athlete-training-dossier-v1`: contexto, programa ativo, janelas civis 7/28 dias, comparações por exercício, cobertura e evidências limitadas. Nenhum dossier/signal é persistido. The dossier organizes evidence; it does not interpret it. A longitudinal signal is a factual comparison, not a coaching conclusion.

## Phase 9 — Personal AI Foundation

O Personal usa o backend autenticado `coach-analyze`: constrói o dossier corrente sob a identidade JWT, aplica safety determinístico, chama um provider substituível e valida JSON e evidências. Gemini usa HTTP server-side e `GEMINI_API_KEY`; nenhuma chave ou chamada direta ao provider existe no mobile. A conversa é bounded em memória e recomendações nunca alteram programas.

## Phase 10 — Propostas revisadas do Personal

Uma recomendação elegível pode gerar, sob demanda, um `coach-proposal-v1`. O backend aceita somente ajustes de target, RIR, descanso e carga absoluta sobre IDs canônicos, valida e persiste a proposta no Runtime Coaching Decision Ledger. A aprovação cria uma revisão em rascunho em uma única transação; o programa ativo permanece intacto e a ativação continua sendo uma ação humana separada.

## Phase 11 — Resposta observada a intervenções

Decisões materializadas cujo programa foi **ativado** viram episódios de intervenção. O sistema compara deterministicamente até 3 sessões do mesmo exercício antes e depois da ativação (`intervention-outcome-v1`), registra o que foi proposto vs. realmente ativado, expõe amostras, cobertura e limitações, e acumula `individual-response-evidence-v1` por exercício e dimensão. Tudo é recalculado sob demanda; não há tabelas novas. O dossier passou a `athlete-training-dossier-v2` com `interventionHistory` bounded, e o Personal usa `coach-system-v2`. **Post-intervention change is evidence, not proof of causation.** Nada disso adapta programas automaticamente.

Uma migration corretiva (`20260928120000`) permite salvar novamente a estrutura de drafts já preenchidos (ADR-0055).

Próximo passo recomendado: revisão humana da Phase 11 antes de qualquer nova fase.

## Phase 12 — Memória de resposta do atleta

As intervenções ativadas são organizadas deterministicamente por exercício e tipo de alteração (`individual-response-memory-v1`): o que foi realmente ativado, quantas eram comparáveis, confounders, variações numéricas observadas e contradições, sempre com amostras. Nada é persistido; o dossier passou a `athlete-training-dossier-v3` e o Personal usa `coach-system-v3` com a Coach Learning Policy. **Response Memory remembers observations, not truths.** Nenhuma regra, preferência ou adaptação automática é criada.

Próximo passo recomendado: revisão humana da Phase 12.

## Phase 13 — Intervenções de quantidade de séries

O Personal pode propor adicionar ou remover séries de um exercício (`coach-proposal-v2`), sempre revisado por humano e materializado apenas em rascunho. Outcomes, memória de resposta e dossier (`athlete-training-dossier-v4`) passam a acompanhar `set_count` usando o valor realmente ativado e distinguindo séries planejadas de concluídas. **Set count is not muscle volume.** Próximo passo recomendado: revisão humana da Phase 13 e a tarefa separada para tornar as Edge Functions inicializáveis no runtime Deno.

## Correção — Edge Functions no Deno

As Edge Functions do Personal agora inicializam no runtime Deno local do Supabase: imports relativos dos packages usam extensão `.ts` e `supabase/functions/deno.json` mapeia os packages do workspace (ADR-0067). Para testar localmente: `node scripts/run-supabase.mjs functions serve`.

## Phase 14 — Troca de exercício revisada

O Personal pode propor trocar um exercício por outro com relação registrada no catálogo (`coach-proposal-v3`), sempre com transição de carga explícita, revisão humana e materialização só em rascunho. Outcomes mostram o exercício anterior e o ativado lado a lado sem comparar carga ou 1RM estimado; cada exercício mantém seu histórico e seus recordes. Dossier `athlete-training-dossier-v5`, prompts v5. Edge Functions autenticam antes de revelar configuração do provider. Próximo passo recomendado: revisão humana da Phase 14.

## Phase 15 — Modo do Personal (manual ou proativo) com governança

O atleta escolhe o modo do Personal: **Manual** (padrão) ou **Proativo** (opt-in explícito com consentimento). No modo proativo, depois de uma análise pedida pelo atleta, o Personal pode preparar e registrar uma proposta para revisão — nunca materializa, nunca ativa, nunca roda em segundo plano. Toda proposta recebe uma classificação determinística `coach-governance-v1` ("Revisão padrão" ou "Revisão reforçada"), calculada pelo backend e nunca pelo modelo; revisão reforçada exige confirmar "Revisei as alterações propostas" antes de criar o rascunho. Retentativas da mesma análise são idempotentes (`analysisRequestId`). Próximo passo recomendado: revisão humana da Phase 15.

## Correção pós-Implementation Phase 15 — Análise autoritativa no servidor

Propostas do Personal agora partem de um registro de análise mantido pelo servidor (`coach_analysis_runs`), identificado por `analysisRequestId`. O app mostra a análise, mas nunca a devolve ao backend: para pedir uma proposta envia apenas `{ analysisRequestId }`. Estado de safety, evidências e proveniência vêm do registro imutável. Retentativas da mesma análise reutilizam o registro sem nova chamada à IA. Isso não é persistência de chat: a pergunta, a conversa, o prompt e o dossier completo não são armazenados.

## Implementation Phase 16 — Criação conservadora de rascunho

Nova permissão opcional e separada do modo do Personal: **Criação automática de rascunho** (Desligada por padrão / Conservadora, com consentimento explícito). Somente no modo Proativo e somente para um ajuste único e menos exigente (aumento de RIR, aumento de descanso ou redução de carga absoluta existente), o Personal pode criar uma **nova revisão em rascunho** automaticamente. O programa ativo nunca é alterado nem ativado; o rascunho aparece imediatamente ("Rascunho preparado") e a ativação continua sendo sua. O histórico diferencia "Rascunho criado por você" de "Rascunho preparado automaticamente pelo Personal". O `analysisRequestId` agora é vinculado à pergunta: reutilizá-lo com outra pergunta retorna `409 analysis_request_conflict`.

## Implementation Phase 17 — Evidência de revisão humana

O app agora mostra o que aconteceu com cada rascunho criado a partir de uma proposta — por você ou automaticamente: **Aguardando revisão**, **Ativado sem alterações**, **Ativado após alterações** ou **Arquivado sem ativação**, com o antes / preparado / revisado de cada ajuste e as categorias de diferença. É evidência factual de supervisão, reconstruída do histórico existente (sem nova tabela), sem nota, taxa de aceitação, confiança ou recompensa. Ela não altera a política de rascunho automático nem qualquer autoridade do Personal. Dossier `athlete-training-dossier-v6`, prompts `coach-system-v6` e `coach-proposal-prompt-v6`.

## Implementation Phase 18 — Identidade estável entre revisões

Blocos, semanas, dias, prescrições e séries agora têm uma linhagem estável (`lineage_id`) que atravessa revisões: clonar, materializar uma proposta, criar rascunho automático ou salvar um rascunho no builder preservam a linhagem dos elementos existentes; elementos novos recebem nova linhagem; removidos desaparecem. Assim, reordenar exercícios aparece como "Ordem" e não como troca de exercício, e uma troca de exercício continua sendo a mesma prescrição. Programas anteriores a esta fase usam um fallback posicional explícito. Evidência de revisão `coach-draft-review-evidence-v2`, dossier `athlete-training-dossier-v7`.

## Correção pós-Implementation Phase 18 — O builder preserva o programa inteiro

Corrigido: o builder carregava e salvava apenas o primeiro bloco/semana/dia, e o salvamento (que substitui a estrutura inteira do rascunho) apagava os demais dias. Agora o builder mantém o programa completo em edição, permite escolher qualquer dia ("Dia em edição"), acumula alterações de vários dias antes de salvar e sempre envia a árvore completa; nada some sem uma remoção explícita. Faixas de RIR e descanso, notas, instruções e exercícios fora do catálogo também passaram a ser preservados.

## Implementation Phase 19 — Edição explícita da estrutura do programa

O builder agora permite adicionar, remover (com confirmação) e reordenar blocos, semanas e dias. A navegação é Bloco → Semana → Dia; cada nível tem "+", ↑/↓ e "Remover". A confirmação mostra o conteúdo real (semanas, dias, exercícios, séries), sem linguagem alarmista. O último bloco/semana/dia não pode ser removido e a tela explica o motivo. Sair do builder com alterações não salvas pergunta "Continuar editando" ou "Descartar alterações"; descartar não salva nada. Trocar de bloco/semana/dia não é sair. O salvamento continua enviando o programa inteiro.

## Correção pós-Implementation Phase 19 — Criação de programa atômica

Criar um programa novo agora é uma única operação: o programa e toda a sua estrutura são salvos juntos ou nada é salvo. Antes, o app criava o rascunho e só depois salvava a estrutura; se a segunda etapa falhasse e o atleta tentasse de novo, surgiam rascunhos duplicados ou vazios. Cada tentativa de criação usa um identificador estável: repetir a mesma tentativa (por exemplo, após falha de rede) devolve o mesmo rascunho. Repetir com conteúdo diferente é recusado sem alterar nada, e a tela oferece abrir o programa já criado. Em caso de falha, a estrutura montada continua na tela e o aviso de alterações não salvas permanece.

## Correção pós-criação atômica — Criação de programa só pela fronteira atômica

O banco agora impede que qualquer cliente crie um programa inserindo uma linha diretamente em `training_programs`: não existe mais permissão de INSERT para `authenticated` nem `anon`. Programa novo só nasce pela operação atômica `create_training_program_with_structure`, e revisões só pelas operações controladas de revisão e materialização. O app já usava esse caminho; nada muda para o atleta.

## Correção pós-fronteira de criação — Estrutura do programa só muda pelo salvamento completo

Blocos, semanas, dias, exercícios e séries não podem mais ser alterados linha a linha por nenhum cliente. O app sempre salvou o programa inteiro de uma vez, e agora o banco também exige isso: toda alteração de estrutura de rascunho passa pelo salvamento completo, que valida o programa inteiro. Nada muda para o atleta.
