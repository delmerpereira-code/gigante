-- ═══════════════════════════════════════════════════════════════════════════
--  Delta 2 — rode depois do schema.sql e do schema_delta_1.sql.
--  Faz as views respeitarem o RLS de quem consulta (Postgres 15+).
--  Sem isto, uma view roda como dona e ignora as políticas por linha.
-- ═══════════════════════════════════════════════════════════════════════════
alter view v_saldo_banco   set (security_invoker = on);
alter view v_extrato_banco set (security_invoker = on);
