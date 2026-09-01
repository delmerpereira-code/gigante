-- ═══════════════════════════════════════════════════════════════════════════
--  Delta 8 — Férias com fluxo de aprovação
--  O servidor SOLICITA (situacao = 'solicitada'); o líder aprova / rejeita /
--  modifica (justificativa obrigatória em rejeitar e modificar).
--  Licença médica: o líder lança (entra já 'aprovada').
-- ═══════════════════════════════════════════════════════════════════════════
alter table eventos add column if not exists situacao      text;
alter table eventos add column if not exists justificativa text not null default '';
alter table eventos add column if not exists decidido_por  text not null default '';

-- registros antigos de férias sem situação = considerados aprovados
update eventos set situacao = 'aprovada'
  where tipo = 'ferias' and (situacao is null or situacao = '');
update eventos set situacao = 'aprovada'
  where tipo = 'licenca_medica' and (situacao is null or situacao = '');

-- trava: quem não é líder não decide (não muda situacao / justificativa /
-- decidido_por, e só pode criar/editar enquanto 'solicitada').
create or replace function guard_evento_ferias() returns trigger language plpgsql as $$
begin
  if auth.uid() is null or is_lider() then return new; end if;   -- SQL admin / líder: livre
  if new.tipo <> 'ferias' then
    if new.tipo = 'licenca_medica' then
      raise exception 'Só o líder lança licença médica.';
    end if;
    return new;
  end if;
  if tg_op = 'INSERT' then
    if coalesce(new.situacao,'solicitada') <> 'solicitada' then
      raise exception 'A solicitação de férias entra como "solicitada".';
    end if;
    new.situacao := 'solicitada'; new.justificativa := ''; new.decidido_por := '';
    return new;
  end if;
  -- UPDATE por não-líder: só enquanto ainda pendente e sem mexer na decisão
  if coalesce(old.situacao,'solicitada') <> 'solicitada' then
    raise exception 'Solicitação já decidida pelo líder — não pode alterar.';
  end if;
  new.situacao := 'solicitada';
  new.justificativa := old.justificativa;
  new.decidido_por := old.decidido_por;
  return new;
end $$;

drop trigger if exists trg_guard_evento_ferias on eventos;
create trigger trg_guard_evento_ferias
  before insert or update on eventos
  for each row execute function guard_evento_ferias();
