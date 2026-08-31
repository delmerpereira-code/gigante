-- ═══════════════════════════════════════════════════════════════════════════
--  Delta 4 — o trigger de proteção do cadastro passou a barrar tambem o SQL
--  admin (sem usuario logado). Agora so barra funcionario autenticado.
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function guard_func_update() returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and not is_lider() then
    if (new.matricula, new.cargo, new.regime, new.plantao, new.lider, new.status,
        new.saldo_inicial_banco, new.dias_ferias_ano, new.auth_user_id)
       is distinct from
       (old.matricula, old.cargo, old.regime, old.plantao, old.lider, old.status,
        old.saldo_inicial_banco, old.dias_ferias_ano, old.auth_user_id)
    then raise exception 'Só o líder altera matrícula, cargo, regime, plantão, status, saldos ou vínculo de login.';
    end if;
  end if;
  return new;
end $$;
