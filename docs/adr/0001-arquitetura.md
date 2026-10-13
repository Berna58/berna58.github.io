# 0001 · Arquitetura: site estático + painel próprio + Supabase

- Estado: aceite (2026-10-13)

## Contexto

O portefólio tem de ser gerido sem mexer no código (criar, editar, ordenar, publicar e despublicar
projetos), custar 0 EUR por mês e continuar no GitHub Pages. Publicar pode demorar 1 a 3 minutos.

## Decisão

- **Site público:** Astro em modo estático, alojado no GitHub Pages.
- **Conteúdo:** Postgres, Auth e Storage do Supabase (plano gratuito).
- **Painel:** aplicação React em `/admin`, que fala diretamente com o Supabase.
- **Publicação:** o painel pede a uma Edge Function que dispare o workflow de deploy no GitHub
  Actions. O build chama `export_published_content()` (SQL), descarrega as imagens, valida tudo
  com Zod e gera o site.
- **Entre o Supabase e o Astro** há um passo intermédio (`scripts/sync-content.mjs`) que escreve
  `src/generated/`. O Astro nunca fala com o Supabase.

## Consequências

- O site público não depende do Supabase quando alguém o visita: se o projeto gratuito for
  pausado por inatividade, só o painel e a publicação param.
- Sem credenciais, o build usa o seed local. O CI corre sem segredos e o projeto pode mudar
  para conteúdo em ficheiros (CMS em Git) sem refazer o site.
- As regras de publicação existem em três sítios (painel, base de dados, build). É redundância
  intencional: o painel dá feedback, a base de dados garante, o build protege o site.
- Mais código para manter do que um CMS pronto. Aceite porque o repositório público é também
  uma prova de trabalho full-stack.
