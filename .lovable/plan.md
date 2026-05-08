
# Deploy do MediMind no Vercel

## Diagnóstico do erro atual

O projeto **não é um Vite SPA tradicional** — é **TanStack Start** configurado para rodar em **Cloudflare Workers** (via `@lovable.dev/vite-tanstack-config` + `wrangler.jsonc`). Por isso falha no Vercel:

1. **Build target errado**: o plugin Vite gera bundle Worker (Cloudflare), não output Node/Vercel. O Vercel não sabe servir o handler resultante.
2. **`vercel.json` quebrado para SSR**: o arquivo atual reescreve `/(.*)` → `/`, o que destrói rotas reais, server functions (`createServerFn`) e o handler SSR. Só serviria para SPA estático.
3. **Variáveis de ambiente ausentes**: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (e as versões server `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) não estão configuradas no Vercel — o build falha logo no primeiro acesso ao cliente Supabase.
4. **OAuth do Google + redirect de auth**: hoje aponta para o domínio `.lovable.app`. Em outro domínio, login Google e reset de senha quebram até reconfigurar URLs no Supabase.

## Estratégia

Trocar o adapter de Cloudflare para Node/Vercel no Vite, remover o `vercel.json` que conflita, e configurar todas as env vars (build-time + runtime) no painel do Vercel. O código da aplicação em si não muda — apenas a camada de empacotamento e deploy.

## Passos

### 1. Trocar o adapter de build
- Em `vite.config.ts`, sobrescrever o target do `@lovable.dev/vite-tanstack-config` para usar o preset **Node** do TanStack Start (em vez do `cloudflare`), que é compatível com Vercel Functions.
- Alternativa, se o preset Node der atrito: usar o adapter oficial **`@tanstack/react-start/vercel`** (preset `vercel`), que gera a estrutura `.vercel/output/` esperada pelo Build Output API do Vercel.

### 2. Limpar config de hospedagem
- **Remover `vercel.json`** atual (rewrite SPA quebra SSR). O preset Vercel gera o roteamento correto sozinho.
- Manter `wrangler.jsonc` opcionalmente, mas ele não será usado no Vercel.
- Ajustar `package.json` se precisar de script `build` específico para o preset Vercel.

### 3. Configurar Environment Variables no Vercel
No painel **Project Settings → Environment Variables**, adicionar para os 3 ambientes (Production / Preview / Development):

**Cliente (build-time, prefixo VITE_):**
- `VITE_SUPABASE_URL` = `https://csxfglqxzwwiatrcilgr.supabase.co`
- `VITE_SUPABASE_ANON_KEY` = (anon key do projeto)
- `VITE_SUPABASE_PUBLISHABLE_KEY` = (mesma anon key)
- `VITE_SUPABASE_PROJECT_ID` = `csxfglqxzwwiatrcilgr`

**Servidor (runtime, sem prefixo):**
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (apenas se usar `supabaseAdmin`)

### 4. Reconfigurar Auth no Supabase para o novo domínio
No dashboard Supabase (Authentication → URL Configuration):
- Adicionar a URL do Vercel (`https://seu-projeto.vercel.app`) em **Site URL** e **Redirect URLs**.
- Atualizar o callback do **Google OAuth** para incluir o novo domínio.
- Ajustar template de e-mail de reset de senha se houver URL hardcoded.

### 5. Edge Function `check-doses`
Continua hospedada no Supabase (não no Vercel) — nenhuma mudança necessária. A invocação por HTTP segue funcionando de qualquer domínio.

### 6. Validação
- Rodar `bun run build` localmente após a troca de adapter para confirmar que o output é Node/Vercel e não Worker.
- Fazer deploy no Vercel.
- Testar: home (`/`), login email/senha, login Google, criação de medicamento, marcação de dose, refresh em rota interna (`/medications`) — todos devem funcionar sem 404/500.

## Detalhes técnicos

- **Por que não SPA puro?** A app usa `createServerFn` com `requireSupabaseAuth` e roteamento file-based do TanStack Router com `loader`. Converter para SPA exigiria reescrever a camada de dados — não é o que você pediu.
- **Cloudflare vs Vercel preset**: ambos são adapters do `@tanstack/react-start`. A diferença é o formato de saída (Worker bundle vs `.vercel/output/`). O código de aplicação é idêntico.
- **Risco**: o template Lovable é otimizado para Cloudflare; o adapter Vercel é suportado oficialmente pelo TanStack mas pode exigir pequenos ajustes de versão de dependências. Se houver incompatibilidade, o fallback é fixar versões do `@tanstack/react-start` e `vinxi`/Vite.

## Recomendação alternativa

Se o objetivo principal é **independência de hospedagem**, **Cloudflare Workers** é o caminho de menor atrito (o projeto já está configurado, só rodar `wrangler deploy` com sua conta) e tem free tier generoso. Vercel é viável mas exige a refatoração acima.
