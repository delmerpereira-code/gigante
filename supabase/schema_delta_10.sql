-- ═══════════════════════════════════════════════════════════════════════════
--  Delta 10 — administrador conta como "gestão" no banco
--  is_lider() passa a valer também para cargo = 'administrador', não só a
--  flag lider. Assim o administrador (Adriana, Delmer) tem no Postgres o
--  mesmo acesso do líder (RLS, triggers e RPCs). "admin ⊇ líder".
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function is_lider() returns boolean language sql stable security definer as $$
  select exists (
    select 1 from funcionarios
    where auth_user_id = auth.uid() and (lider or cargo = 'administrador')
  );
$$;
