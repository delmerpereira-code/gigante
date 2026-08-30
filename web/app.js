/* ============================================================================
 *  app.js — UI da 1ª entrega: escala mensal + estado dos plantões + simulador
 *  de quebra. Roda 100% no navegador (motor em rotacao.js). Sem backend ainda.
 * ==========================================================================*/
(function () {
  'use strict';

  var R = window.Rotacao;

  // Elenco de exemplo, lido da planilha "SETEMBRO/2026". Substituível pelo
  // cadastro real quando a API entrar. 2ª coringa ainda a confirmar.
  var PLANTOES = {
    'PL I':   { classe: 'pl-PLI',   nomes: 'Cássia + Geciane' },
    'PL II':  { classe: 'pl-PLII',  nomes: 'Elizete + Maryah' },
    'PL III': { classe: 'pl-PLIII', nomes: 'Melanye + Nádia' },
    'PL IV':  { classe: 'pl-PLIV',  nomes: 'Camila + Patrício' },
    'PL V':   { classe: 'pl-PLV',   nomes: 'Adriana + Célia' }
  };
  var CORINGAS = ['Tainá', '(2ª a confirmar)'];

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
      var t = R.turnosDoDia(data);
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
      var e = R.estadoEm(pl, inst);
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

    var r = R.avaliarConvocacao(pl, new Date(dataHora), horas);
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
  document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('coringas').textContent = 'Coringas: ' + CORINGAS.join(', ');
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
