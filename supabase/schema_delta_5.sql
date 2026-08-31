-- ═══════════════════════════════════════════════════════════════════════════
--  Delta 5 — permuta de mão dupla gera as DUAS pernas no livro de contas
--  (A deve a B pela perna 1; B deve a A pela perna 2 — se anulam quando as
--  duas acontecem, mas ficam registradas).
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function permuta_confirmar(p_id uuid) returns void language plpgsql security definer as $$
declare p permutas; hA numeric; hB numeric;
begin
  select * into p from permutas where id = p_id;
  if not found then raise exception 'Permuta não encontrada.'; end if;
  if not is_lider() and p.pessoa_b_id <> meu_funcionario_id()
    then raise exception 'Só a contraparte confirma.'; end if;
  if p.estado <> 'aprovada' then raise exception 'Permuta está "%".', p.estado; end if;

  update permutas set estado = 'confirmada', confirmada_em = now() where id = p_id;
  delete from conta_permutas where permuta_id = p_id;

  hA := round(extract(epoch from (p.turno_a_fim - p.turno_a_inicio)) / 3600);
  insert into conta_permutas (de_id, para_id, horas, tipo, permuta_id, obs)
  values (p.pessoa_a_id, p.pessoa_b_id, hA, 'divida', p_id,
          p.numero || case when p.mao_dupla then ' (turno de A)' else '' end);

  if p.mao_dupla and p.turno_b_inicio is not null then
    hB := round(extract(epoch from (p.turno_b_fim - p.turno_b_inicio)) / 3600);
    insert into conta_permutas (de_id, para_id, horas, tipo, permuta_id, obs)
    values (p.pessoa_b_id, p.pessoa_a_id, hB, 'divida', p_id, p.numero || ' (turno de B)');
  end if;

  perform _perm_log(p_id, 'confirmou o acordo');
end $$;
