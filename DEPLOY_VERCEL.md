# Deploy do MediMind no Vercel

Este projeto é **TanStack Start** (SSR + server functions), não um Vite SPA. Por padrão o template gera bundle para Cloudflare Workers. Para rodar no Vercel, ajustamos o adapter e configuramos as variáveis de ambiente.

## 1. Mudanças já aplicadas no repositório

- `vite.config.ts`: desabilitado o plugin Cloudflare e definido `target: "vercel"` no preset do TanStack Start. Isso faz o `vite build` gerar a estrutura `.vercel/output/` (Build Output API), que o Vercel detecta automaticamente.
- `vercel.json`: simplificado para apenas declarar `buildCommand` e `framework: null` (deixa o Build Output API gerado pelo TanStack assumir o roteamento). O rewrite SPA antigo foi removido — ele quebrava SSR e server functions.

> Se em algum momento você quiser voltar para Cloudflare Workers, basta remover essas duas opções do `vite.config.ts`.

## 2. Variáveis de ambiente no Vercel

Em **Project Settings → Environment Variables**, adicione (Production + Preview + Development):

### Cliente (build-time, prefixo `VITE_`)
| Nome | Valor |
|---|---|
| `VITE_SUPABASE_URL` | `https://csxfglqxzwwiatrcilgr.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | (Anon/Publishable key — disponível no painel Supabase → Project Settings → API) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | mesma anon key |
| `VITE_SUPABASE_PROJECT_ID` | `csxfglqxzwwiatrcilgr` |

### Servidor (runtime, sem prefixo)
| Nome | Valor |
|---|---|
| `SUPABASE_URL` | mesmo do `VITE_SUPABASE_URL` |
| `SUPABASE_PUBLISHABLE_KEY` | mesma anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | apenas se você usar o `supabaseAdmin` (não é o caso atual) |

> A anon key é pública por design — pode ficar em variável `VITE_*`. **Service role key nunca**.

## 3. Reconfigurar Auth no Supabase para o domínio do Vercel

No dashboard Supabase → **Authentication → URL Configuration**:

- **Site URL**: `https://seu-projeto.vercel.app`
- **Redirect URLs** (adicione todas):
  - `https://seu-projeto.vercel.app/**`
  - `http://localhost:8080/**` (desenvolvimento)

Se estiver usando login Google, atualize também o **Authorized redirect URI** no Google Cloud Console para incluir o callback do Supabase (já configurado pelo Lovable Cloud — só precisa garantir que o domínio do Vercel está na lista de redirect URLs do Supabase acima).

## 4. Deploy

```bash
# Local (opcional, para validar)
bun install
bun run build
# Deve gerar a pasta .vercel/output/

# No Vercel
# Conecte o repo Git e faça deploy. O Vercel detecta .vercel/output/ automaticamente.
```

## 5. Pontos de atenção

- **Edge Function `check-doses`** continua hospedada no Supabase, não no Vercel. Nenhuma mudança necessária.
- **Realtime** funciona normalmente — vai direto do navegador para o Supabase.
- Se o build falhar por incompatibilidade de versão entre `@tanstack/react-start` e o preset Vercel, fixe versões compatíveis (ex.: `@tanstack/react-start@^1.167.14` já tem suporte ao preset `vercel`).
