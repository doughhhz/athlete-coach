# Mobile application

Shell navegável da Phase 1 em React Native, Expo e TypeScript.

- `app/`: rotas e layouts do Expo Router; somente composição e navegação.
- `src/presentation/`: componentes, navegação e tema da apresentação.
- `tests/`: verificações mínimas da configuração e das rotas do shell.
- regras de negócio devem vir de `packages/application` e `packages/domain` em fases futuras.

As cinco áreas são placeholders explícitos. Não há autenticação, dados de domínio, Supabase, LLM ou lógica de treino.

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
