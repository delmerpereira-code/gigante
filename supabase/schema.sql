-- ═══════════════════════════════════════════════════════════════════════════
--  Controle de Plantão — esquema Supabase (Postgres)
--  Cole no SQL Editor do projeto e rode. Reexecutável (drop + create).
--  Espelha as coleções de web/store.js.  Ver docs/ESPECIFICACAO.md.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── limpeza (para reexecução) ─────────────────────────────────────────────
drop view  if exists v_extrato_banco cascade;
drop view  if exists v_saldo_banco   cascade;
drop table if exists conta_permutas    cascade;
drop table if exists permuta_historico cascade;
drop table if exists permutas          cascade;
drop table if exists banco_horas       cascade;
drop table if exists eventos           cascade;
drop table if exists config            cascade;
drop table if exists funcionarios      cascade;
drop type  if exists cargo_t, regime_t, status_func_t, tipo_evento_t, nivel_ferias_t,
                     sentido_banco_t, motivo_banco_t, parte_turno_t, estado_permuta_t,
                     tipo_conta_t cascade;

-- ── enums ────────────────────────────────────────────────────────────────
create type cargo_t         as enum ('investigador','delegado','diretor','administrador');
create type regime_t        as enum ('plantao','coringa','expediente','externo');
create type status_func_t   as enum ('ativo','ferias','licenca','afastado');
create type tipo_evento_t   as enum ('folga_abatendo_banco','convocacao',
                                     'sobreaviso_escalado','sobreaviso_acionado',
                                     'ferias','licenca_medica');
create type nivel_ferias_t  as enum ('livre','impacto','bloqueado');
create type sentido_banco_t as enum ('entrada','saida');
create type motivo_banco_t  as enum ('folga_perdida','convocacao','sobreaviso_acionado',
                                     'sobreaviso_escalado','abatimento','permuta',
                                     'ajuste_manual','saldo_inicial');
create type parte_turno_t   as enum ('diurno','noturno');
create type estado_permuta_t as enum ('proposta','aprovada','confirmada','concluida',
                                      'rejeitada','recusada','cancelada','expirada');
create type tipo_conta_t    as enum ('divida','quitacao');

-- ── funcionarios ─────────────────────────────────────────────────────────
create table funcionarios (
  id              uuid primary key default gen_random_uuid(),
  auth_user_id    uuid unique references auth.users(id) on delete set null,
  matricula       text unique,
  nome_completo   text not null default '',
  nome_curto      text not null unique,
  foto            text not null default '',          -- data URL base64 (por ora)
  email           text not null default '',          -- e-mail real de contato (não é o login)
  celular         text not null default '',          -- celular / WhatsApp
  celular2        text not null default '',
  nascimento      date,
  cargo           cargo_t       not null default 'investigador',
  regime          regime_t      not null default 'plantao',
  plantao         text          not null default '', -- 'PL I'..'PL V' se regime='plantao'
  lider           boolean       not null default false,
  admissao        date,
  status          status_func_t not null default 'ativo',
  saldo_inicial_banco numeric   not null default 0,
  dias_ferias_ano int           not null default 30,
  criado_em       timestamptz   not null default now()
);

-- ── config ───────────────────────────────────────────────────────────────
create table config ( chave text primary key, valor text not null );
insert into config (chave,valor) values
  ('ancora_rotacao','2026-09-01'),
  ('ordem_rotacao','PL IV;PL V;PL I;PL II;PL III'),
  ('mult_folga_perdida','1'),
  ('fator_convocacao','1'),
  ('credito_sobreaviso','0'),
  ('dias_ferias_padrao','30'),
  ('antecedencia_ferias_dias','30'),
  ('permuta_prazo_horas','12');

-- ── eventos ──────────────────────────────────────────────────────────────
create table eventos (
  id             uuid primary key default gen_random_uuid(),
  tipo           tipo_evento_t not null,
  funcionario_id uuid not null references funcionarios(id) on delete cascade,
  substituto_id  uuid references funcionarios(id) on delete set null,
  inicio         timestamptz not null,
  fim            timestamptz not null,
  irregular      boolean not null default false,
  nivel          nivel_ferias_t,
  obs            text not null default '',
  situacao       text,                          -- férias: solicitada|aprovada|rejeitada
  justificativa  text not null default '',      -- texto do líder ao rejeitar/modificar
  decidido_por   text not null default '',
  criado_em      timestamptz not null default now()
);
create index on eventos (funcionario_id);
create index on eventos (tipo, inicio);

-- ── banco_horas ──────────────────────────────────────────────────────────
create table banco_horas (
  id             uuid primary key default gen_random_uuid(),
  data_hora      timestamptz not null default now(),
  funcionario_id uuid not null references funcionarios(id) on delete cascade,
  sentido        sentido_banco_t not null,
  horas          numeric not null check (horas >= 0),
  motivo         motivo_banco_t not null,
  evento_id      uuid references eventos(id) on delete cascade,
  obs            text not null default '',
  criado_em      timestamptz not null default now()
);
create index on banco_horas (funcionario_id, data_hora);

-- saldo corrente por funcionário  (security_invoker: a view respeita o RLS de quem consulta)
create view v_saldo_banco with (security_invoker = on) as
select f.id as funcionario_id, f.nome_curto,
       f.saldo_inicial_banco
       + coalesce(sum(case when b.sentido='entrada' then b.horas else -b.horas end),0) as saldo
from funcionarios f
left join banco_horas b on b.funcionario_id = f.id
group by f.id;

-- extrato com saldo acumulado
create view v_extrato_banco with (security_invoker = on) as
select b.*,
       f.saldo_inicial_banco
       + sum(case when b.sentido='entrada' then b.horas else -b.horas end)
         over (partition by b.funcionario_id order by b.data_hora, b.id) as saldo_resultante
from banco_horas b join funcionarios f on f.id = b.funcionario_id;

-- ── permutas ─────────────────────────────────────────────────────────────
create table permutas (
  id             uuid primary key default gen_random_uuid(),
  numero         text unique,
  pessoa_a_id    uuid not null references funcionarios(id) on delete cascade,
  pessoa_b_id    uuid not null references funcionarios(id) on delete cascade,
  turno_a_data   date not null,
  turno_a_parte  parte_turno_t not null,
  turno_a_inicio timestamptz not null,
  turno_a_fim    timestamptz not null,
  mao_dupla      boolean not null default false,
  turno_b_data   date,
  turno_b_parte  parte_turno_t,
  turno_b_inicio timestamptz,
  turno_b_fim    timestamptz,
  obs            text not null default '',
  estado         estado_permuta_t not null default 'proposta',
  criada_em      timestamptz not null default now(),
  aprovada_em    timestamptz,
  confirmada_em  timestamptz,
  check (pessoa_a_id <> pessoa_b_id)
);

create table permuta_historico (
  id          bigint generated always as identity primary key,
  permuta_id  uuid not null references permutas(id) on delete cascade,
  quando      timestamptz not null default now(),
  quem        text not null default '',
  texto       text not null default ''
);

-- numeração PERM-AAAA-NNN por ano
create or replace function set_numero_permuta() returns trigger language plpgsql as $$
declare ano text := to_char(now(),'YYYY'); n int;
begin
  if new.numero is null then
    select count(*)+1 into n from permutas where to_char(criada_em,'YYYY') = ano;
    new.numero := 'PERM-'||ano||'-'||lpad(n::text,3,'0');
  end if;
  return new;
end $$;
create trigger trg_numero_permuta before insert on permutas
  for each row execute function set_numero_permuta();

-- ── conta_permutas (livro entre funcionários — fora do banco de horas) ────
create table conta_permutas (
  id          uuid primary key default gen_random_uuid(),
  data        timestamptz not null default now(),
  de_id       uuid not null references funcionarios(id) on delete cascade,
  para_id     uuid not null references funcionarios(id) on delete cascade,
  horas       numeric not null check (horas > 0),
  tipo        tipo_conta_t not null,
  permuta_id  uuid references permutas(id) on delete cascade,
  obs         text not null default '',
  check (de_id <> para_id)
);

-- saldo líquido entre A e B  ( >0 = A deve a B )
create or replace function saldo_entre(a uuid, b uuid) returns numeric language sql stable as $$
  select coalesce(sum(case
    when tipo='divida'   and de_id=a and para_id=b then  horas
    when tipo='divida'   and de_id=b and para_id=a then -horas
    when tipo='quitacao' and de_id=a and para_id=b then -horas
    when tipo='quitacao' and de_id=b and para_id=a then  horas
    else 0 end),0)
  from conta_permutas
  where de_id in (a,b) and para_id in (a,b);
$$;

-- ═══════════════════════════════════════════════════════════════════════════
--  AUTENTICAÇÃO / PERMISSÕES
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function is_lider() returns boolean language sql stable security definer as $$
  select exists (select 1 from funcionarios where auth_user_id = auth.uid() and lider);
$$;
create or replace function meu_funcionario_id() returns uuid language sql stable security definer as $$
  select id from funcionarios where auth_user_id = auth.uid();
$$;

alter table funcionarios      enable row level security;
alter table config            enable row level security;
alter table eventos           enable row level security;
alter table banco_horas       enable row level security;
alter table permutas          enable row level security;
alter table permuta_historico enable row level security;
alter table conta_permutas    enable row level security;

-- funcionarios: todos autenticados leem; líder cria/apaga; cada um edita a própria linha
create policy func_sel on funcionarios for select to authenticated using (true);
create policy func_ins on funcionarios for insert to authenticated with check (is_lider());
create policy func_del on funcionarios for delete to authenticated using (is_lider());
create policy func_upd on funcionarios for update to authenticated
  using (is_lider() or auth_user_id = auth.uid())
  with check (is_lider() or auth_user_id = auth.uid());

-- trava colunas administrativas quando não é líder
create or replace function guard_func_update() returns trigger language plpgsql as $$
begin
  -- só barra funcionário autenticado; SQL admin (sem auth.uid) sempre passa
  if auth.uid() is not null and not is_lider() then
    if (new.matricula,new.cargo,new.regime,new.plantao,new.lider,new.status,
        new.saldo_inicial_banco,new.dias_ferias_ano,new.auth_user_id)
       is distinct from
       (old.matricula,old.cargo,old.regime,old.plantao,old.lider,old.status,
        old.saldo_inicial_banco,old.dias_ferias_ano,old.auth_user_id)
    then raise exception 'Só o líder altera matrícula, cargo, regime, plantão, status, saldos ou vínculo de login.';
    end if;
  end if;
  return new;
end $$;
create trigger trg_guard_func before update on funcionarios
  for each row execute function guard_func_update();

-- config: todos leem, líder escreve
create policy cfg_sel on config for select to authenticated using (true);
create policy cfg_all on config for all    to authenticated using (is_lider()) with check (is_lider());

-- eventos: próprio + líder + os tipos "públicos"
create policy ev_sel on eventos for select to authenticated using (
  is_lider() or funcionario_id = meu_funcionario_id()
  or tipo in ('ferias','licenca_medica','sobreaviso_escalado','sobreaviso_acionado')
);
create policy ev_wr on eventos for all to authenticated
  using (is_lider() or funcionario_id = meu_funcionario_id())
  with check (is_lider() or funcionario_id = meu_funcionario_id());

-- banco_horas: leitura própria/líder; escrita direta só líder (ajuste manual).
-- lançamentos automáticos de eventos entram via RPC (SECURITY DEFINER).
create policy bh_sel on banco_horas for select to authenticated using (
  is_lider() or funcionario_id = meu_funcionario_id()
);
create policy bh_wr on banco_horas for all to authenticated using (is_lider()) with check (is_lider());

-- permutas: partes + líder
create policy pm_sel on permutas for select to authenticated using (
  is_lider() or pessoa_a_id = meu_funcionario_id() or pessoa_b_id = meu_funcionario_id()
);
create policy pm_ins on permutas for insert to authenticated with check (
  is_lider() or pessoa_a_id = meu_funcionario_id()
);
-- UPDATE só via RPCs abaixo (nega update direto)
create policy pm_upd on permutas for update to authenticated using (false);

create policy pmh_sel on permuta_historico for select to authenticated using (
  exists (select 1 from permutas p where p.id = permuta_id
    and (is_lider() or p.pessoa_a_id = meu_funcionario_id() or p.pessoa_b_id = meu_funcionario_id()))
);

create policy cp_sel on conta_permutas for select to authenticated using (
  is_lider() or de_id = meu_funcionario_id() or para_id = meu_funcionario_id()
);
create policy cp_ins on conta_permutas for insert to authenticated with check (
  tipo = 'quitacao' and (is_lider() or de_id = meu_funcionario_id() or para_id = meu_funcionario_id())
);

-- ═══════════════════════════════════════════════════════════════════════════
--  RPCs da permuta (a regra de negócio mora aqui)
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function _perm_nome() returns text language sql stable as $$
  select coalesce((select nome_curto from funcionarios where auth_user_id = auth.uid()), 'sistema');
$$;
create or replace function _perm_log(p_id uuid, txt text) returns void language sql as $$
  insert into permuta_historico(permuta_id,quem,texto) values (p_id, _perm_nome(), txt);
$$;

create or replace function permuta_aprovar(p_id uuid) returns void language plpgsql security definer as $$
declare p permutas; begin
  select * into p from permutas where id = p_id;
  if not found then raise exception 'Permuta não encontrada.'; end if;
  if not is_lider() then raise exception 'Só o líder aprova.'; end if;
  if p.estado <> 'proposta' then raise exception 'Permuta está "%", não dá para aprovar.', p.estado; end if;
  update permutas set estado='aprovada', aprovada_em=now() where id=p_id;
  perform _perm_log(p_id, 'aprovou');
end $$;

create or replace function permuta_rejeitar(p_id uuid, motivo text default '') returns void language plpgsql security definer as $$
declare p permutas; begin
  select * into p from permutas where id=p_id;
  if not found then raise exception 'Permuta não encontrada.'; end if;
  if not is_lider() then raise exception 'Só o líder rejeita.'; end if;
  if p.estado <> 'proposta' then raise exception 'Permuta está "%".', p.estado; end if;
  update permutas set estado='rejeitada' where id=p_id;
  perform _perm_log(p_id, 'rejeitou'||case when motivo<>'' then ' ('||motivo||')' else '' end);
end $$;

create or replace function permuta_confirmar(p_id uuid) returns void language plpgsql security definer as $$
declare p permutas; h numeric; begin
  select * into p from permutas where id=p_id;
  if not found then raise exception 'Permuta não encontrada.'; end if;
  if not is_lider() and p.pessoa_b_id <> meu_funcionario_id()
    then raise exception 'Só a contraparte confirma.'; end if;
  if p.estado <> 'aprovada' then raise exception 'Permuta está "%".', p.estado; end if;
  update permutas set estado='confirmada', confirmada_em=now() where id=p_id;
  if not p.mao_dupla then
    h := round(extract(epoch from (p.turno_a_fim - p.turno_a_inicio))/3600);
    insert into conta_permutas(de_id,para_id,horas,tipo,permuta_id,obs)
      values (p.pessoa_a_id, p.pessoa_b_id, h, 'divida', p_id, p.numero);
  end if;
  perform _perm_log(p_id, 'confirmou o acordo');
end $$;

create or replace function permuta_recusar(p_id uuid) returns void language plpgsql security definer as $$
declare p permutas; begin
  select * into p from permutas where id=p_id;
  if not found then raise exception 'Permuta não encontrada.'; end if;
  if not is_lider() and p.pessoa_b_id <> meu_funcionario_id()
    then raise exception 'Só a contraparte recusa.'; end if;
  if p.estado not in ('proposta','aprovada') then raise exception 'Permuta está "%".', p.estado; end if;
  update permutas set estado='recusada' where id=p_id;
  perform _perm_log(p_id, 'recusou o acordo');
end $$;

create or replace function permuta_cancelar(p_id uuid) returns void language plpgsql security definer as $$
declare p permutas; begin
  select * into p from permutas where id=p_id;
  if not found then raise exception 'Permuta não encontrada.'; end if;
  if not is_lider() and p.pessoa_a_id <> meu_funcionario_id() and p.pessoa_b_id <> meu_funcionario_id()
    then raise exception 'Sem permissão para cancelar.'; end if;
  if p.estado not in ('proposta','aprovada','confirmada') then raise exception 'Permuta está "%".', p.estado; end if;
  delete from conta_permutas where permuta_id = p_id;      -- desfaz a dívida, se houver
  update permutas set estado='cancelada' where id=p_id;
  perform _perm_log(p_id, 'cancelou');
end $$;

create or replace function permuta_concluir(p_id uuid) returns void language plpgsql security definer as $$
declare p permutas; begin
  select * into p from permutas where id=p_id;
  if p.estado <> 'confirmada' then raise exception 'Permuta está "%".', p.estado; end if;
  update permutas set estado='concluida' where id=p_id;
  perform _perm_log(p_id, 'concluída');
end $$;

-- marca como expiradas as permutas ainda não confirmadas cujo prazo passou
create or replace function permutas_expirar() returns void language plpgsql security definer as $$
declare limite interval;
begin
  select (valor||' hours')::interval into limite from config where chave='permuta_prazo_horas';
  update permutas set estado='expirada'
  where estado in ('proposta','aprovada')
    and least(turno_a_inicio, coalesce(turno_b_inicio, turno_a_inicio)) - now() < limite;
end $$;

-- lançamento manual de quitação (RPC para checar direção)
create or replace function permuta_quitar(de uuid, para uuid, h numeric, nota text default '')
  returns void language plpgsql security definer as $$
begin
  if de = para or h <= 0 then raise exception 'Dados de quitação inválidos.'; end if;
  if not is_lider() and de <> meu_funcionario_id() and para <> meu_funcionario_id()
    then raise exception 'Sem permissão.'; end if;
  insert into conta_permutas(de_id,para_id,horas,tipo,obs) values (de,para,h,'quitacao',nota);
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
--  SEED opcional — elenco de exemplo (rode só se quiser dados de teste)
-- ═══════════════════════════════════════════════════════════════════════════
-- insert into funcionarios (matricula,nome_curto,nome_completo,cargo,regime,plantao,lider) values
--   ('M1001','Cássia','Cássia','investigador','plantao','PL I',false),
--   ('M1002','Geciane','Geciane','investigador','plantao','PL I',false),
--   ('M1003','Elizete','Elizete','investigador','plantao','PL II',false),
--   ('M1004','Maryah','Maryah','investigador','plantao','PL II',false),
--   ('M1005','Melanye','Melanye','investigador','plantao','PL III',false),
--   ('M1006','Nádia','Nádia','investigador','plantao','PL III',false),
--   ('M1007','Camila','Camila','investigador','plantao','PL IV',false),
--   ('M1008','Patrício','Patrício','investigador','plantao','PL IV',false),
--   ('M1009','Adriana','Adriana','investigador','plantao','PL V',false),
--   ('M1010','Célia','Célia','investigador','plantao','PL V',false),
--   ('M1011','Tainá','Tainá','investigador','coringa','',false),
--   ('M1012','Coringa 2','Coringa 2','investigador','coringa','',false),
--   ('M1013','Diretora','Diretora','diretor','externo','',true);
