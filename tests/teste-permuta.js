/* ============================================================================
 *  teste-permuta.js — Permuta de turno + conta entre funcionários.
 *      node tests/teste-permuta.js
 * ==========================================================================*/
var Store = require('../web/store.js');

var falhas = 0, ok = 0;
function checa(nome, cond, extra) {
  if (cond) { ok++; console.log('  ok  ' + nome); }
  else { falhas++; console.log('  X   ' + nome + (extra != null ? '  → ' + extra : '')); }
}

Store.limparTudo();
Store.seedElencoExemplo();

// turnos futuros de Camila (PL IV)
var tc = Store.proximosTurnosDe('Camila', 8);
checa('Camila tem turnos futuros', tc.length >= 4, tc.length);
checa('turno tem 12 h', tc[0].horas === 12, tc[0].horas);
checa('coringa não tem turnos', Store.proximosTurnosDe('Tainá', 8).length === 0);

// ── mão única: Camila passa, Adriana cobre → Camila deve 12 h a Adriana ────
var p = Store.proporPermuta({
  pessoa_a: 'Camila', pessoa_b: 'Adriana', turno_a: tc[3], mao_dupla: 'nao', obs: 'troca do dia 20'
});
checa('permuta criada em "proposta"', p.estado === 'proposta', p.estado);
checa('número no formato PERM-AAAA-NNN', /^PERM-\d{4}-\d{3}$/.test(p.numero), p.numero);
checa('sem conta antes de confirmar', Store.saldoEntre('Camila', 'Adriana') === 0);

checa('B não pode confirmar antes da aprovação', (function () {
  try { Store.confirmarPermuta(p.id, 'Adriana'); return false; } catch (e) { return true; }
})());

Store.aprovarPermuta(p.id, 'Diretora');
checa('após aprovar → "aprovada"', Store.permutaPorId(p.id).estado === 'aprovada');
Store.confirmarPermuta(p.id, 'Adriana');
checa('após confirmar → "confirmada"', Store.permutaPorId(p.id).estado === 'confirmada');
checa('conta: Camila deve 12 h a Adriana', Store.saldoEntre('Camila', 'Adriana') === 12,
  Store.saldoEntre('Camila', 'Adriana'));
checa('lado da Adriana: -12', Store.saldoEntre('Adriana', 'Camila') === -12);
checa('contasDe(Adriana) mostra Camila', Store.contasDe('Adriana')[0].outra === 'Camila');

// ── resumo para o cadastro ───────────────────────────────────────────────
var p1b = Store.proporPermuta({ pessoa_a: 'Camila', pessoa_b: 'Adriana', turno_a: tc[5], mao_dupla: 'nao' });
Store.aprovarPermuta(p1b.id, 'Diretora'); Store.confirmarPermuta(p1b.id, 'Adriana');
var contas = Store.contasDe('Camila');
checa('Camila deve 2 turnos (24 h) a Adriana', contas[0].turnos === 2 && contas[0].horas === 24,
  JSON.stringify(contas[0]));
checa('resumo cita as 2 permutas', contas[0].permutas.length === 2, contas[0].permutas.join());
var rc = Store.resumoContas('Camila')[0];
checa('frase "Você deve 2 turnos (24 h) a Adriana Reis"',
  /Você deve 2 turnos \(24 h\) a Adriana/.test(rc.texto), rc.texto);
var ra = Store.resumoContas('Adriana')[0];
checa('lado da Adriana: "... deve 2 turnos (24 h) a você"',
  /deve 2 turnos \(24 h\) a você/.test(ra.texto) && ra.devo === false, ra.texto);
// desfaz a 2ª pra não atrapalhar os próximos testes
Store.cancelarPermuta(p1b.id, 'Diretora');

// ── quitação parcial ─────────────────────────────────────────────────────
Store.quitarPermuta('Camila', 'Adriana', 5, 'cobriu meio turno');
checa('após quitar 5 h → saldo 7', Store.saldoEntre('Camila', 'Adriana') === 7,
  Store.saldoEntre('Camila', 'Adriana'));

// ── cancelar permuta confirmada desfaz a dívida ──────────────────────────
Store.cancelarPermuta(p.id, 'Diretora');
checa('cancelada → conta da permuta removida (fica só a quitação -5)',
  Store.saldoEntre('Camila', 'Adriana') === -5, Store.saldoEntre('Camila', 'Adriana'));

// ── mão dupla: troca de dia, sem dívida ──────────────────────────────────
Store.limparTudo(); Store.seedElencoExemplo();
var ta = Store.proximosTurnosDe('Melanye', 8);
var tb = Store.proximosTurnosDe('Nádia', 8);
var p2 = Store.proporPermuta({
  pessoa_a: 'Melanye', pessoa_b: 'Nádia', turno_a: ta[2], mao_dupla: 'sim', turno_b: tb[3], obs: ''
});
Store.aprovarPermuta(p2.id, 'Diretora');
Store.confirmarPermuta(p2.id, 'Nádia');
checa('troca de dia não gera dívida', Store.saldoEntre('Melanye', 'Nádia') === 0);

// ── rejeição encerra ────────────────────────────────────────────────────
var p3 = Store.proporPermuta({ pessoa_a: 'Cássia', pessoa_b: 'Geciane', turno_a: Store.proximosTurnosDe('Cássia', 8)[2], mao_dupla: 'nao' });
Store.rejeitarPermuta(p3.id, 'Diretora', 'sem cobertura');
checa('rejeitada é estado final', Store.permutaPorId(p3.id).estado === 'rejeitada');
checa('não dá para aprovar uma rejeitada', (function () {
  try { Store.aprovarPermuta(p3.id, 'Diretora'); return false; } catch (e) { return true; }
})());

// ── visibilidade ────────────────────────────────────────────────────────
Store.setVerComo('Cássia');
checa('Cássia vê a permuta dela', Store.permutasVisiveis().some(function (x) { return x.id === p3.id; }));
checa('Cássia não vê a permuta Melanye↔Nádia', !Store.permutasVisiveis().some(function (x) { return x.id === p2.id; }));
Store.setVerComo('Lider');
checa('Líder vê todas', Store.permutasVisiveis().length >= 2);

console.log('\n' + ok + ' ok, ' + falhas + ' falha(s).');
Store.limparTudo(); Store.setVerComo('Lider');
process.exit(falhas ? 1 : 0);
