-- ═══════════════════════════════════════════════════════════════════════════
--  Delta 7 — Permuta sem aprovação do líder
--  Fluxo novo:  proposta → confirmada (a contraparte B aceita) → concluída.
--  O líder NÃO aprova, só é comunicado. O termo é impresso e o Diretor
--  assina no papel (fora do sistema).
--  permuta_confirmar passa a aceitar a permuta em 'proposta' OU 'aprovada'
--  ('aprovada' só por retrocompatibilidade com registros antigos).
--  (permuta_recusar já aceita os dois estados — não muda.)
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function permuta_confirmar(p_id uuid) returns void language plpgsql security definer as $$
declare p permutas; hA numeric; hB numeric;
begin
  select * into p from permutas where id = p_id;
  if not found then raise exception 'Permuta não encontrada.'; end if;
  if not is_lider() and p.pessoa_b_id <> meu_funcionario_id()
    then raise exception 'Só a contraparte confirma o acordo.'; end if;
  if p.estado not in ('proposta','aprovada')
    then raise exception 'Permuta está "%", não dá para confirmar.', p.estado; end if;

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
