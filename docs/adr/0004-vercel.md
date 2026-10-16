# 0004 · Alojamento no Vercel em vez do GitHub Pages

- Estado: aceite (2026-10-13). Substitui a parte de alojamento e publicação da ADR 0001.

## Contexto

O projeto Supabase foi criado pelo Marketplace do Vercel e o projeto Vercel ficou ligado ao repositório.
Manter o GitHub Pages obrigaria a duplicar a configuração (variáveis, deploy, token do GitHub).

## Decisão

- O site estático é servido pelo **Vercel** (`*.vercel.app` por agora; domínio próprio mais tarde com `SITE_URL`).
- **Deploy:** automático a cada push (`main` = produção, outros ramos = pré-visualização).
- **Publicação automática** (2026-10-16, substitui o botão Publicar): um job `pg_cron` na base de dados deteta que o
  conteúdo publicado mudou e chama o **Deploy Hook** do Vercel com o `pg_net` (endereço guardado no Vault). Não depende
  do browser do painel, ignora rascunhos e agrupa gravações seguidas num só deploy. Deixa de ser preciso um token do
  GitHub com permissão de escrita. O estado do deploy é opcional (token do Vercel só de leitura no painel).
- **Variáveis:** as criadas pela integração Supabase (`SUPABASE_*`, `NEXT_PUBLIC_SUPABASE_*`). Dentro do Vercel o build
  falha se faltarem, para nunca publicar o seed local.
- **Um só projeto Supabase.** O ambiente de testes é o Supabase local em Docker; testes que criam utilizadores nunca
  correm contra produção.
- **Cabeçalhos de segurança** em `vercel.json` (nosniff, HSTS, Referrer-Policy, Permissions-Policy; `/admin/` sem cache,
  sem indexação e sem iframes).
- CI e backup continuam no GitHub Actions.

## Consequências

- O endereço muda; `berna58.github.io` deixa de ser o endereço principal (canonical, sitemap e partilhas usam o novo).
- O plano Hobby do Vercel é para uso pessoal e não comercial — adequado a um portefólio.
- Reverter um deploy é imediato (*Promote to Production* de um deploy anterior).
