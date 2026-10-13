# Operação do portefólio

Guia para pôr o site em produção, publicar conteúdo e recuperar de problemas.
Decisões de fundo: [ADR 0001](adr/0001-arquitetura.md), [0002](adr/0002-seguranca.md), [0003](adr/0003-idiomas.md).

## Como funciona a publicação

1. Editas no painel (`/admin`) e carregas em **Publicar**.
2. O painel pede à Edge Function `trigger-build` que inicie o workflow **Publicar site** (`deploy.yml`).
3. O workflow exporta o conteúdo publicado do Supabase, descarrega as imagens, valida tudo e gera o site.
4. Cerca de 1 a 3 minutos depois, o GitHub Pages serve a versão nova.

Se a validação falhar, o deploy não acontece e o site anterior continua online.

## Preparação (uma vez)

### 1. Supabase

1. Cria dois projetos gratuitos: `portfolio-prod` e `portfolio-staging` (região UE).
2. Em cada um, aplica as migrações a partir do teu computador:
   ```bash
   supabase link --project-ref <ref-do-projeto>
   supabase db push
   ```
3. **Authentication › Sign In / Providers:** desliga *Allow new users to sign up*. Mantém o fornecedor *Email* ligado (sem ele não há login).
4. **Authentication › Multi-Factor:** ativa *TOTP (App Authenticator)*.
5. Cria a tua conta em **Authentication › Users › Add user** (email + palavra-passe forte) e regista-a como admin no **SQL Editor**:
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'o-teu-email@exemplo.com';
   ```
6. Carrega o conteúdo inicial (só numa base vazia):
   ```bash
   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<service_role> npm run seed
   ```
7. Confirma a segurança contra o **staging**:
   ```bash
   SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... npm run test:db
   ```

### 2. Repositório privado de backups

1. Cria o repositório privado `Berna58/portfolio-backups` (vazio, com um README).
2. Gera uma chave só para isto: `ssh-keygen -t ed25519 -C portfolio-backup -f backup_key -N ""`.
3. Em `portfolio-backups › Settings › Deploy keys`, adiciona `backup_key.pub` **com permissão de escrita**.
4. Guarda o conteúdo de `backup_key` (privada) como segredo `BACKUP_DEPLOY_KEY` (passo 3) e apaga os dois ficheiros do computador.

### 3. Segredos do GitHub (`berna58.github.io › Settings › Secrets and variables › Actions`)

| Segredo | Onde o encontras | Usado por |
|---|---|---|
| `SUPABASE_URL` | Supabase › Project Settings › API (`https://<ref>.supabase.co`) | deploy, backup |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase › Project Settings › API keys › `service_role` / secret | deploy, backup |
| `SUPABASE_DB_URL` | Supabase › Connect › *Session pooler* (connection string com a palavra-passe da base de dados) | backup |
| `BACKUP_DEPLOY_KEY` | chave privada do passo 2 | backup |

E uma **variável** (não secreta) em *Variables*: `SUPABASE_ANON_KEY` (Supabase › API keys › `anon` / publishable). O painel precisa dela no browser; o acesso continua protegido por RLS + MFA.

Nunca coloques os segredos no código, em issues ou em mensagens.

### 4. Token para o botão "Publicar"

1. GitHub › Settings › Developer settings › **Fine-grained tokens** › Generate new token.
2. Repository access: **só** `Berna58/berna58.github.io`. Permissions: **Actions: Read and write**. Mais nada.
3. Validade: 1 ano (fica um lembrete para renovar).
4. Guarda-o como segredo da Edge Function (não do GitHub):
   ```bash
   supabase secrets set GITHUB_TOKEN=<token> --project-ref <ref>
   ```

### 5. Edge Functions do botão "Publicar"

```bash
supabase functions deploy trigger-build build-status --project-ref <ref>
supabase secrets set GITHUB_TOKEN=<token> --project-ref <ref>   # do passo 4
```

Opcional: `ALLOWED_ORIGINS` (por omissão `https://berna58.github.io` e o endereço local).

### 6. Corte para o site novo (M8, com autorização)

1. `Settings › Pages › Build and deployment › Source`: **GitHub Actions**.
2. Merge de `v2` para `main`. O push dispara **Publicar site**.
3. Verifica o site. **Reversão:** voltar a `Source: Deploy from a branch` (`main`, `/`) e repor o `main` a partir da tag `v1-legacy`.

## Rotina

- **Backup:** todas as segundas às 03:17 UTC (workflow *Backup semanal*). Pode correr-se à mão em *Actions › Backup semanal › Run workflow*.
- **Pausa do Supabase:** o plano gratuito pausa o projeto após 1 semana sem atividade. O backup semanal conta como atividade. Se mesmo assim pausar, o **site público continua a funcionar**; reativa o projeto no dashboard do Supabase (*Restore*) e o painel volta a funcionar.
- **Token do GitHub:** renovar antes de expirar (o botão Publicar deixa de funcionar quando expira).

## Recuperar de um backup

1. Num projeto Supabase vazio (por exemplo, o staging), aplica as migrações (`supabase db push`).
2. Restaura os dados: `psql "<SUPABASE_DB_URL>" -f db/data.sql` (a partir do clone de `portfolio-backups`).
3. Volta a carregar os ficheiros de `media/` para o bucket `media`, mantendo os caminhos.
4. Corre o workflow **Publicar site** apontado para esse projeto e confirma o resultado.

## Desenvolvimento local

```bash
npm install
npm run dev            # usa o seed local, sem Supabase
supabase start         # base de dados local (portas 55xxx)
npm test               # testes unitários
npm run test:db        # segurança da base de dados (precisa das variáveis do Supabase local)
supabase functions serve   # Edge Functions locais (noutra janela)
npm run build && npm run test:admin   # fluxo completo do painel (.env com os valores locais)
npx playwright test    # e2e + acessibilidade (depois de npm run build)
```
