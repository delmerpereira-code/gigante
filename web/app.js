/* ============================================================================
 *  app.js — UI da 1ª entrega: escala mensal + estado dos plantões + simulador
 *  de quebra. Roda 100% no navegador (motor em rotacao.js). Sem backend ainda.
 * ==========================================================================*/
(function () {
  'use strict';

  var R = window.Rotacao;
  var S = window.Store;
  var CFG = S ? S.rotacaoConfig() : R.CONFIG_PADRAO;

  var CLASSE_PL = {
    'PL I': 'pl-PLI', 'PL II': 'pl-PLII', 'PL III': 'pl-PLIII', 'PL IV': 'pl-PLIV', 'PL V': 'pl-PLV'
  };

  // Elenco de exemplo (planilha "SETEMBRO/2026"), usado só quando o cadastro
  // ainda está vazio.
  var EXEMPLO = {
    'PL I':   'Cássia + Geciane',
    'PL II':  'Elizete + Maryah',
    'PL III': 'Melanye + Nádia',
    'PL IV':  'Camila + Patrício',
    'PL V':   'Adriana + Célia'
  };

  var PLANTOES = {}, CORINGAS = [];
  function carregarElenco() {
    PLANTOES = {};
    var duplas = S ? S.plantoes() : [];
    var temCadastro = duplas.some(function (d) { return d.pessoa_1 || d.pessoa_2; });
    CFG = S ? S.rotacaoConfig() : R.CONFIG_PADRAO;
    CFG.ordem.forEach(function (cod) {
      var nomes;
      if (temCadastro) {
        var d = duplas.filter(function (x) { return x.codigo === cod; })[0] || {};
        nomes = [d.pessoa_1, d.pessoa_2].filter(Boolean).join(' + ') || '(sem dupla)';
      } else {
        nomes = EXEMPLO[cod] || '';
      }
      PLANTOES[cod] = { classe: CLASSE_PL[cod] || '', nomes: nomes };
    });
    CORINGAS = (S && S.coringas().length) ? S.coringas()
             : (temCadastro ? [] : ['Tainá', '(2ª a confirmar)']);
    var av = document.getElementById('avisoElenco');
    if (av) av.hidden = temCadastro;
  }

  var DOW = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
               'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  var ESTADO_ROT = {
    turno_1:  'trab', turno_2: 'trab', descanso: 'prot', folga: 'prot'
  };

  // estado da tela: mês exibido
  var hoje = new Date();
  var ano = 2026, mes = 8; // set/2026 por padrão (bate com o anexo)

  // ---- render escala -----------------------------------------------------
  function renderEscala() {
    document.getElementById('mesAtual').textContent = MESES[mes] + ' / ' + ano;
    var grade = document.getElementById('grade');
    grade.innerHTML = '';
    var totalDias = new Date(ano, mes + 1, 0).getDate();

    for (var d = 1; d <= totalDias; d++) {
      var data = new Date(ano, mes, d);
      var t = R.turnosDoDia(data, CFG);
      var fds = data.getDay() === 0 || data.getDay() === 6;

      var div = document.createElement('div');
      div.className = 'dia' + (fds ? ' fds' : '');
      div.innerHTML =
        '<div class="cab"><span class="num">' + String(d).padStart(2, '0') +
        '</span><span class="dow">' + DOW[data.getDay()] + '</span></div>' +
        turnoHTML('1º turno · 08–20', t.turno1) +
        turnoHTML('2º turno · 20–08', t.turno2);
      grade.appendChild(div);
    }
  }

  function turnoHTML(rot, plantao) {
    if (!plantao) return '<div class="turno"><div class="rot">' + rot + '</div><div class="nomes">—</div></div>';
    var p = PLANTOES[plantao] || { classe: '', nomes: '' };
    return '<div class="turno ' + p.classe + '">' +
             '<div class="rot">' + rot + '</div>' +
             '<div class="pl">' + plantao + '</div>' +
             '<div class="nomes">' + p.nomes + '</div>' +
           '</div>';
  }

  // ---- render estado dos plantões numa data ----------------------------
  function renderEstado() {
    var val = document.getElementById('dataEstado').value;
    if (!val) return;
    var inst = new Date(val + 'T08:30:00'); // manhã, dentro do 1º turno
    var lista = document.getElementById('estadoLista');
    lista.innerHTML = '';
    Object.keys(PLANTOES).forEach(function (pl) {
      var e = R.estadoEm(pl, inst, CFG);
      var cls = ESTADO_ROT[e.estado];
      var item = document.createElement('div');
      item.className = 'estado-item ' + cls;
      item.innerHTML =
        '<span class="pl">' + pl + '</span>' +
        '<span class="badge">' + e.rotulo + '</span>' +
        '<div class="nomes">' + PLANTOES[pl].nomes + '</div>' +
        (e.protegido
          ? '<div class="nomes">protegido até ' + e.fimProtecao.toLocaleString('pt-BR') + '</div>'
          : '<div class="nomes">termina ' + e.fimEstado.toLocaleString('pt-BR') + '</div>');
      lista.appendChild(item);
    });
  }

  // ---- simulador de quebra --------------------------------------------
  function simular() {
    var pl = document.getElementById('simPlantao').value;
    var dataHora = document.getElementById('simQuando').value;
    var horas = parseFloat(document.getElementById('simHoras').value) || 0;
    var box = document.getElementById('simResultado');
    if (!dataHora) { box.textContent = 'Informe data e hora da convocação.'; return; }

    var r = R.avaliarConvocacao(pl, new Date(dataHora), horas, CFG);
    box.className = 'resultado ' + (r.irregular ? 'irregular' : 'ok');
    var linhas =
      '<tr><td>Estado no momento</td><td>' + r.estado + '</td></tr>' +
      (r.irregular
        ? '<tr><td>Folga perdida</td><td>' + r.horasFolgaPerdidas + ' h</td></tr>' +
          '<tr><td>Crédito folga (× mult.)</td><td>' + r.creditoFolga + ' h</td></tr>'
        : '') +
      '<tr><td>Crédito trabalho (× fator)</td><td>' + r.creditoTrabalho + ' h</td></tr>' +
      '<tr><td>Total ao banco de horas</td><td>' + r.total + ' h</td></tr>';
    box.innerHTML = '<strong>' + r.mensagem + '</strong><table>' + linhas + '</table>';
  }

  // ---- navegação -----------------------------------------------------
  function mover(delta) {
    mes += delta;
    if (mes < 0) { mes = 11; ano--; }
    if (mes > 11) { mes = 0; ano++; }
    renderEscala();
  }

  // ---- init --------------------------------------------------------
  document.addEventListener('dados-prontos', function () {
    carregarElenco();
    var elAnc = document.getElementById('ancora');
    if (elAnc && CFG.ancora) {
      var p = String(CFG.ancora).split('-');
      if (p.length === 3) elAnc.textContent = p[2] + '/' + p[1] + '/' + p[0];
    }
    document.getElementById('coringas').textContent =
      CORINGAS.length ? 'Coringas: ' + CORINGAS.join(', ') : 'sem coringas cadastradas';
    document.getElementById('prev').addEventListener('click', function () { mover(-1); });
    document.getElementById('next').addEventListener('click', function () { mover(1); });
    document.getElementById('hoje').addEventListener('click', function () {
      ano = hoje.getFullYear(); mes = hoje.getMonth(); renderEscala();
    });

    var dEst = document.getElementById('dataEstado');
    dEst.value = '2026-09-04';
    dEst.addEventListener('change', renderEstado);

    var simP = document.getElementById('simPlantao');
    Object.keys(PLANTOES).forEach(function (pl) {
      var o = document.createElement('option'); o.value = pl; o.textContent = pl; simP.appendChild(o);
    });
    document.getElementById('simQuando').value = '2026-09-04T10:00';
    document.getElementById('simHoras').value = 12;
    document.getElementById('simBtn').addEventListener('click', simular);

    renderEscala();
    renderEstado();
    simular();
  });
})();
