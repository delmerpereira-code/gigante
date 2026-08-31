/* ============================================================================
 *  calendario.js — Gantt mensal: uma linha por pessoa, uma coluna por dia.
 * ==========================================================================*/
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var R = window.Rotacao, S = window.Store;
  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
               'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  var DOW = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

  var hoje = new Date();
  var ano = 2026, mes = 8; // set/2026

  var EVT_MARCA = {
    ferias: { c: 'ev-fer', s: 'F' },
    licenca_medica: { c: 'ev-lic', s: 'L' },
    sobreaviso_escalado: { c: 'ev-sob', s: 'S' },
    sobreaviso_acionado: { c: 'ev-sob', s: 'S!' },
    convocacao: { c: 'ev-conv', s: 'C' },
    troca: { c: 'ev-perm', s: 'P' }
  };

  function rank(f) { return f.regime === 'plantao' ? 0 : (f.regime === 'coringa' ? 1 : 2); }
  function pessoasOrdenadas() {
    var cfg = S.rotacaoConfig();
    return S.funcionarios()
      .filter(function (f) { return f.regime === 'plantao' || f.regime === 'coringa'; })
      .sort(function (a, b) {
        if (rank(a) !== rank(b)) return rank(a) - rank(b);
        var pa = cfg.ordem.indexOf(a.plantao), pb = cfg.ordem.indexOf(b.plantao);
        if (pa !== pb) return pa - pb;
        return a.nome_curto.localeCompare(b.nome_curto);
      });
  }

  function preencherFiltro() {
    var cfg = S.rotacaoConfig();
    $('filtro').innerHTML = '<option value="">Todos</option>' +
      cfg.ordem.map(function (c) { return '<option value="' + c + '">' + c + '</option>'; }).join('') +
      '<option value="__cor">Coringas</option>';
  }

  function cobreDia(ini, fim, d) {
    var d0 = new Date(ano, mes, d).getTime();
    var a = new Date(ini); a = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
    var b = new Date(fim); b = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
    return a <= d0 && b >= d0;
  }

  function render() {
    var cfg = S.rotacaoConfig();
    var pessoas = pessoasOrdenadas();
    $('avisoVazio').hidden = pessoas.length > 0;
    $('mesAtual').textContent = MESES[mes] + ' / ' + ano;

    var filtro = $('filtro').value;
    if (filtro === '__cor') pessoas = pessoas.filter(function (p) { return p.regime === 'coringa'; });
    else if (filtro) pessoas = pessoas.filter(function (p) { return p.plantao === filtro; });

    var totalDias = new Date(ano, mes + 1, 0).getDate();
    var papel = S.papelAtual();
    var PUBLICOS = { ferias: 1, licenca_medica: 1, sobreaviso_escalado: 1, sobreaviso_acionado: 1 };
    var evs = S.eventos().filter(function (e) {
      return PUBLICOS[e.tipo] || papel.tipo === 'lider' || e.pessoa === papel.nome;
    });
    // permutas confirmadas entram como marcas de troca nos dois envolvidos
    S.permutas().forEach(function (p) {
      if (p.estado !== 'confirmada' && p.estado !== 'concluida') return;
      function marca(pessoa, ini, obs) { evs.push({ tipo: 'troca', pessoa: pessoa, inicio: ini, fim: ini, nivel: '', obs: p.numero + ' — ' + obs }); }
      marca(p.pessoa_a, p.turno_a_inicio, 'passou o turno');
      marca(p.pessoa_b, p.turno_a_inicio, 'cobre o turno');
      if (p.mao_dupla === 'sim' && p.turno_b_inicio) {
        marca(p.pessoa_b, p.turno_b_inicio, 'passou o turno');
        marca(p.pessoa_a, p.turno_b_inicio, 'cobre o turno');
      }
    });

    // cabeçalho
    var thead = '<thead><tr><th class="cal-nome">Pessoa</th>';
    for (var d = 1; d <= totalDias; d++) {
      var dow = new Date(ano, mes, d).getDay();
      var hojeCls = (ano === hoje.getFullYear() && mes === hoje.getMonth() && d === hoje.getDate()) ? ' hoje' : '';
      thead += '<th class="cal-d' + (dow === 0 || dow === 6 ? ' fds' : '') + hojeCls + '">' +
        d + '<span>' + DOW[dow] + '</span></th>';
    }
    thead += '</tr></thead>';

    var tbody = '<tbody>';
    pessoas.forEach(function (p) {
      var euCls = (papel.tipo === 'funcionario' && papel.nome === p.nome_curto) ? ' eu' : '';
      tbody += '<tr' + euCls + '><td class="cal-nome">' + p.nome_curto +
        '<span class="cal-sub">' + (p.plantao || 'coringa') + '</span></td>';
      for (var dia = 1; dia <= totalDias; dia++) {
        tbody += celula(p, dia, cfg, evs);
      }
      tbody += '</tr>';
    });
    tbody += '</tbody>';

    $('cal').innerHTML = thead + tbody;
    renderAlertas(evs, totalDias);
  }

  function celula(p, dia, cfg, evs) {
    var base = '', titulo = [];
    if (p.regime === 'plantao' && p.plantao) {
      var f = R.fase(p.plantao, new Date(ano, mes, dia), cfg);
      if (f === 0) { base = 'c-t1'; titulo.push('1º turno 08–20'); }
      else if (f === 1) { base = 'c-t2'; titulo.push('2º turno 20–08'); }
      else { base = 'c-folga'; titulo.push('folga'); }
    }
    var marcas = '';
    evs.forEach(function (e) {
      if (e.pessoa !== p.nome_curto) return;
      if (!EVT_MARCA[e.tipo]) return;
      if (!cobreDia(e.inicio, e.fim, dia)) return;
      var m = EVT_MARCA[e.tipo];
      var extra = (e.tipo === 'ferias' && e.nivel && e.nivel !== 'livre') ? ' nv-' + e.nivel : '';
      marcas += '<i class="mk ' + m.c + extra + '">' + m.s + '</i>';
      titulo.push(rotuloEvento(e));
    });
    return '<td class="cal-c ' + base + '" title="' + titulo.join(' | ').replace(/"/g, '') + '">' + marcas + '</td>';
  }

  function rotuloEvento(e) {
    var r = { ferias: 'férias', licenca_medica: 'licença', sobreaviso_escalado: 'sobreaviso',
              sobreaviso_acionado: 'sobreaviso acionado', convocacao: 'convocação', troca: 'permuta' };
    return (r[e.tipo] || e.tipo) + (e.nivel && e.nivel !== 'livre' ? ' (' + e.nivel + ')' : '');
  }

  function renderAlertas(evs, totalDias) {
    var ul = $('alertas');
    var itens = [];

    // dias com sobreaviso descoberto ou 2ª cobertura
    for (var d = 1; d <= totalDias; d++) {
      var titFora = 0, corFora = 0;
      evs.forEach(function (e) {
        if (!cobreDia(e.inicio, e.fim, d)) return;
        var g = S.funcionarioPorNome(e.pessoa);
        if (!g) return;
        if ((e.tipo === 'ferias' || e.tipo === 'licenca_medica') && g.regime === 'plantao') titFora++;
        if (e.tipo === 'ferias' && g.regime === 'coringa') corFora++;
      });
      var corAtivas = S.funcionarios().filter(function (x) { return x.regime === 'coringa' && x.status !== 'afastado'; }).length;
      var disp = corAtivas - corFora;
      if (titFora > disp) itens.push('Dia ' + d + ': ' + titFora + ' titular(es) fora e só ' + disp + ' coringa(s) — cobertura insuficiente.');
      else if (titFora > 0 && titFora === disp) itens.push('Dia ' + d + ': sobreaviso descoberto (todas as coringas cobrindo vaga).');
      else if (titFora >= 2) itens.push('Dia ' + d + ': ' + titFora + ' coberturas simultâneas.');
    }

    // permutas pendentes / eventos irregulares
    evs.forEach(function (e) {
      if (e.irregular === 'sim') {
        var di = new Date(e.inicio);
        if (di.getMonth() === mes && di.getFullYear() === ano)
          itens.push('Convocação irregular de ' + e.pessoa + ' em ' + di.toLocaleDateString('pt-BR') + '.');
      }
    });

    ul.innerHTML = itens.length
      ? itens.map(function (t) { return '<li>' + t + '</li>'; }).join('')
      : '<li class="ok">Sem alertas neste mês.</li>';
  }

  function mover(delta) {
    mes += delta;
    if (mes < 0) { mes = 11; ano--; }
    if (mes > 11) { mes = 0; ano++; }
    render();
  }

  document.addEventListener('dados-prontos', function () {
    if (!S.funcionarios().length) { $('avisoVazio').hidden = false; }
    preencherFiltro();
    $('prev').addEventListener('click', function () { mover(-1); });
    $('next').addEventListener('click', function () { mover(1); });
    $('hoje').addEventListener('click', function () { ano = hoje.getFullYear(); mes = hoje.getMonth(); render(); });
    $('filtro').addEventListener('change', render);
    render();
  });
})();
