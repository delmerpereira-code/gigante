/* ============================================================================
 *  teste-eventos.js — Verifica store.js: cadastro, eventos e banco de horas.
 *  Roda no Node (store.js usa fallback em memória quando não há localStorage).
 *      node tests/teste-eventos.js
 * ==========================================================================*/
var Store = require('../web/store.js');

var falhas = 0, ok = 0;
function checa(nome, cond, extra) {
  if (cond) { ok++; console.log('  ok  ' + nome); }
  else { falhas++; console.log('  X   ' + nome + (extra != null ? '  → ' + extra : '')); }
}
function quase(a, b, tol) { return Math.abs(a - b) <= (tol == null ? 0.01 : tol); }

// ── 1. seed / derivação de plantões ─────────────────────────────────────────
Store.limparTudo();
Store.seedElencoExemplo();

var funcs = Store.funcionarios();
checa('seed cria 13 funcionários (12 + Diretora)', funcs.length === 13, funcs.length);
checa('10 plantão + 2 coringas + 1 líder',
  funcs.filter(function (f) { return f.regime === 'plantao'; }).length === 10 &&
  Store.coringas().length === 2 &&
  funcs.filter(function (f) { return f.lider === 'sim'; }).length === 1);

var pls = Store.plantoes();
checa('5 plantões derivados', pls.length === 5, pls.length);
var plIV = pls.filter(function (p) { return p.codigo === 'PL IV'; })[0];
checa('PL IV = Camila + Patrício',
  plIV && [plIV.pessoa_1, plIV.pessoa_2].sort().join(',') === 'Camila,Patrício',
  plIV && (plIV.pessoa_1 + '/' + plIV.pessoa_2));

// ── 2. convocação em período protegido (folga) ─────────────────────────────
// PL IV: ciclo começa 01/09 08:00 → folga de 03/09 08:00 a 06/09 08:00.
var r = Store.salvarEvento({
  tipo: 'convocacao', pessoa: 'Camila',
  inicio: '2026-09-04T10:00', fim: '2026-09-04T22:00' // 12 h
});
checa('convocação na folga é irregular', r.irregular === true, JSON.stringify(r.impacto));
checa('folga perdida = 46 h (06/09 08:00 − 04/09 10:00)',
  quase(r.impacto.horasFolgaPerdidas, 46), r.impacto.horasFolgaPerdidas);
checa('total ao banco = 58 h (46 folga + 12 trabalho)',
  quase(r.impacto.total, 58), r.impacto.total);
checa('saldo de Camila = 58 h', quase(Store.saldoDe('Camila'), 58), Store.saldoDe('Camila'));

var lanc = Store.bancoHoras().filter(function (l) { return l.pessoa === 'Camila'; });
checa('2 lançamentos gerados (folga_perdida + convocacao)', lanc.length === 2, lanc.length);

// ── 3. convocação FORA de período protegido (durante turno) ────────────────
var r2 = Store.salvarEvento({
  tipo: 'convocacao', pessoa: 'Adriana', // PL V
  inicio: '2026-09-02T09:00', fim: '2026-09-02T13:00' // PL V fase 0 em 02/09 → 1º turno
});
checa('convocação em turno não é irregular', r2.irregular === false, JSON.stringify(r2.impacto));
checa('crédito só do trabalho (4 h)', quase(Store.saldoDe('Adriana'), 4), Store.saldoDe('Adriana'));

// ── 4. folga abatendo banco (débito) ──────────────────────────────────────
Store.salvarEvento({
  tipo: 'folga_abatendo_banco', pessoa: 'Camila',
  inicio: '2026-09-10T08:00', fim: '2026-09-11T08:00' // 24 h
});
checa('folga abatendo banco debita 24 h → saldo 34',
  quase(Store.saldoDe('Camila'), 34), Store.saldoDe('Camila'));

// ── 5. sobreaviso acionado (coringa) ──────────────────────────────────────
Store.salvarEvento({
  tipo: 'sobreaviso_acionado', pessoa: 'Tainá',
  inicio: '2026-09-12T20:00', fim: '2026-09-13T02:00' // 6 h
});
checa('sobreaviso acionado credita 6 h à Tainá',
  quase(Store.saldoDe('Tainá'), 6), Store.saldoDe('Tainá'));

// ── 6. remover evento desfaz os lançamentos ───────────────────────────────
var evs = Store.eventos();
var evConv = evs.filter(function (e) { return e.pessoa === 'Camila' && e.tipo === 'convocacao'; })[0];
Store.removerEvento(evConv.id);
checa('remover convocação: saldo de Camila volta p/ −24 (só o abatimento)',
  quase(Store.saldoDe('Camila'), -24), Store.saldoDe('Camila'));
checa('saldo negativo é sinalizado', Store.saldoDe('Camila') < 0);

// ── 7. saldo inicial respeitado (edição por id) ──────────────────────────
var nadia = Store.funcionarioPorNome('Nádia');
Store.salvarFuncionario({ id: nadia.id, nome_curto: 'Nádia', regime: 'plantao', plantao: 'PL III', saldo_inicial_banco: 10 });
checa('nome curto duplicado é rejeitado', (function () {
  try { Store.salvarFuncionario({ nome_curto: 'Nádia', regime: 'coringa' }); return false; }
  catch (e) { return true; }
})());
checa('saldo inicial 10 h aparece sem lançamentos', quase(Store.saldoDe('Nádia'), 10), Store.saldoDe('Nádia'));

// ── 8. ajuste manual ─────────────────────────────────────────────────────
Store.ajusteManual('Nádia', 'saida', 4, 'compensação', '2026-09-15T08:00');
checa('ajuste manual de −4 h → saldo 6', quase(Store.saldoDe('Nádia'), 6), Store.saldoDe('Nádia'));

// ── 9. export/import ─────────────────────────────────────────────────────
var dump = Store.exportar();
Store.limparTudo();
checa('após limpar, 0 funcionários', Store.funcionarios().length === 0);
Store.importar(dump);
checa('após importar, 12+ funcionários e saldo da Tainá preservado',
  Store.funcionarios().length >= 12 && quase(Store.saldoDe('Tainá'), 6), Store.saldoDe('Tainá'));

// ── 10. cadastro pessoal: renomear propaga, campos administrativos travados ─
Store.limparTudo();
Store.seedElencoExemplo();
Store.salvarEvento({ tipo: 'sobreaviso_acionado', pessoa: 'Camila', inicio: '2026-09-12T20:00', fim: '2026-09-13T02:00' });
var cam = Store.funcionarioPorNome('Camila');
Store.salvarFuncionario({ id: cam.id, nome_curto: 'Camila S.', celular: '999' }, true);
checa('renomear pelo cadastro pessoal', !!Store.funcionarioPorNome('Camila S.'));
checa('eventos seguem o novo nome', Store.eventos().some(function (e) { return e.pessoa === 'Camila S.'; }));
checa('saldo segue o novo nome', quase(Store.saldoDe('Camila S.'), 6), Store.saldoDe('Camila S.'));
Store.salvarFuncionario({ id: cam.id, nome_curto: 'Camila S.', regime: 'coringa', plantao: 'PL I' }, true);
var cam2 = Store.funcionarioPorNome('Camila S.');
checa('apenasPessoais não altera regime/plantão', cam2.regime === 'plantao' && cam2.plantao === 'PL IV',
  cam2.regime + '/' + cam2.plantao);

// ── resultado ────────────────────────────────────────────────────────────
console.log('\n' + ok + ' ok, ' + falhas + ' falha(s).');
Store.limparTudo();
process.exit(falhas ? 1 : 0);
