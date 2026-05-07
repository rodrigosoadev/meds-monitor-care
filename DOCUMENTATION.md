# MediMind — Documentação Técnica

App de gestão e adesão a medicamentos para utilizadores crónicos. Frontend em
**React 19 + TanStack Start + Tailwind v4**. Backend gerido via **Lovable Cloud**
(PostgreSQL + Auth + Realtime + Edge Functions, baseado em Supabase).

---

## 1. Arquitetura

```
┌──────────────────────────┐         ┌──────────────────────────────┐
│     React (TanStack)     │  HTTPS  │       Lovable Cloud          │
│                          │ ◄─────► │                              │
│  src/lib/storage.ts      │         │  Auth · Postgres · Realtime  │
│  src/lib/auth.tsx        │         │  Edge Functions              │
│  src/components/...      │         │                              │
└──────────────────────────┘         └──────────────────────────────┘
```

A camada de dados (`src/lib/storage.ts`) substitui completamente o
`localStorage` anterior. Mantém a API de hooks (`useMeds`, `useLogs`,
`markDose`, etc.) para que os componentes não precisem mudar — mas por baixo
faz queries ao Postgres, escuta Realtime e mantém um cache em memória.

---

## 2. Diagrama Entidade-Relacionamento (ERD)

```
┌─────────────────┐       ┌────────────────────────┐       ┌──────────────────────┐
│   auth.users    │       │       profiles         │       │      medications     │
│─────────────────│       │────────────────────────│       │──────────────────────│
│ id  (PK)        │──1:1──│ id (PK, FK→users.id)  │       │ id (PK)              │
│ email           │       │ email                  │       │ user_id (FK→users)   │
│ ...             │       │ full_name              │       │ name, dosage, icon   │
└────────┬────────┘       │ avatar_url             │       │ frequency (enum)     │
         │                │ created_at, updated_at │       │ weekdays smallint[]  │
         │ 1:N            └────────────────────────┘       │ interval_hours       │
         │                                                 │ interval_days        │
         │                                                 │ start_time, times[]  │
         │                                                 │ start_date           │
         │                                                 │ duration_days        │
         │                                                 │ stock                │
         │                                                 │ low_stock_threshold  │
         │                                                 │ status (enum)        │
         │                                                 │ created_at, updated  │
         │                                                 └──────────┬───────────┘
         │                                                            │ 1:N
         │                                                            ▼
         │                                                 ┌──────────────────────┐
         └─────────────── 1:N ─────────────────────────────│   adherence_logs     │
                                                          │──────────────────────│
                                                          │ id (PK)              │
                                                          │ medication_id (FK)   │
                                                          │ user_id (FK→users)   │
                                                          │ scheduled_date       │
                                                          │ scheduled_time       │
                                                          │ taken_at timestamptz │
                                                          │ status (enum)        │
                                                          │ UNIQUE(med, date,    │
                                                          │        time)         │
                                                          └──────────────────────┘
```

### Enums Postgres

| Enum             | Valores                                                              |
|------------------|----------------------------------------------------------------------|
| `med_frequency`  | `daily`, `alternate`, `weekly`, `interval_hours`, `interval_days`    |
| `med_icon`       | `pill`, `syrup`, `injection`, `capsule`, `drop`                      |
| `med_status`     | `active`, `paused`, `archived`                                       |
| `dose_status`    | `taken`, `missed`, `pending`, `delayed`                              |

### Triggers e Funções

- **`handle_new_user`** (`AFTER INSERT ON auth.users`): cria automaticamente um
  registo em `profiles` ao registar um novo utilizador, copiando `email`,
  `full_name` e `avatar_url` do `raw_user_meta_data`. `SECURITY DEFINER` com
  `EXECUTE` revogado de `anon`/`authenticated`.
- **`set_updated_at`**: trigger `BEFORE UPDATE` em `profiles`, `medications` e
  `adherence_logs` para manter `updated_at = now()`.

### Realtime

`medications` e `adherence_logs` estão na publicação `supabase_realtime` com
`REPLICA IDENTITY FULL`, o que permite ao cliente subscrever `INSERT/UPDATE/
DELETE` por `user_id` (ver `setupRealtime` em `src/lib/storage.ts`).

---

## 3. Políticas de Row-Level Security (RLS)

Todas as tabelas têm RLS **ativada**. As policies seguem o mesmo princípio
em todas elas: o utilizador autenticado só pode ler ou escrever as **suas
próprias** linhas.

| Tabela            | SELECT                  | INSERT                  | UPDATE                  | DELETE                  |
|-------------------|-------------------------|-------------------------|-------------------------|-------------------------|
| `profiles`        | `auth.uid() = id`       | `auth.uid() = id`       | `auth.uid() = id`       | —                       |
| `medications`     | `auth.uid() = user_id`  | `auth.uid() = user_id`  | `auth.uid() = user_id`  | `auth.uid() = user_id`  |
| `adherence_logs`  | `auth.uid() = user_id`  | `auth.uid() = user_id`  | `auth.uid() = user_id`  | `auth.uid() = user_id`  |

**Garantias:**
- Um utilizador A nunca consegue ler, alterar ou apagar registos do utilizador B
  — mesmo conhecendo o `id` da linha — porque a RLS aplica-se a todas as queries
  via `anon`/`authenticated`.
- A `service_role` (usada apenas em Edge Functions confiáveis) **bypassa** as
  RLS — por isso nunca deve ser exposta ao cliente.
- `ON DELETE CASCADE` em `medications.user_id` e `adherence_logs.user_id` /
  `medication_id` garante limpeza automática quando o utilizador ou o
  medicamento é removido.

---

## 4. Autenticação

Implementada com `@supabase/supabase-js` em `src/lib/auth.tsx` (`AuthProvider`,
`useAuth`).

Métodos suportados:
- **Email + Senha** — `signInWithPassword` / `signUp`.
- **Google OAuth** — através do helper gerido `lovable.auth.signInWithOAuth`.
- **Recuperação de senha** — `resetPasswordForEmail` envia um link que abre a
  página `/reset-password`, que chama `supabase.auth.updateUser({ password })`.

Fluxo de proteção de rotas: o `AuthGate` em `src/routes/__root.tsx` redireciona
qualquer rota não-pública para `/auth` quando `user === null`. Rotas públicas:
`/auth`, `/reset-password`.

O `AuthProvider` regista `onAuthStateChange` **antes** de chamar `getSession()`
para evitar perder eventos durante o restore inicial da sessão.

---

## 5. Variáveis de Ambiente

O projeto Lovable Cloud popula automaticamente o ficheiro `.env`:

| Variável                       | Onde é usada                          |
|--------------------------------|---------------------------------------|
| `VITE_SUPABASE_URL`            | Cliente browser (`@/integrations/supabase/client`) |
| `VITE_SUPABASE_ANON_KEY`| Cliente browser                       |
| `VITE_SUPABASE_PROJECT_ID`     | Referência interna                    |

Em **Edge Functions** (server-side):

| Variável                       | Notas                                  |
|--------------------------------|----------------------------------------|
| `SUPABASE_URL`                 | Auto-injectada pelo runtime            |
| `SUPABASE_ANON_KEY`            | Auto-injectada                         |
| `SUPABASE_SERVICE_ROLE_KEY`    | Auto-injectada — **nunca** expor ao cliente |

> O ficheiro `.env` é gerido automaticamente pelo Lovable Cloud — **não editar
> manualmente**. Para projetos auto-hospedados em Supabase, basta criar um
> `.env.local` com as três variáveis `VITE_*` apontando para o projeto Supabase.

---

## 6. Cálculo de Datas e Horários

Implementado em `isMedScheduledOn()` e `computeDailyTimes()` (em
`src/lib/storage.ts`). Funções **puras**, sem efeitos colaterais.

### `isMedScheduledOn(med, date)` — o medicamento está agendado nesta data?

```text
1. Se status ≠ "active" → false
2. Se date < start_date → false
3. Se duration_days definido e date > start + duration → false
4. Por tipo de frequência:
   - daily / interval_hours       → true (todos os dias)
   - alternate                    → diff_dias % 2 === 0
   - interval_days (a cada N)     → diff_dias % N === 0
   - weekly                       → date.getDay() ∈ weekdays
```

**Exemplo "a cada 2 dias":** `start_date = 2026-05-01`, `intervalDays = 2`.
Doses agendadas para 1, 3, 5, 7, 9 de maio… (`(date - start) / 86400000 % 2`
deve dar `0`).

### `computeDailyTimes(med)` — horários do dia

- Para `interval_hours` (ex: a cada 8h a partir das 08:00) gera dinamicamente
  `[08:00, 16:00, 00:00]` percorrendo a janela de 24h sem duplicar.
- Para os outros tipos, devolve a lista explícita `med.times` ordenada.

### `getScheduledDosesForDate(meds, logs, date)`

Combina os dois acima, faz match com `adherence_logs` pelo composto
`(medication_id, scheduled_date, scheduled_time)` e devolve a agenda do dia
ordenada por hora — incluindo o `status` atual de cada dose.

---

## 7. Camada de Dados e Sincronização

`src/lib/storage.ts` mantém um **cache em memória por utilizador** (`cachedMeds`,
`cachedLogs`). Os hooks `useMeds()` / `useLogs()`:

1. Ao primeiro `mount` para um utilizador, fazem `loadAll(userId)` (dois
   `select *` paralelos) e abrem um canal Realtime.
2. O canal `medimind:<userId>` escuta `postgres_changes` filtrados por
   `user_id`, e atualiza o cache + notifica os subscribers — qualquer alteração
   feita noutro dispositivo aparece instantaneamente em todas as janelas
   abertas.
3. No `signOut`, o cache é limpo e o canal removido.

Mutações (`addMed`, `updateMed`, `deleteMed`, `markDose`, `adjustStock`)
escrevem diretamente em Postgres. O Realtime devolve o estado atualizado, por
isso não é preciso refetch manual.

`markDose` faz `upsert` em `adherence_logs` usando o constraint composto
`UNIQUE (medication_id, scheduled_date, scheduled_time)`, e ajusta o stock
**apenas quando** o status passa de/para `taken`.

---

## 8. Edge Function `check-doses`

`supabase/functions/check-doses/index.ts` é o esqueleto para verificação
periódica de doses. Hoje conta as doses pendentes do dia; pode ser ligada a um
cron `pg_cron` no futuro para enviar emails/push.

Invocar manualmente:
```bash
curl -X POST "$SUPABASE_URL/functions/v1/check-doses" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY"
```

Para agendar (exemplo a cada hora) via SQL:
```sql
select cron.schedule(
  'medimind-check-doses-hourly',
  '0 * * * *',
  $$ select net.http_post(
       url := '<SUPABASE_URL>/functions/v1/check-doses',
       headers := '{"Authorization": "Bearer <ANON_KEY>"}'::jsonb
     ); $$
);
```

---

## 9. UX de Carregamento e Erros

- **Skeletons**: a página `/` mostra `Skeleton` enquanto `useStoreLoading()`
  for `true` (primeiro fetch).
- **AuthGate** mostra um spinner full-screen enquanto a sessão é restaurada.
- **Error boundary global** em `src/router.tsx` (`DefaultErrorComponent`)
  captura erros não tratados e oferece "Tentar novamente".
- **Toasts** (`sonner`) reportam todos os erros de rede/RLS ao utilizador.

---

## 10. Estrutura de Ficheiros (resumo)

```
src/
├─ integrations/
│  ├─ supabase/client.ts          ← cliente browser (auto-gerado)
│  └─ lovable/index.ts            ← helper Google OAuth (auto-gerado)
├─ lib/
│  ├─ auth.tsx                    ← AuthProvider, useAuth
│  ├─ storage.ts                  ← camada de dados + Realtime + cache
│  └─ freq.ts                     ← descrição humana de frequência
├─ components/                    ← UI (DoseList, HealthHeatmap, MedForm…)
└─ routes/
   ├─ __root.tsx                  ← AuthGate + providers
   ├─ auth.tsx                    ← signin / signup / forgot
   ├─ reset-password.tsx          ← updateUser({ password })
   ├─ index.tsx                   ← dashboard "Hoje"
   ├─ medications.tsx             ← CRUD de medicamentos
   ├─ add.tsx                     ← novo medicamento
   └─ calendar.tsx                ← histórico mensal

supabase/functions/check-doses/   ← edge function (stub de notificações)
```
