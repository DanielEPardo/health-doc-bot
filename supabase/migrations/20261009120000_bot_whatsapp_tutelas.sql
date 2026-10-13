-- Bot de WhatsApp de TuTelaGanas — tablas en Lovable Cloud (Supabase). Solo las usa el servidor (service role).
-- Principio: NO se guarda el texto de la tutela una vez revisada (minimización, Ley 1581 de 2012).

create table if not exists conversaciones (
  telefono      text primary key,              -- número WhatsApp en formato internacional, ej. 573001234567
  estado        text not null check (estado in ('nuevo','esperando_consentimiento','recibiendo','revisado')),
  buffer        text not null default '',      -- texto en tránsito; se vacía al revisar
  actualizado   timestamptz not null default now()
);

-- Prueba de la autorización expresa para datos sensibles (Ley 1581 art. 6 lit. a; Decreto 1377/2013 compilado en Decreto 1074/2015).
create table if not exists consentimientos (
  id                  bigint generated always as identity primary key,
  telefono            text not null,
  texto_autorizacion  text not null,           -- versión exacta del texto que aceptó
  aceptado_en         timestamptz not null default now()
);

create table if not exists revisiones (
  id            bigint generated always as identity primary key,
  telefono      text not null,
  resumen       jsonb not null,                -- { version, fecha, dictamen, puntaje, origenExtraccion, reglas:[{id,estado}] }
  creado_en     timestamptz not null default now()
);
create index if not exists revisiones_telefono_idx on revisiones (telefono);

-- Idempotencia de webhooks (Meta reintenta).
create table if not exists mensajes_procesados (
  id_mensaje    text primary key,
  recibido_en   timestamptz not null default now()
);

-- Higiene: borrar textos abandonados y ids viejos (ejecutar a diario con pg_cron o un cron externo).
-- update conversaciones set buffer = '' where buffer <> '' and actualizado < now() - interval '24 hours';
-- delete from mensajes_procesados where recibido_en < now() - interval '7 days';

-- Si se usa Supabase: activar RLS y NO exponer estas tablas al cliente (solo service role desde el servidor).
alter table conversaciones      enable row level security;
alter table consentimientos     enable row level security;
alter table revisiones          enable row level security;
alter table mensajes_procesados enable row level security;
