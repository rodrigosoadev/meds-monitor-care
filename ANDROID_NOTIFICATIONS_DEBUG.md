# Debug de notificações Android — Meds Monitor Care

Guia para diagnosticar por que os **lembretes locais** não aparecem no app Android (Capacitor + `@capacitor/local-notifications`).

---

## URL remota vs bundle local (leia primeiro)

O `capacitor.config.ts` **não deve** usar `server.url` no APK de teste (o app carrega `dist/client` local).

Se ainda existir `server.url` apontando para Workers, o celular ignora o build local:

```ts
server: {
  url: 'https://tanstack-start-app.rodrigo-med-app.workers.dev',
  cleartext: true,
}
```

| O que isso faz | Implicação |
|----------------|------------|
| Com `server.url` ativo | O WebView do APK carrega o **JavaScript da internet** (Cloudflare Workers), **não** o `dist/client` copiado pelo `cap sync`. |
| `npm run build` + `cap sync` sozinhos | Atualizam o código **nativo** (plugins, permissões), mas o **JS de notificações** só muda se a URL remota tiver a versão nova. |
| **Supabase** | Auth, Postgres, Realtime — **não controla** notificações locais. **Nada a alterar no Supabase** por causa deste problema. |
| **Cloudflare** | Hospeda o frontend (TanStack Start). **Só precisa de deploy** se você quiser continuar usando `server.url` em produção. |

### O que fazer na prática

**Opção A — Testar no Android com código local (recomendado para debug)**

1. Comente ou remova o bloco `server` em `capacitor.config.ts`.
2. Rode:
   ```bash
   npm run build
   npx cap sync android
   ```
3. No Android Studio: **Run** no dispositivo (reinstale o app).
4. O APK passa a usar o bundle em `dist/client` com as alterações de `src/lib/notifications.ts`.

**Opção B — Manter `server.url` (app sempre “online”)**

1. Faça deploy do frontend para o mesmo host do Workers (veja [Deploy Cloudflare](#deploy-cloudflare)).
2. Confirme no celular que a URL abre a versão nova (cache do WebView: force-stop no app ou reinstale).
3. **Supabase:** sem mudança. Variáveis do cliente (`VITE_*` / URL do Supabase) continuam no build que você publica no Cloudflare.

**Opção C — Produção híbrida**

- Release na loja: comente `server.url`, use bundle embarcado (mais estável offline).
- Ou mantenha `server.url` e automatize deploy no Cloudflare a cada release.

---

## Deploy Cloudflare

O projeto usa TanStack Start com target Cloudflare (`vite.config.ts` → `target: "cloudflare"`).

Após alterar o código web:

```bash
npm run build
npx wrangler deploy
```

Requisitos: conta Cloudflare, `wrangler` autenticado (`npx wrangler login`), projeto `tanstack-start-app` conforme `wrangler.jsonc`.

Se você publica pelo **Lovable** ou outro CI, use o mesmo pipeline que já envia para `*.workers.dev` — o importante é que o **deploy inclua** os commits com `notifications.ts` e `main.tsx`.

**Não é necessário** criar função nova no Supabase para notificações. A Edge Function `check-doses` ainda **não envia push** (apenas contagem no servidor).

---

## Fluxo de build → Android Studio (VS Code)

```bash
npm run build
npx cap sync android
```

No Android Studio: abra a pasta **`android/`** → Sync Gradle → Run no dispositivo.

O `npm run build` **não** substitui o `cap sync`. O Android Studio lê o projeto em `android/` após o sync.

---

## Prompt para o assistente do Android Studio

Cole o bloco abaixo no Gemini / assistente do Android Studio com o projeto `android/` aberto e o app instalado no dispositivo.

```
CONTEXTO DO PROJETO
App: Meds Monitor Care (Capacitor 8 + WebView)
applicationId / package: com.medsmonitor.app
targetSdk: 36, minSdk: 24
Plugin: @capacitor/local-notifications ^8.2.0
Pasta nativa: android/ (abrir este projeto no Android Studio)

O app agenda LEMBRETES LOCAIS (não FCM/push) via JavaScript:
- ../src/lib/notifications.ts — canal "medication-reminders", agenda até 30 dias, allowWhileIdle: true
- ../src/main.tsx — initNotificationPermissions() + listener "Marcar como Tomado"
- ../src/lib/storage.ts — rescheduleAllNotifications() após login, CRUD de meds e ao voltar ao app

PROBLEMA
Notificações de medicamento NÃO aparecem no dispositivo/emulador, mesmo com permissão aparentemente concedida.

CONFIGURAÇÃO SUSPEITA (Capacitor)
../capacitor.config.ts pode ter:
  server.url = "https://tanstack-start-app.rodrigo-med-app.workers.dev"
Nesse caso o WebView carrega JS remoto, não dist/client local.
Verificar se o código em execução inclui as correções de permissão/reagendamento.

AndroidManifest.xml (android/app/src/main/AndroidManifest.xml) declara:
- INTERNET
- POST_NOTIFICATIONS

Verificar no Merged Manifest se o plugin adicionou:
- RECEIVE_BOOT_COMPLETED, WAKE_LOCK
- Receivers: TimedNotificationPublisher, NotificationDismissReceiver, LocalNotificationRestoreReceiver
- SCHEDULE_EXACT_ALARM / USE_EXACT_ALARM (API 31+ com alarmes exatos)

TAREFA — DIAGNÓSTICO COMPLETO
1) MERGED MANIFEST — receivers e permissões do Local Notifications
2) PERMISSÕES — Notifications ON, canal "Lembretes de Medicamentos", alarmes exatos se API 31+
3) LOGCAT — package:com.medsmonitor.app, tags [Notifications], Capacitor, AlarmManager, SecurityException
4) TESTE — med ativo, horário 2–3 min à frente, minimizar app, dumpsys alarm
5) BATERIA / OEM — otimização desligada, autostart
6) server.url — JS desatualizado na Workers?
7) CORREÇÕES — XML/Gradle concretos
8) CONCLUSÃO — "A causa é X; faça Y."
```

---

## Filtros Logcat úteis

| Filtro | Uso |
|--------|-----|
| `package:com.medsmonitor.app` | Só o app |
| `[Notifications]` | Logs do nosso código (WebView console) |
| `Capacitor` | Bridge nativo |
| `AlarmManager` | Falha de alarme exato / permissão |

Mensagens esperadas após cadastrar remédio com horário futuro:

- `[Notifications] Scheduled N alerts for <nome>`

Se não aparecer: permissão negada, horário já passou hoje, medicamento não `active`, ou JS remoto desatualizado.

---

## Permissões Android (correção aplicada no projeto)

`AndroidManifest.xml` deve incluir:

- `POST_NOTIFICATIONS`
- `SCHEDULE_EXACT_ALARM` e `USE_EXACT_ALARM`
- `RECEIVE_BOOT_COMPLETED`, `WAKE_LOCK`

Ícone de status: `res/drawable/ic_stat_notification.xml` + `plugins.LocalNotifications.smallIcon` no `capacitor.config.ts`.

No app, ao conceder notificações, o sistema pode pedir também **Alarmes e lembretes** (alarmes exatos).

---

## Agendamento de produção

| Frequência | Comportamento |
|------------|----------------|
| `daily` contínuo | `schedule.at` = próximo horário real (ex. 22:00) + `every: 'day'` |
| `weekly` contínuo | `schedule.on` = weekday + hour + minute por dia marcado |
| Tratamento finito / alternado / intervalos | Até 60 dias de alarmes com `at` em cada data válida |

IDs estáveis salvos em `medications.notification_ids` (Supabase). Ao editar/pausar, `LocalNotifications.cancel({ id })` usa essa lista.

Permissão na abertura: `NotificationPermissionBootstrap` em `src/routes/__root.tsx`.

---

## Checklist rápido

- [ ] `server.url` **removido** do `capacitor.config.ts` (ou deploy feito no Cloudflare)
- [ ] `npm run build` && `npx cap sync android`
- [ ] Reinstalou o APK no dispositivo
- [ ] Notificações permitidas para `com.medsmonitor.app` (Android 13+)
- [ ] Medicamento **ativo** com horário **no futuro** (hoje ou próximo dia válido)
- [ ] Canal **Lembretes de Medicamentos** não silenciado
- [ ] Logcat mostra `Scheduled N alerts`

---

## Referências no repositório

| Ficheiro | Função |
|----------|--------|
| `src/lib/notifications.ts` | Agendamento, permissões, canal |
| `src/main.tsx` | Init + ação "Marcar como Tomado" |
| `src/lib/storage.ts` | Reagenda após load/CRUD/app ativo |
| `capacitor.config.ts` | `webDir`, `server.url` |
| `android/app/src/main/AndroidManifest.xml` | Permissões base |
| `wrangler.jsonc` | Nome do Worker Cloudflare |
