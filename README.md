# MediMind

Um app de gestão e adesão a medicamentos criado para ajudar pessoas com tratamento crônico a se organizarem e não esquecerem doses.

## Motivação

O projeto nasceu para ajudar a minha namorada, que tem lúpus, a controlar a medicação diária. Antes do app, ela anotava tudo em um caderno e acabava esquecendo doses. O objetivo é transformar essa rotina em um sistema mais confiável e acessível.

## O que o projeto faz

- Cadastro de medicamentos e dose diária
- Agenda automática de doses por frequência: diária, alternada, semanal, intervalo de horas e intervalo de dias
- Registro de adesão: dose tomada, pendente ou perdida
- Estatísticas de adesão no dia e nos últimos 30 dias
- Histórico mensal e acompanhamento de sequência de dias com 100% de adesão
- Localização de farmácias próximas via geolocalização
- Autenticação por email/senha e Google OAuth
- Armazenamento seguro dos dados do usuário no backend

## Principais funcionalidades

- `useMeds()` e `useLogs()` para exibir medicamentos e logs de aderência
- Agenda diária com doses ordenadas por horário
- Cálculo de horários para intervalos em horas e intervalos de dias
- Cache em memória + sincronização em tempo real entre dispositivos
- Políticas de segurança por usuário no backend (Row-Level Security)
- Edge Function de verificação de doses pendentes em `supabase/functions/check-doses`

## Tecnologias

- Frontend: React 19
- UI: TanStack Start, Tailwind CSS v4
- Mobile: Capacitor (Android)
- Backend: Lovable Cloud / Supabase (PostgreSQL, Auth, Realtime, Edge Functions)
- Autenticação: `@supabase/supabase-js`
- Rotas: `@tanstack/react-router`
- Estado / cache: hooks customizados em `src/lib/storage.ts`

## Estrutura do projeto

```
src/
├─ integrations/           ← clientes Supabase 
├─ lib/                    ← lógica de dados, auth e cálculos de frequência
├─ components/             ← UI e componentes de interface
└─ routes/                 ← páginas principais do app
supabase/functions/        ← função server-side para check de doses
android/                   ← configuração Android Capacitor
```

### Páginas principais

- `/` — dashboard Hoje com resumo de adesão, heatmap e agenda de doses
- `/add` — formulário de novo medicamento
- `/medications` — CRUD de medicamentos
- `/calendar` — histórico mensal
- `/farmacias` — farmácias próximas
- `/auth` — login / cadastro
- `/reset-password` — redefinição de senha

## Como rodar localmente

### Requisitos

- Node.js 20+ (ou versão compatível com o projeto)
- npm ou bun
- Android Studio / SDK se for compilar a versão Android

### Instalação

```bash
npm install
```

### Rodando em desenvolvimento

```bash
npm run dev
```

### Build de produção

```bash
npm run build
```

### Preview da build

```bash
npm run preview
```


## Observações

- A camada de dados em `src/lib/storage.ts` substitui o antigo `localStorage` e centraliza o acesso ao banco, cache e Realtime.
- O app foi pensado para manter o histórico e ajudar na adesão ao tratamento, com foco em facilidade de uso e transparência para quem controla medicamentos diariamente.


