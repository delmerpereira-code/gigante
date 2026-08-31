-- ═══════════════════════════════════════════════════════════════════════════
--  Delta 1 — rode DEPOIS do schema.sql.
--  (1) permite ao funcionário lançar no PRÓPRIO banco de horas (eventos dele)
--  (2) RPC para propor permuta (insere permuta + 1ª linha de histórico)
-- ═══════════════════════════════════════════════════════════════════════════

-- (1) banco_horas: própria linha OU líder
drop policy if exists bh_wr on banco_horas;
create policy bh_wr on banco_horas for all to authenticated
  using      (is_lider() or funcionario_id = meu_funcionario_id())
  with check (is_lider() or funcionario_id = meu_funcionario_id());

-- (2) propor permuta
create or replace function permuta_propor(
  p_a uuid, p_b uuid,
  ta_data date, ta_parte parte_turno_t, ta_inicio timestamptz, ta_fim timestamptz,
  dupla boolean default false,
  tb_data date default null, tb_parte parte_turno_t default null,
  tb_inicio timestamptz default null, tb_fim timestamptz default null,
  nota text default ''
) returns permutas language plpgsql security definer as $$
declare nova permutas; limite interval; primeiro timestamptz;
begin
  if p_a = p_b then raise exception 'As duas pessoas têm de ser diferentes.'; end if;
  if not is_lider() and p_a <> meu_funcionario_id()
    then raise exception 'Você só propõe permuta de um turno seu.'; end if;
  if dupla and (tb_inicio is null) then raise exception 'Na troca de dia, informe o turno da contraparte.'; end if;

  select (valor||' hours')::interval into limite from config where chave='permuta_prazo_horas';
  primeiro := least(ta_inicio, coalesce(tb_inicio, ta_inicio));
  if primeiro - now() < limite then
    raise exception 'O turno começa em menos de % — fora do prazo da permuta.', limite;
  end if;

  insert into permutas (pessoa_a_id,pessoa_b_id,turno_a_data,turno_a_parte,turno_a_inicio,turno_a_fim,
                        mao_dupla,turno_b_data,turno_b_parte,turno_b_inicio,turno_b_fim,obs)
  values (p_a,p_b,ta_data,ta_parte,ta_inicio,ta_fim,
          dupla, case when dupla then tb_data end, case when dupla then tb_parte end,
          case when dupla then tb_inicio end, case when dupla then tb_fim end, coalesce(nota,''))
  returning * into nova;

  insert into permuta_historico(permuta_id,quem,texto)
    values (nova.id, coalesce((select nome_curto from funcionarios where id=p_a),'?'), 'propôs a permuta');
  return nova;
end $$;
