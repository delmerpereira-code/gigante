-- ═══════════════════════════════════════════════════════════════════════════
--  Delta 3 — e-mail de contato no cadastro.
--  O login passa a ser pela MATRÍCULA (o sistema cria um e-mail interno
--  <matricula>@plantao.local só para o Supabase). Este campo é o e-mail real,
--  usado para enviar documentos (permuta, etc.).
-- ═══════════════════════════════════════════════════════════════════════════
alter table funcionarios add column if not exists email text not null default '';
