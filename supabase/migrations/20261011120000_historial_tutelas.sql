-- Historial de tutelas por cuenta, autorizaciones de la web y preguntas de documentos del bot.
-- Solo las usa el servidor (service role). RLS activo y sin políticas: el navegador no tiene acceso.

-- 1) Historial. El contenido (título, texto, respuestas y resultado) va CIFRADO con AES-GCM en el
--    servidor (secreto HISTORIAL_CLAVE). En claro solo quedan el estado y las fechas.
create table if not exists tutelas (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    text not null,                 -- id de usuario de Clerk (sub del token)
  estado        text not null check (estado in ('borrador','revisada','presentada')),
  contenido     text not null,                 -- "v1.<iv>.<datos>" (ver src/lib/historial/cifrado.server.ts)
  creado        timestamptz not null default now(),
  actualizado   timestamptz not null default now()
);
create index if not exists tutelas_usuario_idx on tutelas (usuario_id, actualizado desc);

-- 2) Prueba de las autorizaciones de la web (Ley 1581 art. 6 lit. a y art. 9): texto exacto aceptado.
--    alcance: 'terminos' (términos y política de datos), 'historial' (guardar tutelas) o
--    'documentos' (leer documentos con IA).
--    Se conservan aunque la persona borre su historial (Ley 1581 art. 17 lit. b).
create table if not exists consentimientos_web (
  id                  bigint generated always as identity primary key,
  usuario_id          text not null,
  alcance             text not null check (alcance in ('historial','documentos','terminos')),
  version             text not null,
  texto_autorizacion  text not null,
  aceptado_en         timestamptz not null default now(),
  revocado_en         timestamptz                -- la persona retiró la autorización (se conserva la prueba)
);
create index if not exists consentimientos_web_usuario_idx on consentimientos_web (usuario_id, alcance, version);

alter table tutelas            enable row level security;
alter table consentimientos_web enable row level security;

-- 3) Bot de WhatsApp: respuestas sobre documentos (no los documentos) y nuevos estados de la conversación.
alter table conversaciones add column if not exists documentos jsonb;
alter table conversaciones drop constraint if exists conversaciones_estado_check;
alter table conversaciones add constraint conversaciones_estado_check
  check (estado in ('nuevo','esperando_consentimiento','pregunta_orden','pregunta_eps','recibiendo','revisado'));
