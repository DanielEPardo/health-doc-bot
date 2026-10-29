-- Contadores agregados de revisiones. No contienen contenido ni identificadores personales.
alter table conversaciones
  add column if not exists modalidad text check (modalidad in ('texto', 'pdf'));

create table if not exists metricas_revisiones (
  fecha          date not null default current_date,
  canal          text not null check (canal in ('web', 'whatsapp')),
  modalidad      text not null check (modalidad in ('texto', 'pdf')),
  cantidad       bigint not null default 0 check (cantidad >= 0),
  actualizado_en timestamptz not null default now(),
  primary key (fecha, canal, modalidad)
);

alter table metricas_revisiones enable row level security;

-- El servidor usa la clave service role. El navegador no puede leer ni modificar métricas.
create or replace function incrementar_metrica_revision(
  p_canal text,
  p_modalidad text,
  p_fecha date default current_date
) returns void
language sql
security definer
set search_path = public
as $$
  insert into metricas_revisiones (fecha, canal, modalidad, cantidad, actualizado_en)
  values (p_fecha, p_canal, p_modalidad, 1, now())
  on conflict (fecha, canal, modalidad)
  do update set
    cantidad = metricas_revisiones.cantidad + 1,
    actualizado_en = now();
$$;

revoke all on function incrementar_metrica_revision(text, text, date) from public, anon, authenticated;
grant execute on function incrementar_metrica_revision(text, text, date) to service_role;
