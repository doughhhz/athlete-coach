# E2E em nuvem — iPhone 11 virtual (EAS + Maestro Cloud + Supabase E2E)

Infraestrutura de QA (não é uma Implementation Phase). Nenhuma credencial fica no repositório.

## 1. Arquitetura

```
Windows (este repo)
  └─ EAS Build (nuvem)         perfil e2e-cloud → .app de simulador iOS (Release, sem Metro)
       └─ Maestro Cloud         iPhone-11 / iOS-18-2 executa e2e/flows
            └─ Athlete Coach E2E  bundle app.athletecoach.e2e
                 └─ Supabase E2E   projeto dedicado, via HTTPS
```

Depois do upload, nada depende do seu PC: sem localhost, sem ngrok, sem Metro.

## 2. Pré-requisitos

- **Conta Expo e EAS CLI:** `eas --version`, depois `eas login`. Rode `eas init` uma vez em `apps/mobile` (veja a seção 11).
- **Maestro CLI** instalado no Windows e **conta no Maestro Cloud**, com API key e Project ID.
- **Projeto Supabase exclusivo para E2E**, com as migrations aplicadas (seção 7).
- **Conta de teste dedicada** no Supabase E2E, com e-mail confirmado. Nunca use uma credencial pessoal ou de produção.

## 3. Build (EAS, sempre disparado manualmente)

```powershell
cd apps/mobile
eas build --platform ios --profile e2e-cloud
```

Ou `./scripts/e2e-cloud.ps1 -Build`, que pede confirmação antes de consumir créditos.

- **Perfil `e2e-cloud`** (`apps/mobile/eas.json`): `ios.simulator: true`, `buildConfiguration: Release`, `environment: preview` e `APP_VARIANT=e2e`.
- **`APP_VARIANT=e2e`:** o `apps/mobile/app.config.ts` passa a usar o nome "Athlete Coach E2E" e o bundle `app.athletecoach.e2e`. Sem essa variável, o app continua exatamente como no `app.json`. Não há bundle de produção definido.
- **Guarda do build:** o hook `eas-build-pre-install` (`apps/mobile/scripts/assert-e2e-build-env.mjs`) interrompe o build `e2e-cloud` se a URL ou a publishable key estiverem ausentes, forem locais ou forem uma chave secreta. Ele imprime só os nomes das variáveis.

**Baixar o `.app`.** O EAS gera um `.tar.gz` com o `.app` dentro. Você pode:
- baixar pelo painel expo.dev → Builds → o build `e2e-cloud` → Download, salvando em `artifacts/e2e/build.tar.gz`;
- ou rodar `./scripts/e2e-cloud.ps1 -Download`, que pega o build `e2e-cloud` finalizado mais recente.

## 4. Variáveis de ambiente

**Build: variáveis de ambiente EAS**, no environment `preview`, visibilidade `plaintext`. São valores públicos do Supabase E2E, os mesmos nomes que o app lê:

```powershell
cd apps/mobile
eas env:create --environment preview --name EXPO_PUBLIC_SUPABASE_URL --value "https://<E2E_PROJECT_REF>.supabase.co" --visibility plaintext
eas env:create --environment preview --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY --value "<sb_publishable_... do projeto E2E>" --visibility plaintext
```

O environment `preview` passa a apontar para o Supabase E2E. Não o reutilize para outros builds sem revisar.

Nunca configure a `service_role`, uma `sb_secret_...`, a senha do banco ou a chave do Gemini no app nem no EAS.

**Execução: sessão do PowerShell, nunca em arquivo:**

| Variável | Uso |
|---|---|
| `MAESTRO_CLOUD_API_KEY` | API key do Maestro Cloud (lida pelo próprio Maestro CLI) |
| `MAESTRO_PROJECT_ID` | Project ID do Maestro Cloud |
| `E2E_EMAIL` / `E2E_PASSWORD` | conta de teste do Supabase E2E (dispensável com `-SmokeOnly`) |

```powershell
$env:MAESTRO_CLOUD_API_KEY = Read-Host "Maestro API key"
$env:MAESTRO_PROJECT_ID = Read-Host "Maestro project id"
$env:E2E_EMAIL = Read-Host "E2E e-mail"
$env:E2E_PASSWORD = Read-Host "E2E senha"
```

## 5. Executar no Maestro Cloud

```powershell
./scripts/run-maestro-cloud.ps1 -AppPath artifacts/e2e/build.tar.gz
./scripts/run-maestro-cloud.ps1 -AppPath artifacts/e2e/build.tar.gz -SmokeOnly
```

- O script extrai o `.app` do `.tar.gz` e chama `maestro cloud` com `--app-file`, `--flows e2e`, `--project-id`, `--device-model iPhone-11`, `--device-os iOS-18-2`, `--format junit` e `--output artifacts/e2e/…xml`.
- As credenciais E2E vão por `-e`, e a API key fica só na variável de ambiente.
- Código de saída: 0 quando todos os fluxos passam; diferente de zero em qualquer falha.
- Se a sua versão do Maestro mudar nomes de opções, confira `maestro cloud --help` e ajuste o script.

## 6. Alvo

Dispositivo **iPhone-11**, **iOS-18-2**, no simulador do Maestro Cloud.

## 7. Supabase E2E

Rode na raiz do repositório.

> ⚠️ Confirme que o projeto vinculado é o **projeto E2E dedicado** antes de qualquer `db push`. Nunca rode `db reset` contra um projeto remoto.

```powershell
npx supabase link --project-ref <E2E_PROJECT_REF>
npx supabase db push --dry-run
npx supabase db push --include-seed
```

- **Seed:** o `--include-seed` carrega o catálogo de exercícios (só dados de referência).
- **Voltar ao projeto principal depois:** `npx supabase link --project-ref <ref principal>`.
- **Conta de teste:** crie pelo próprio app (tela "Criar conta") ou pelo painel (Authentication → Add user, com auto-confirm). Para testes, você pode desativar "Confirm email" no projeto E2E.
- **Edge Functions:** os fluxos 00–02 não usam Edge Functions nem Gemini. Para E2E do Coach no futuro, rode `npx supabase functions deploy --project-ref <E2E_PROJECT_REF>` e cadastre `GEMINI_API_KEY` como secret **do servidor** nesse projeto, nunca no app. Veja as ADR-0105 a 0113 sobre modelo, timeout e autenticação.

## 8. Fluxos

| Fluxo | O que prova |
|---|---|
| `00-smoke` | O build abre, está configurado (sem "Backend não configurado"), mostra "Entrar" e responde a toques (troca Entrar ↔ Criar conta). Sem rede de login. |
| `01-auth` | Login da conta E2E no Supabase E2E; chega às abas (conta já com onboarding) ou ao onboarding (primeira vez). |
| `02-onboarding` | Conclui o onboarding com dados fictícios, se estiver pendente (idempotente), e verifica as 5 abas. |

Os seletores usam `testID` estáveis: `auth-*`, `onboarding-*`, `tab-index|treino|nutricao|progresso|personal`. A consistência é verificada por `tests/architecture/e2e-harness.test.mjs`.

## 9. Resultados

- **Link do upload:** o Maestro imprime o link no terminal, com vídeo, screenshots e o passo que falhou em cada fluxo.
- **JUnit:** fica em `artifacts/e2e/maestro-cloud-*.xml`. A pasta `artifacts/` é ignorada pelo git.

## 10. Problemas comuns

- **"Backend não configurado" no smoke:** o build foi feito sem as variáveis EAS. Normalmente o guarda do build já impede isso; confira `eas env:list --environment preview`.
- **`01-auth` preso na tela de login:** senha ou e-mail errados, e-mail não confirmado, ou o projeto apontado pelo build não é o E2E.
- **`maestro` não encontrado:** instale o Maestro CLI e reabra o terminal.
- **Erro de certificado no PowerShell ou no npm** (antivírus AVG intercepta TLS): `$env:NODE_OPTIONS = "--use-system-ca"`.
- **`eas build` pede `projectId`:** rode `eas init` em `apps/mobile` (seção 11).

## 11. O que continua manual

- **Uma vez:** `eas login` e `eas init` em `apps/mobile`. Como o `app.config.ts` é dinâmico, o `eas init` pode pedir para você adicionar manualmente `extra.eas.projectId` ao `app.json`. Isso é esperado e deve ser commitado.
- Criar o projeto Supabase E2E e a conta de teste.
- Disparar o build EAS, que é pago e explícito.
- **No iPhone físico:** Expo Go/tunnel, câmera, notificações, gestos reais, desempenho e o fluxo do Coach com Gemini continuam validados manualmente.
