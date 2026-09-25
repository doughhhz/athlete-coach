# Arquitetura técnica

Status: **canônico, conceitual**

## Visão de alto nível

```text
Mobile Application (Expo / React Native)
        |
        v
Application Layer (casos de uso e portas)
        |
        v
Domain Layer (invariantes e cálculos puros)
        ^
        |
Data Access Adapters ------------------> Supabase

Backend seguro / Edge Function:
AI Gateway -> Context Builder -> Coach Orchestrator -> Safety Layer
                                                    -> LLM Provider Adapter -> Gemini API
```

O desenho representa responsabilidades, não necessariamente processos separados desde a primeira versão.

## Camadas e boundaries

### Presentation (`apps/mobile`)

Rotas, telas, componentes, acessibilidade, navegação, estado transitório e adaptação de entrada. Não calcula métricas, não acessa Supabase diretamente e não chama LLM.

### Application (`packages/application`)

Casos de uso, transações, autorização de ações, commands/queries e portas de repositório/serviço. Coordena domínio e infraestrutura sem importar implementações concretas.

### Domain (`packages/domain`)

Entidades, value objects, políticas e funções determinísticas. Não depende de frameworks. Domínios iniciais: Athlete, Exercise, Training, Workout, Performance, Recovery, Body, Nutrition, Coach, Memory e Safety.

### Data Access (`packages/data-access`)

Implementações de repositórios, mappers, cache e consultas. Converte tipos externos para contratos internos. Nenhuma linha retornada pelo banco deve atravessar sem validação/mapeamento.

A Phase 2 introduz somente a fundação: uma factory tipada de `SupabaseClient<Database>` em `packages/data-access` e um adapter mobile de configuração/storage em `apps/mobile/src/infrastructure`. Repositories serão adicionados por capacidade quando existirem casos de uso; não há repository genérico. Presentation não importa `@supabase/*` nem executa `.from(...)` diretamente, boundary verificada por teste arquitetural.

### AI (`packages/ai` e backend)

- **AI Gateway:** único ponto autenticado de entrada para solicitações de IA, com limites, observabilidade e idempotência.
- **Context Builder:** seleciona o mínimo contexto autorizado, rotula proveniência, período, unidade e frescor.
- **Coach Orchestrator:** escolhe fluxo, ferramentas determinísticas e formato de saída.
- **Safety Layer:** valida entrada/contexto antes do modelo e saída/ação depois dele. Pode bloquear ou degradar o fluxo.
- **Provider Adapter:** traduz o contrato interno para Gemini ou outro provider.

A sequência exata entre orquestração e safety pode ter gates em múltiplos pontos; Safety não é uma chamada única dispensável.

## Regra de dependência

```text
presentation -> application -> domain
data-access  -> application -> domain
ai adapters  -> application/domain contracts
domain       -> nenhum framework externo
```

Dependências técnicas compartilhadas entram somente quando necessárias. O SDK do Gemini nunca aparece no mobile, domain ou application.

## Estado no cliente

- **TanStack Query:** dados remotos, cache, invalidação e estados de carregamento/erro.
- **Zustand:** estado local ou efêmero, como sessão de UI em andamento.
- **Form state local:** edição ainda não submetida.
- **Servidor/banco:** fonte de verdade persistida.

Não duplicar a mesma entidade persistentemente em Query e Zustand. A estratégia offline detalhada é uma decisão futura; o Workout Runner deve ser projetado para tolerar interrupções.

## Dados e contratos

- I/O externo validado com Zod quando implementado;
- IDs opacos e estáveis;
- timestamps em UTC; timezone original preservado quando altera o significado;
- grandezas com unidade explícita e sem conversões implícitas;
- registros derivados incluem versão do algoritmo e referências aos dados de origem;
- inteligência inclui provider/modelo, versão de prompt/policy e evidências, sem persistir raciocínio interno do modelo.

## Supabase e segurança

- Auth identifica o usuário; Row Level Security aplica isolamento no banco.
- `auth.users` é identidade de autenticação da infraestrutura; `public.athletes` é identidade do domínio e usa UUID próprio.
- Storage usa buckets e políticas específicas, não URLs públicas por padrão.
- Edge Functions guardam secrets e executam integrações privilegiadas.
- O mobile recebe somente URL e publishable key públicas; service role e secret key nunca vão para o cliente.
- Migrations versionam schema, constraints, índices, funções e políticas.
- Grants limitam operações antes da avaliação de RLS: `anon` não acessa `athletes`; `authenticated` recebe CRUD sujeito às políticas de ownership; `service_role` fica reservado ao backend confiável.

RLS, autenticação e threat model devem existir antes de qualquer dado real.

## Confiabilidade e observabilidade

- operações mutáveis relevantes usam idempotency key;
- logs usam correlation ID e evitam payloads sensíveis;
- falhas do provider não comprometem Raw Data nem execução do treino;
- cálculos podem ser reproduzidos pela versão do algoritmo;
- recomendações e decisões permanecem auditáveis;
- backups, exportação e recuperação serão definidos antes de produção.

## Estratégia de testes

- unitários: domínio, fórmulas, invariantes e safety determinístico;
- contrato: repositories, provider adapters e schemas de IA;
- integração: Supabase local e Edge Functions;
- UI: componentes críticos e acessibilidade;
- ponta a ponta: registro de sessão, sincronização e aceite/reversão de decisão;
- evals: qualidade, grounding e segurança do Coach, sem snapshots literais frágeis.

## Estrutura de repositório

Monorepo com `apps`, `packages`, `supabase`, `tests` e `docs`. A Phase 1 adotou npm workspaces e um lockfile único na raiz, conforme ADR-0009. `apps/mobile` e `packages/data-access` são os workspaces ativos; os demais pacotes conceituais não recebem manifests até serem usados.

O shell mobile usa Expo SDK 57, React 19.2.3, React Native 0.86.3 e Expo Router 57. A matriz veio do template oficial estável `default@sdk-57` e deve continuar sendo validada pelo CLI do Expo em upgrades.

A infraestrutura local usa Supabase CLI 2.117.0 versionada na raiz. `supabase/migrations` é a fonte do schema, `supabase/tests` contém testes pgTAP e `packages/data-access/src/generated/database.types.ts` é regenerado do banco local. Nenhum estado criado manualmente no Studio faz parte da arquitetura reproduzível.
