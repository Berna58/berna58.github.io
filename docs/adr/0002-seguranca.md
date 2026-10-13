# 0002 · Segurança do conteúdo e do painel

- Estado: aceite (2026-10-13)

## Decisão

- **Uma só conta**, criada à mão. O registo público está desligado.
- **MFA (TOTP) obrigatório para ler ou escrever conteúdo.** A função `is_admin()` exige que o
  utilizador esteja na tabela `admins` **e** que o token tenha `aal = aal2` (sessão confirmada com
  o segundo fator).
- **RLS em todas as tabelas.** O papel `anon` (visitantes) não tem acesso a nada: o site público
  é estático e não consulta a base de dados.
- **Grants explícitos** em vez dos de omissão, porque a Data API do Supabase deixou de os dar
  automaticamente a projetos novos.
- **Bucket `media` privado.** O build descarrega com a chave de serviço; o painel usa URLs assinadas.
- **Segredos** (`SUPABASE_SERVICE_ROLE_KEY`, token do GitHub) só nos segredos do GitHub Actions
  e da Edge Function. A chave `anon` pode ser pública: sem RLS que o permita, não dá acesso a nada.
- **Backups** semanais num repositório privado: num repositório público, os artefactos dos
  workflows podem ser descarregados por qualquer pessoa, e o export inclui rascunhos.

## Como verificar

- Sem sessão: qualquer `select` às tabelas devolve erro de permissão.
- Com sessão sem MFA (`aal1`): os `select` devolvem zero linhas e as escritas são recusadas.
- Com MFA (`aal2`): leitura e escrita funcionam.
- Publicar um projeto incompleto devolve `check_violation` com a lista do que falta.
