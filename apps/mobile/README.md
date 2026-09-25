# Mobile application

Shell navegável da Phase 1 em React Native, Expo e TypeScript.

- `app/`: rotas e layouts do Expo Router; somente composição e navegação.
- `src/presentation/`: componentes, navegação e tema da apresentação.
- `src/infrastructure/`: adaptação mobile de serviços externos; contém a factory Supabase com AsyncStorage, sem queries de domínio.
- `tests/`: verificações mínimas da configuração e das rotas do shell.
- regras de negócio devem vir de `packages/application` e `packages/domain` em fases futuras.

As cinco áreas são placeholders explícitos. A infraestrutura do cliente Supabase está preparada, mas não é inicializada por tela e não há login, query de domínio, LLM ou lógica de treino.

Quando um fluxo futuro precisar do cliente, copie `.env.example` para `.env` e configure somente `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Nunca use secret key ou `service_role` no Expo.

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
