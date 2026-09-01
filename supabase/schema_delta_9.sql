-- ═══════════════════════════════════════════════════════════════════════════
--  Delta 9 — coluna funcionarios.oculto
--  "Usuário de sistema": não aparece na equipe / escala / calendário / seletores.
--  Para o prestador / dono do sistema (combinar com cargo = 'administrador').
-- ═══════════════════════════════════════════════════════════════════════════
alter table funcionarios add column if not exists oculto boolean not null default false;

-- trava: só o líder mexe em oculto (além dos campos administrativos já travados)
create or replace function guard_func_update() returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and not is_lider() then
    if (new.matricula,new.cargo,new.regime,new.plantao,new.lider,new.oculto,new.status,
        new.saldo_inicial_banco,new.dias_ferias_ano,new.auth_user_id)
       is distinct from
       (old.matricula,old.cargo,old.regime,old.plantao,old.lider,old.oculto,old.status,
        old.saldo_inicial_banco,old.dias_ferias_ano,old.auth_user_id)
    then raise exception 'Só o líder altera matrícula, cargo, regime, plantão, status, saldos ou vínculo de login.';
    end if;
  end if;
  return new;
end $$;
