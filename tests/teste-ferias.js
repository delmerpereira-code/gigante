/* ============================================================================
 *  teste-ferias.js — Saldo de férias e semáforo de disponibilidade (store.js).
 *      node tests/teste-ferias.js
 * ==========================================================================*/
var Store = require('../web/store.js');

var falhas = 0, ok = 0;
function checa(nome, cond, extra) {
  if (cond) { ok++; console.log('  ok  ' + nome); }
  else { falhas++; console.log('  X   ' + nome + (extra != null ? '  → ' + extra : '')); }
}

Store.limparTudo();
Store.seedElencoExemplo();

// 13 pessoas (12 + Diretora)
checa('seed cria 13 (12 + Diretora)', Store.funcionarios().length === 13, Store.funcionarios().length);
checa('papelAtual padrão = líder', Store.papelAtual().tipo === 'lider');

// ── saldo ──────────────────────────────────────────────────────────────────
var s = Store.saldoFerias('Camila', 2026);
checa('saldo base Camila = 30', s.base === 30, s.base);
checa('saldo consumido = 0', s.consumido === 0);

// ── período livre (sem conflito, longe no futuro) ──────────────────────────
var a1 = Store.avaliarFerias('Camila', '2026-11-02', '2026-11-11', undefined, false, 'ferias');
checa('férias sem conflito = livre', a1.nivel === 'livre', a1.nivel + ' ' + JSON.stringify(a1.mensagens));

// ── sobreposição com parceiro de dupla (Patrício, PL IV) ───────────────────
Store.salvarEvento({ tipo: 'ferias', pessoa: 'Patrício', inicio: '2026-11-05', fim: '2026-11-15' });
var a2 = Store.avaliarFerias('Camila', '2026-11-10', '2026-11-12', undefined, false, 'ferias');
checa('sobreposição com parceiro de dupla = bloqueado', a2.nivel === 'bloqueado',
  a2.nivel + ' ' + JSON.stringify(a2.mensagens));
checa('mensagem cita o parceiro', a2.mensagens.join(' ').indexOf('Patrício') >= 0);

// Camila em outro período (sem Patrício) volta a ser livre
var a3 = Store.avaliarFerias('Camila', '2026-12-01', '2026-12-05', undefined, false, 'ferias');
checa('Camila em dezembro (livre)', a3.nivel === 'livre', a3.nivel);

// ── 2ª cobertura simultânea = impacto (não bloqueia) ──────────────────────
// Patrício (PL IV) já está de férias 05–15/11. Melanye (PL III) no mesmo intervalo:
var a4 = Store.avaliarFerias('Melanye', '2026-11-08', '2026-11-12', undefined, false, 'ferias');
checa('2 titulares de plantões diferentes = impacto', a4.nivel === 'impacto',
  a4.nivel + ' ' + JSON.stringify(a4.mensagens));

// ── 3º titular no mesmo intervalo = bloqueado (só 2 coringas) ─────────────
Store.salvarEvento({ tipo: 'ferias', pessoa: 'Melanye', inicio: '2026-11-08', fim: '2026-11-12' });
var a5 = Store.avaliarFerias('Elizete', '2026-11-09', '2026-11-11', undefined, false, 'ferias');
checa('3º titular simultâneo = bloqueado', a5.nivel === 'bloqueado',
  a5.nivel + ' ' + JSON.stringify(a5.mensagens));
checa('sugere próxima janela livre', a5.proximaJanela && a5.proximaJanela.inicio > '2026-11-11',
  a5.proximaJanela && a5.proximaJanela.inicio);

// ── coringa de férias enquanto a outra cobre vaga ────────────────────────
// Só Patrício coberto (05–15/11); Melanye já saiu em 12/11. Tainá em 13–14/11:
var a6 = Store.avaliarFerias('Tainá', '2026-11-13', '2026-11-14', undefined, false, 'ferias');
checa('coringa de férias c/ a outra cobrindo 1 vaga = impacto', a6.nivel === 'impacto',
  a6.nivel + ' ' + JSON.stringify(a6.mensagens));
// as duas coringas de férias ao mesmo tempo → bloqueado
Store.salvarEvento({ tipo: 'ferias', pessoa: 'Tainá', inicio: '2026-11-20', fim: '2026-11-25' });
var a7 = Store.avaliarFerias('Coringa 2', '2026-11-21', '2026-11-23', undefined, false, 'ferias');
checa('2 coringas de férias juntas = bloqueado', a7.nivel === 'bloqueado', a7.nivel);

// ── saldo estourado ──────────────────────────────────────────────────────
var a8 = Store.avaliarFerias('Adriana', '2027-01-04', '2027-02-15', undefined, false, 'ferias'); // 43 dias
checa('período > 30 dias = bloqueado por saldo', a8.nivel === 'bloqueado',
  a8.nivel + ' ' + JSON.stringify(a8.mensagens));
checa('mensagem cita saldo', a8.mensagens.join(' ').toLowerCase().indexOf('saldo') >= 0);

// ── salvarEvento NÃO barra (férias é comunicação): registra o nível ──────
var rb = Store.salvarEvento({ tipo: 'ferias', pessoa: 'Elizete', inicio: '2026-11-09', fim: '2026-11-11' });
checa('salvarEvento aceita férias com cobertura crítica', rb && rb.nivel === 'bloqueado', rb && rb.nivel);
Store.removerEvento(rb.id); // não contaminar os testes de saldo abaixo

// ── cobertura nomeada resolve a lacuna ──────────────────────────────────
var ac = Store.avaliarFerias('Elizete', '2026-11-09', '2026-11-11', undefined, false, 'ferias', 'Coringa 2');
checa('cobertura nomeada (Coringa 2 livre) tira o crítico', ac.nivel !== 'bloqueado',
  ac.nivel + ' ' + JSON.stringify(ac.mensagens));

// ── consumo de saldo após salvar ────────────────────────────────────────
// Patrício: 05–15/11 = 11 dias
checa('Patrício consumiu 11 dias', Store.saldoFerias('Patrício', 2026).consumido === 11,
  Store.saldoFerias('Patrício', 2026).consumido);
checa('Patrício restante = 19', Store.saldoFerias('Patrício', 2026).restante === 19);

// ── papel: funcionário só vê o próprio banco ─────────────────────────────
Store.salvarEvento({ tipo: 'sobreaviso_acionado', pessoa: 'Tainá', inicio: '2026-09-12T20:00', fim: '2026-09-13T02:00' });
Store.setVerComo('Camila');
checa('como Camila: papel funcionario', Store.papelAtual().tipo === 'funcionario');
checa('como Camila: banco visível só dela',
  Store.bancoHorasVisivel().every(function (l) { return l.pessoa === 'Camila'; }));
checa('como Camila: não é líder', Store.ehLider() === false);
Store.setVerComo('Lider');
checa('volta a líder: vê banco de todos',
  Store.bancoHorasVisivel().some(function (l) { return l.pessoa === 'Tainá'; }));

// ── quebra de carga horária da coringa (Tainá cobre PL V e depois PL III) ──
Store.limparTudo();
Store.seedElencoExemplo();
Store.setConfig('ancora_rotacao', '2026-09-01');
// Célia (PL V) de férias até voltar 07/09 → coringa Tainá cobre
var evV = Store.salvarEvento({ tipo: 'ferias', pessoa: 'Célia', substituto: 'Tainá',
  inicio: '2026-09-01', fim: '2026-09-06' });
// Melanye (PL III) de licença a partir de 05/09 → Tainá também
var avIII = Store.avaliarFerias('Melanye', '2026-09-05', '2026-09-12', undefined, false, 'licenca_medica', 'Tainá');
checa('detecta quebra de carga horária da coringa', avIII.quebraCarga && avIII.quebraCarga.length === 1,
  JSON.stringify(avIII.quebraCarga));
checa('quebra: 48h de descanso perdidas', avIII.quebraCarga[0].horasPerdidas === 48,
  avIII.quebraCarga && avIII.quebraCarga[0].horasPerdidas);
checa('quebra vira nível crítico', avIII.nivel === 'bloqueado', avIII.nivel);

// líder NÃO assume → nada no banco
var semAssumir = Store.salvarEvento({ tipo: 'licenca_medica', pessoa: 'Melanye', substituto: 'Tainá',
  inicio: '2026-09-05', fim: '2026-09-12' });
checa('sem assumir: nada lançado no banco da Tainá',
  Store.bancoHoras().filter(function (l) { return l.pessoa === 'Tainá'; }).length === 0);
Store.removerEvento(semAssumir.id);

// líder assume → 48h de folga_perdida no banco da Tainá
var comAssumir = Store.salvarEvento({ tipo: 'licenca_medica', pessoa: 'Melanye', substituto: 'Tainá',
  inicio: '2026-09-05', fim: '2026-09-12', assumirQuebra: true });
checa('assumindo: retorno marca quebraAssumida', comAssumir.quebraAssumida === true);
var lanc = Store.bancoHoras().filter(function (l) { return l.pessoa === 'Tainá' && l.motivo === 'folga_perdida'; });
checa('assumindo: 48h de folga_perdida no banco da Tainá', lanc.length === 1 && lanc[0].horas === 48,
  JSON.stringify(lanc));

// ── expediente cobre sem gerar quebra automática ─────────────────────────
Store.limparTudo();
Store.seedElencoExemplo();
Store.setConfig('ancora_rotacao', '2026-09-01');
Store.salvarFuncionario({ nome_curto: 'Expedito', nome_completo: 'Expedito X', matricula: 'EXP1',
  cargo: 'investigador', regime: 'expediente', status: 'ativo' });
var evExp = Store.salvarEvento({ tipo: 'licenca_medica', pessoa: 'Melanye', substituto: 'Expedito',
  inicio: '2026-09-05', fim: '2026-09-06' });
checa('expediente cobrindo: sem quebra automática', !evExp.quebraCarga || evExp.quebraCarga.length === 0,
  JSON.stringify(evExp.quebraCarga));
checa('expediente cobrindo: nada no banco', Store.bancoHoras().filter(function (l) { return l.pessoa === 'Expedito'; }).length === 0);
checa('avaliarCoberturas ignora expediente', Store.avaliarCoberturas('Expedito', null, undefined).length === 0);

// ── fluxo de aprovação de férias ────────────────────────────────────────
Store.limparTudo(); Store.seedElencoExemplo();
Store.funcionarios().forEach(function (f) { if (f.nome_curto === 'Cássia') Store.salvarFuncionario({ id: f.id, lider: 'sim' }, false); });

Store.setVerComo('Camila'); // servidora
var sol = Store.salvarEvento({ tipo: 'ferias', pessoa: 'Camila', inicio: '2026-12-01', fim: '2026-12-10' });
checa('servidor: férias entra como "solicitada"', Store.eventos().filter(function (e) { return e.id === sol.id; })[0].situacao === 'solicitada');
checa('solicitada NÃO consome saldo', Store.saldoFerias('Camila', 2026).consumido === 0, Store.saldoFerias('Camila', 2026).consumido);
checa('servidor não pode decidir', (function () { try { Store.decidirFerias(sol.id, 'aprovar', {}); return false; } catch (e) { return true; } })());

Store.setVerComo('Cássia'); // líder
checa('rejeitar sem justificativa falha', (function () { try { Store.decidirFerias(sol.id, 'rejeitar', {}); return false; } catch (e) { return true; } })());
Store.decidirFerias(sol.id, 'aprovar', {});
checa('após aprovar: situacao aprovada', Store.eventos().filter(function (e) { return e.id === sol.id; })[0].situacao === 'aprovada');
checa('aprovada consome saldo (10 dias)', Store.saldoFerias('Camila', 2026).consumido === 10, Store.saldoFerias('Camila', 2026).consumido);

var sol2 = Store.salvarEvento({ tipo: 'ferias', pessoa: 'Patrício', inicio: '2026-12-01', fim: '2026-12-05' });
Store.decidirFerias(sol2.id, 'modificar', { inicio: '2026-12-15', fim: '2026-12-19', justificativa: 'conflito com a dupla' });
var e2 = Store.eventos().filter(function (e) { return e.id === sol2.id; })[0];
checa('modificar: novas datas + aprovada + justificativa', e2.inicio.slice(0, 10) === '2026-12-15' && e2.situacao === 'aprovada' && /conflito/.test(e2.justificativa), JSON.stringify(e2));

console.log('\n' + ok + ' ok, ' + falhas + ' falha(s).');
Store.limparTudo();
Store.setVerComo('Lider');
process.exit(falhas ? 1 : 0);
