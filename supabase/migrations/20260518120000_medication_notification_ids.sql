-- IDs das notificações locais agendadas (para cancelar ao editar/pausar remédio)
alter table public.medications
  add column if not exists notification_ids integer[] not null default '{}';
