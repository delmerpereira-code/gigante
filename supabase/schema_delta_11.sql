-- ═══════════════════════════════════════════════════════════════════════════
--  Delta 11 — turno avulso de coringa
--  Nova opção de evento 'turno_coringa': a coringa/expediente é plugada num
--  turno solto de um plantão (dia + diurno/noturno). O sistema só REGISTRA e
--  avisa quando fura o descanso de 120h (com opção de o líder assumir → banco).
--  Coluna eventos.plantao guarda qual plantão a coringa cobriu.
-- ═══════════════════════════════════════════════════════════════════════════
alter table eventos add column if not exists plantao text;

-- amplia o enum de tipos de evento
alter type tipo_evento_t add value if not exists 'turno_coringa';

-- a policy de escrita já cobre: is_lider() OU funcionario_id = meu_funcionario_id().
-- O guard de férias (trg_guard_evento_ferias) ignora tipos != ferias/licenca.
