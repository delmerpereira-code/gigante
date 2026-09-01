-- ═══════════════════════════════════════════════════════════════════════════
--  Delta 6 — regime "expediente"
--  Funcionário de expediente: trabalha todos os dias 8h (administrativo),
--  fora do ciclo de 120h. Pode ser designado para cobrir ausências
--  pontualmente (urgência) e folga em seguida — o líder gerencia o banco
--  de horas desses casos manualmente (sem lançamento automático).
-- ═══════════════════════════════════════════════════════════════════════════
alter type regime_t add value if not exists 'expediente';
