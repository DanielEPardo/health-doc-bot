-- Growth loop de TuTelaGanas: "comparte y gana revisiones".
-- El usuario se queda sin revisiones con IA -> comparte su enlace -> el invitado completa su
-- primera revisión -> quien invitó gana 2 revisiones.
-- Solo las usa el servidor (service role). No guardan texto de tutelas ni datos de salud.

-- Una fila por cuenta de Clerk. El user_id es el "sub" del JWT verificado en el servidor.
create table if not exists cuentas (
  user_id              text primary key,
  codigo               text not null unique,          -- código del enlace de invitación (público)
  creditos             integer not null default 1 check (creditos >= 0),
  invitado_por         text references cuentas (user_id) on delete set null,
  primera_revision_en  timestamptz,                   -- cuándo completó su primera revisión con IA
  creado_en            timestamptz not null default now(),
  constraint sin_auto_referido check (invitado_por is null or invitado_por <> user_id)
);
create index if not exists cuentas_invitado_por_idx on cuentas (invitado_por);

-- Bitácora mínima para la métrica del loop: sin texto, sin resultado, sin datos personales.
create table if not exists revisiones_ia (
  id         bigint generated always as identity primary key,
  user_id    text not null references cuentas (user_id) on delete cascade,
  creado_en  timestamptz not null default now()
);
create index if not exists revisiones_ia_creado_en_idx on revisiones_ia (creado_en);
create index if not exists revisiones_ia_user_id_idx on revisiones_ia (user_id);

-- Descuenta un crédito solo si queda saldo. Atómico: dos pestañas no pueden gastar el mismo.
create or replace function consumir_credito(p_user_id text)
returns boolean language sql as $$
  with d as (
    update cuentas set creditos = creditos - 1
    where user_id = p_user_id and creditos > 0
    returning 1
  ) select exists (select 1 from d);
$$;

-- Devuelve créditos (por ejemplo si la IA no llegó a responder y se cobró de más).
create or replace function sumar_creditos(p_user_id text, p_cantidad integer)
returns void language sql as $$
  update cuentas set creditos = creditos + p_cantidad where user_id = p_user_id;
$$;

-- Marca la primera revisión y, si la persona llegó invitada, acredita 2 revisiones a quien invitó.
-- Devuelve true solo la primera vez: así el premio se entrega exactamente una vez por invitado.
create or replace function acreditar_primera_revision(p_user_id text)
returns boolean language plpgsql as $$
declare v_invitador text;
begin
  update cuentas set primera_revision_en = now()
    where user_id = p_user_id and primera_revision_en is null
  returning invitado_por into v_invitador;
  if not found then return false; end if;
  if v_invitador is not null then
    update cuentas set creditos = creditos + 2 where user_id = v_invitador;
  end if;
  return true;
end; $$;

-- Métrica del loop: invitados que completan su primera revisión por usuario activo.
-- Usuario activo = hizo al menos una revisión con IA en la ventana.
create or replace function metricas_loop(p_dias integer default 7)
returns table (referidos_activados bigint, usuarios_activos bigint, invitaciones_enviadas bigint)
language sql as $$
  select
    (select count(*) from cuentas
      where invitado_por is not null
        and primera_revision_en >= now() - make_interval(days => p_dias)),
    (select count(distinct user_id) from revisiones_ia
      where creado_en >= now() - make_interval(days => p_dias)),
    (select count(*) from cuentas
      where invitado_por is not null
        and creado_en >= now() - make_interval(days => p_dias));
$$;

alter table cuentas       enable row level security;
alter table revisiones_ia enable row level security;
