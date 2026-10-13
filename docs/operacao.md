# Operação do portefólio

Guia para pôr o site em produção, publicar conteúdo e recuperar de problemas.
Decisões de fundo: [ADR 0001](adr/0001-arquitetura.md), [0002](adr/0002-seguranca.md), [0003](adr/0003-idiomas.md), [0004](adr/0004-vercel.md).

## Como funciona a publicação

1. Editas no painel (`/admin/`) e carregas em **Publicar alterações no site**.
2. A Edge Function `trigger-build` (só aceita admin com MFA) chama o **Deploy Hook** do Vercel.
3. O Vercel corre `npm run build`: exporta o conteúdo publicado do Supabase, descarrega as imagens, valida tudo e gera o site.
4. Cerca de 1 a 3 minutos depois, a versão nova está online.

Se a validação falhar, o deploy falha e a versão anterior continua online.
Cada push para o GitHub também gera um deploy (produção no ramo `main`, pré-visualização nos outros).

## Preparação (uma vez)

### 1. Vercel, GitHub e Supabase

- Projeto Vercel: `bernardo-azevedo-portfolio`, ligado ao repositório `Berna58/berna58.github.io`.
- **Production Branch:** `main` (Settings › Git). Pushes ao ramo `v2` geram pré-visualizações.
- A integração Supabase (Marketplace) cria as variáveis automaticamente. O build usa:
  - `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` (exportação do conteúdo; só no build, nunca no browser);
  - `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` (painel; públicas por desenho, protegidas por RLS + MFA).
- Opcional: `SITE_URL` quando houver domínio próprio (canonical, sitemap e partilhas passam a usá-lo).
- Dentro do Vercel o build **falha** se faltarem as variáveis do Supabase, para nunca publicar o seed local.

### 2. Base de dados (projeto Supabase criado pelo Vercel)

1. No Vercel: *Storage* › projeto Supabase › **Open in Supabase**. Anota o *project ref* (o identificador no endereço do dashboard).
2. No teu computador, na pasta do projeto:
   ```bash
   supabase login
   supabase link --project-ref <ref>
   supabase db push            # aplica as 5 migrações de supabase/migrations
   ```
3. **Authentication › Sign In / Providers:** desliga *Allow new users to sign up*. Mantém o fornecedor *Email* ligado (sem ele não há login).
4. **Authentication › Multi-Factor:** ativa *TOTP (App Authenticator)*.
5. **Authentication › URL Configuration:** *Site URL* = `https://bernardo-azevedo-portfolio.vercel.app`; em *Redirect URLs* acrescenta `https://bernardo-azevedo-portfolio.vercel.app/admin/`.
6. Cria a tua conta em **Authentication › Users › Add user** (email + palavra-passe forte) e regista-a como admin no **SQL Editor**:
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'o-teu-email@exemplo.com';
   ```
7. Carrega o conteúdo inicial (só numa base vazia):
   ```bash
   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<service_role> npm run seed
   ```

Só existe um projeto Supabase (produção). Os testes que criam utilizadores (`npm run test:db`, `npm run test:admin`) correm **apenas** contra o Supabase local (`supabase start`), nunca contra produção.

### 3. Botão "Publicar"

1. Vercel › Settings › Git › **Deploy Hooks**: cria um hook para o ramo `main` (nome: `painel`). Copia o endereço; é secreto.
2. Publica as Edge Functions e guarda o hook como segredo:
   ```bash
   supabase functions deploy trigger-build build-status --project-ref <ref>
   supabase secrets set VERCEL_DEPLOY_HOOK_URL=<endereço do hook> --project-ref <ref>
   ```
3. Opcional, para o painel mostrar o estado do deploy: cria um token em Vercel › Account Settings › Tokens (âmbito só da equipa do projeto, validade 1 ano) e:
   ```bash
   supabase secrets set VERCEL_TOKEN=<token> VERCEL_PROJECT_ID=<id do projeto> VERCEL_TEAM_ID=<id da equipa> --project-ref <ref>
   ```
4. Se usares outro domínio, define `ALLOWED_ORIGINS` (por exemplo `https://o-teu-dominio.pt`).

### 4. Backups semanais (GitHub Actions para repositório privado)

1. Cria o repositório privado `Berna58/portfolio-backups` (vazio, com um README).
2. Gera uma chave só para isto: `ssh-keygen -t ed25519 -C portfolio-backup -f backup_key -N ""`.
3. Em `portfolio-backups › Settings › Deploy keys`, adiciona `backup_key.pub` **com permissão de escrita**.
4. Em `berna58.github.io › Settings › Secrets and variables › Actions`, cria:

| Segredo | Onde o encontras |
|---|---|
| `SUPABASE_URL` | Supabase › Project Settings › API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase › Project Settings › API keys › `service_role` / secret |
| `SUPABASE_DB_URL` | Supabase › Connect › *Session pooler* (ou `POSTGRES_URL_NON_POOLING` no Vercel) |
| `BACKUP_DEPLOY_KEY` | conteúdo de `backup_key` (chave privada) |

5. Apaga `backup_key` e `backup_key.pub` do computador.

Nunca coloques segredos no código, em issues ou em mensagens.

### 5. Corte para o site novo (com autorização)

1. Push do ramo `v2` e verificação da pré-visualização do Vercel.
2. Merge de `v2` para `main`: deploy de produção.
3. Desligar o GitHub Pages (decidido a 2026-10-14): `berna58.github.io` › *Settings* › *Pages* › *Unpublish site*. Os links antigos e o QR do CV de 2025 deixam de funcionar; o CV novo deve apontar para o endereço do Vercel.
4. **Reversão:** no Vercel, *Deployments* › deploy anterior › *Promote to Production*; o site antigo continua na tag `v1-legacy`.

## Rotina

- **Backup:** segundas-feiras às 03:17 UTC (*Actions › Backup semanal*), ou à mão em *Run workflow*.
- **Pausa do Supabase:** o plano gratuito pausa o projeto após 1 semana sem atividade; o backup semanal conta como atividade. Se pausar, o **site público continua a funcionar** (é estático); reativa o projeto no dashboard e o painel volta.
- **Tokens:** renovar o token do Vercel antes de expirar (só afeta a indicação de estado no painel).

## Recuperar de um backup

1. Num projeto Supabase vazio, aplica as migrações (`supabase db push`).
2. Restaura os dados: `psql "<SUPABASE_DB_URL>" -f db/data.sql` (a partir do clone de `portfolio-backups`).
3. Volta a carregar os ficheiros de `media/` para o bucket `media`, mantendo os caminhos.
4. Atualiza as variáveis do Vercel para esse projeto e faz *Redeploy*.

## Desenvolvimento local

```bash
npm install
npm run dev                  # usa o seed local, sem Supabase
supabase start               # base de dados local (portas 55xxx)
supabase functions serve     # Edge Functions locais (noutra janela)
npm test                     # testes unitários
npm run test:db              # segurança da base de dados (Supabase local)
npm run build && npm run test:admin   # fluxo completo do painel (.env com os valores locais)
npx playwright test          # site: e2e + acessibilidade (depois de npm run build)
```

A máquina tem pouca memória: com o Docker ligado, fecha o `npm run dev` antes de correr os testes.
