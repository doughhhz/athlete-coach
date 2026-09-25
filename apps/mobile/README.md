# Mobile application

Aplicação mobile da Phase 3 em React Native, Expo e TypeScript.

- `app/`: rotas e layouts do Expo Router; somente composição e navegação.
- `src/presentation/`: componentes, navegação e tema da apresentação.
- `src/infrastructure/`: adaptação mobile de serviços externos; contém a factory Supabase com AsyncStorage, sem queries de domínio.
- `tests/`: verificações da configuração, proteção de rotas e fluxo estrutural.
- regras e validações reutilizáveis vêm de `packages/application` e `packages/domain`.

Auth, onboarding e Perfil são funcionais. Um único cliente Supabase é composto na infraestrutura e as telas não executam queries. As cinco tabs permanecem; somente Hoje apresenta dados reais do perfil, enquanto as demais capacidades futuras continuam explícitas. Não há LLM ou lógica de treino.

Copie `apps/mobile/.env.example` para `apps/mobile/.env.local` e configure somente `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. O Expo carrega o arquivo no diretório do app. Nunca use secret key ou `service_role`. Ausência de configuração produz uma tela explícita e não dados falsos.

## Execução

A partir da raiz do repositório:

```powershell
npm install
npx expo login
npx expo whoami
npm run start
```

Use a mesma conta no Expo CLI e no Expo Go antes de ler o QR code.

Para validação completa:

```powershell
npm run validate
```
