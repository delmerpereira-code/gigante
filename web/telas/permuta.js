/* telas/permuta.js — permuta de turno: proposta, aprovação, termo, conta A↔B */
(function () {
  'use strict';
  var S = window.Store, A = window.App;

  var EST = {
    proposta: ['aguardando aprovação', 'a'], aprovada: ['aguardando confirmação', 'a'],
    confirmada: ['confirmada', 'v'], concluida: ['concluída', 'v'],
    rejeitada: ['rejeitada', 'r'], recusada: ['recusada', 'r'], cancelada: ['cancelada', 'r'], expirada: ['expirada (prazo)', 'r']
  };
  function eu() { return S.papelAtual(); }
  function lider() { return S.ehLider(); }
  function fmtD(iso) { var p = String(iso).slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : iso; }
  function fmtH(iso) { var d = new Date(iso); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  function plantonistas() {
    return S.funcionarios().filter(function (f) { return f.regime === 'plantao'; })
      .sort(function (a, b) { return a.nome_curto.localeCompare(b.nome_curto); });
  }
  function rotTurno(t) { return fmtD(t.data) + ' · ' + (t.parte === 'diurno' ? 'diurno 08–20' : 'noturno 20–08') + ' · ' + t.plantao; }

  function contador() {
    try {
      return S.permutasVisiveis().filter(function (p) {
        var me = eu();
        if (p.estado === 'proposta' && me.tipo === 'lider') return true;
        if (p.estado === 'aprovada' && me.nome === p.pessoa_b) return true;
        return false;
      }).length || null;
    } catch (e) { return null; }
  }

  function montar(corpo) {
    var turnosA = [], turnosB = [];

    var formCard = A.h('div', { class: 'card' });
    formCard.innerHTML =
      '<h3>Nova permuta</h3>' +
      '<div class="form">' +
        '<div class="campo"><label>Quem passa o turno (A)</label><select id="p-a"></select></div>' +
        '<div class="campo"><label>Contraparte (B)</label><select id="p-b"></select></div>' +
        '<div class="campo wide"><label>Turno que <b id="p-la">A</b> passa</label><select id="p-ta"></select></div>' +
        '<div class="campo wide"><label style="text-transform:none;letter-spacing:0"><input type="checkbox" id="p-dupla"> Troca de dia (cada um cobre o do outro — sem dívida)</label></div>' +
        '<div class="campo wide" id="p-wtb" hidden><label>Turno que <b id="p-lb">B</b> passa</label><select id="p-tb"></select></div>' +
        '<div class="campo wide"><label>Observação</label><input type="text" id="p-obs"></div>' +
      '</div>' +
      '<div class="card-acoes"><button class="pri" id="p-propor">Propor permuta</button><span class="erro" id="p-erro"></span></div>' +
      '<div class="muted small" id="p-semturnos" hidden>Sem turnos para permutar (a pessoa não tem plantão fixo).</div>';
    corpo.appendChild(formCard);

    var contasCard = A.h('div', { class: 'card' });
    corpo.appendChild(contasCard);
    var listaCard = A.h('div', { class: 'card' });
    corpo.appendChild(listaCard);

    var $ = function (s) { return formCard.querySelector(s); };

    function pessoasSel() {
      var me = eu();
      var op = function (f) { return '<option value="' + A.esc(f.nome_curto) + '">' + A.esc(f.nome_curto) + ' · ' + f.plantao + '</option>'; };
      var lst = plantonistas();
      if (lider()) { $('#p-a').innerHTML = lst.map(op).join(''); $('#p-a').disabled = false; }
      else {
        $('#p-a').innerHTML = lst.filter(function (f) { return f.nome_curto === me.nome; }).map(op).join('') || '<option value="">(sem plantão)</option>';
        $('#p-a').disabled = true;
      }
      atualB();
    }
    function atualB() {
      var a = $('#p-a').value, prev = $('#p-b').value;
      $('#p-b').innerHTML = plantonistas().filter(function (f) { return f.nome_curto !== a; })
        .map(function (f) { return '<option value="' + A.esc(f.nome_curto) + '">' + A.esc(f.nome_curto) + ' · ' + f.plantao + '</option>'; }).join('');
      if (prev && $('#p-b').querySelector('option[value="' + prev + '"]')) $('#p-b').value = prev;
      $('#p-la').textContent = $('#p-a').value || 'A'; $('#p-lb').textContent = $('#p-b').value || 'B';
      turnos();
    }
    function turnos() {
      turnosA = S.proximosTurnosDe($('#p-a').value, 12);
      turnosB = S.proximosTurnosDe($('#p-b').value, 12);
      $('#p-ta').innerHTML = turnosA.map(function (t, i) { return '<option value="' + i + '">' + rotTurno(t) + '</option>'; }).join('');
      $('#p-tb').innerHTML = turnosB.map(function (t, i) { return '<option value="' + i + '">' + rotTurno(t) + '</option>'; }).join('');
      $('#p-semturnos').hidden = turnosA.length > 0;
    }
    function propor() {
      $('#p-erro').textContent = '';
      var tA = turnosA[+$('#p-ta').value], tB = turnosB[+$('#p-tb').value];
      if (!tA) { $('#p-erro').textContent = 'Escolha o turno.'; return; }
      Promise.resolve(S.proporPermuta({
        pessoa_a: $('#p-a').value, pessoa_b: $('#p-b').value,
        turno_a: tA, mao_dupla: $('#p-dupla').checked ? 'sim' : 'nao', turno_b: tB, obs: $('#p-obs').value
      })).then(function () { $('#p-obs').value = ''; render(); A.toast('Permuta proposta', 'sucesso'); })
        .catch(function (e) { $('#p-erro').textContent = e.message || String(e); });
    }

    function acoes(p) {
      var me = eu(), b = [], A_ = me.nome === p.pessoa_a, B = me.nome === p.pessoa_b, L = me.tipo === 'lider';
      if (p.estado === 'proposta') { if (L) { b.push('aprovar'); b.push('rejeitar'); } if (A_ || L) b.push('cancelar'); }
      else if (p.estado === 'aprovada') { if (B) { b.push('confirmar'); b.push('recusar'); } if (A_ || L) b.push('cancelar'); }
      else if (p.estado === 'confirmada') { if (A_ || B || L) b.push('cancelar'); if (L) b.push('concluir'); }
      b.push('termo');
      return b;
    }
    var FN = {
      aprovar: function (id) { return S.aprovarPermuta(id, eu().nome); },
      rejeitar: function (id) { var m = prompt('Motivo (opcional):'); return m === null ? null : S.rejeitarPermuta(id, eu().nome, m); },
      confirmar: function (id) { return S.confirmarPermuta(id, eu().nome); },
      recusar: function (id) { return confirm('Recusar? A permuta é cancelada.') ? S.recusarPermuta(id, eu().nome) : null; },
      cancelar: function (id) { return confirm('Cancelar esta permuta?') ? S.cancelarPermuta(id, eu().nome) : null; },
      concluir: function (id) { return S.concluirPermuta(id); },
      termo: function (id) { termo(id); return null; }
    };

    function resumoTurno(p) {
      var s = p.pessoa_a + ' passa ' + fmtD(p.turno_a_data) + ' ' + p.turno_a_parte + ' (' + fmtH(p.turno_a_inicio) + '–' + fmtH(p.turno_a_fim) + ')';
      s += p.mao_dupla === 'sim'
        ? ' — em troca, ' + p.pessoa_b + ' passa ' + fmtD(p.turno_b_data) + ' ' + p.turno_b_parte
        : ' — mão única: ' + p.pessoa_a + ' fica devendo 12 h a ' + p.pessoa_b;
      return s;
    }

    function render() {
      pessoasSel();
      // contas
      var me = eu();
      if (me.tipo === 'lider') {
        var vist = {}, it = [];
        S.contaPermutas().forEach(function (r) {
          var k = [r.de, r.para].sort().join('|'); if (vist[k]) return; vist[k] = 1;
          var ab = k.split('|'), s = S.saldoEntre(ab[0], ab[1]);
          if (Math.abs(s) > 0.001) it.push(s > 0 ? ab[0] + ' deve ' + s + ' h a ' + ab[1] : ab[1] + ' deve ' + (-s) + ' h a ' + ab[0]);
        });
        contasCard.innerHTML = '<h3>Contas de permuta</h3><div class="chips">' +
          (it.length ? it.map(function (t) { return '<span class="chip">' + A.esc(t) + '</span>'; }).join('') : '<span class="muted">Nenhuma em aberto.</span>') + '</div>';
      } else {
        var res = S.resumoContas(me.nome);
        contasCard.innerHTML = '<h3>Minhas contas de permuta</h3><div class="chips">' +
          (res.length ? res.map(function (r) { return '<span class="chip' + (r.devo ? ' neg' : '') + '">' + A.esc(r.texto) + '</span>'; }).join('') : '<span class="muted">Nada em aberto.</span>') + '</div>';
      }
      contasCard.innerHTML += '<div class="card-acoes"><button id="p-quitar">registrar quitação…</button></div>';
      contasCard.querySelector('#p-quitar').addEventListener('click', quitarModal);

      // lista
      var lst = S.permutasVisiveis().sort(function (a, b) { return String(b.criada_em).localeCompare(String(a.criada_em)); });
      listaCard.innerHTML = '<h3>Permutas (' + lst.length + ')</h3>';
      if (!lst.length) { listaCard.innerHTML += '<div class="muted small">Nenhuma.</div>'; return; }
      lst.forEach(function (p) {
        var e = EST[p.estado] || [p.estado, 'n'];
        var d = A.h('div', { class: 'card', style: 'margin-top:8px' });
        d.innerHTML = '<div class="card-top"><span class="card-titulo">' + p.numero + '</span><span class="tag ' + e[1] + '">' + e[0] + '</span></div>' +
          '<div class="card-linha">' + A.esc(p.pessoa_a) + ' → ' + A.esc(p.pessoa_b) + '</div>' +
          '<div class="card-sub">' + A.esc(resumoTurno(p)) + '</div>' +
          (p.obs ? '<div class="card-sub">“' + A.esc(p.obs) + '”</div>' : '') +
          '<div class="card-acoes"></div>';
        var bar = d.querySelector('.card-acoes');
        acoes(p).forEach(function (ac) {
          var btn = A.h('button', { text: ac, class: ac === 'aprovar' || ac === 'confirmar' ? 'pri' : (ac === 'rejeitar' || ac === 'recusar' ? 'dng' : '') });
          btn.addEventListener('click', function () {
            var r; try { r = FN[ac](p.id); } catch (e) { A.toast(e.message, 'erro'); return; }
            Promise.resolve(r).then(function () { render(); }).catch(function (e) { A.toast(e.message || String(e), 'erro'); render(); });
          });
          bar.appendChild(btn);
        });
        listaCard.appendChild(d);
      });
    }

    function quitarModal() {
      var ps = S.funcionarios().filter(function (f) { return f.regime === 'plantao' || f.regime === 'coringa'; }).map(function (f) { return f.nome_curto; }).sort();
      var o = ps.map(function (n) { return '<option value="' + A.esc(n) + '">' + A.esc(n) + '</option>'; }).join('');
      var m = A.abrirModal('<h2>Registrar quitação</h2><div class="form">' +
        '<div class="campo"><label>Quem pagou</label><select id="q-de">' + o + '</select></div>' +
        '<div class="campo"><label>Quem recebeu</label><select id="q-para">' + o + '</select></div>' +
        '<div class="campo"><label>Horas</label><input type="number" id="q-h" step="0.5" min="0"></div>' +
        '<div class="campo wide"><label>Como (folga, dinheiro…)</label><input type="text" id="q-obs"></div></div>' +
        '<div class="erro" id="q-erro"></div>' +
        '<div class="modal-acoes"><button class="btn sec" id="q-x">Fechar</button><button class="btn" id="q-ok">Registrar</button></div>');
      if (eu().tipo === 'funcionario') m.querySelector('#q-de').value = eu().nome;
      m.querySelector('#q-x').addEventListener('click', A.fecharModal);
      m.querySelector('#q-ok').addEventListener('click', function () {
        Promise.resolve(S.quitarPermuta(m.querySelector('#q-de').value, m.querySelector('#q-para').value, parseFloat(m.querySelector('#q-h').value), m.querySelector('#q-obs').value))
          .then(function () { A.fecharModal(); render(); A.toast('Quitação registrada', 'sucesso'); })
          .catch(function (e) { m.querySelector('#q-erro').textContent = e.message || String(e); });
      });
    }

    function termo(id) {
      var p = S.permutaPorId(id); if (!p) return;
      var Ap = S.funcionarioPorNome(p.pessoa_a) || {}, Bp = S.funcionarioPorNome(p.pessoa_b) || {};
      var docs = formOficial(Ap, Bp, p.turno_a_data, p.turno_a_parte, p);
      if (p.mao_dupla === 'sim' && p.turno_b_inicio) {
        docs += '<div class="quebra-pagina"></div>' + formOficial(Bp, Ap, p.turno_b_data, p.turno_b_parte, p);
      }
      A.abrirModal('<div class="no-print modal-acoes" style="margin:0 0 12px;flex-wrap:wrap">' +
        '<button class="btn sec" id="t-x">Fechar</button>' +
        '<button class="btn sec" id="t-p">Imprimir / PDF</button>' +
        '<button class="btn" id="t-w">Baixar Word (modelo oficial)</button></div>' +
        '<div class="muted small no-print" style="margin:-4px 0 12px">O Word usa o arquivo oficial <code>web/termos/permuta-modelo.docx</code> — layout idêntico, só os campos preenchidos.</div>' +
        '<div class="termo-doc">' + docs + '</div>');
      document.getElementById('t-x').addEventListener('click', A.fecharModal);
      document.getElementById('t-p').addEventListener('click', function () { window.print(); });
      document.getElementById('t-w').addEventListener('click', function () { baixarWord(id); });
    }

    // ── Word: preenche o .docx oficial (docxtemplater) ────────────────────────
    function loadScript(src) {
      return new Promise(function (ok, err) {
        var s = document.createElement('script');
        s.src = src; s.onload = ok; s.onerror = function () { err(new Error('Falha ao carregar ' + src)); };
        document.head.appendChild(s);
      });
    }
    function libsDoc() {
      if ((window.PizZip) && (window.docxtemplater || window.Docxtemplater)) return Promise.resolve();
      return loadScript('https://cdnjs.cloudflare.com/ajax/libs/pizzip/3.1.7/pizzip.min.js')
        .then(function () { return loadScript('https://cdnjs.cloudflare.com/ajax/libs/docxtemplater/3.44.0/docxtemplater.js'); });
    }
    function xis(v) { return v ? 'X' : ''; }
    function qualificacao(f, comExp) {
      var n = PLNUM[f.plantao] || 0, o = {};
      for (var i = 1; i <= 5; i++) o['p' + i] = xis(n === i);
      o.exp = comExp && !n ? 'X' : '';
      o.nome = f.nome_completo || f.nome_curto || '';
      o.cargo = CARGO_L[f.cargo] || f.cargo || '';
      o.matricula = f.matricula || '';
      o.lotacao = S.config('lotacao') || '';
      o.celular = f.celular || '';
      o.plantao = n ? 'P' + n : (comExp ? 'EXPEDIENTE' : (f.plantao || ''));
      return o;
    }
    function dadosDoc(sub, subst, dataIso, parte, p) {
      var hoje = new Date(), dp = String(dataIso).slice(0, 10).split('-');
      var s = qualificacao(sub, false), t = qualificacao(subst, true);
      var dia = String(hoje.getDate()), mes = MESEXT[hoje.getMonth()], ano = String(hoje.getFullYear());
      var d = {
        numero: p.numero,
        obs: p.obs || '',
        data_permuta: dp[2] ? dp[2] + '/' + dp[1] + '/' + dp[0] : '',
        turno_diurno: xis(parte === 'diurno'),
        turno_noturno: xis(parte === 'noturno'),
        turno_NOTURNO: xis(parte === 'noturno'),
        dia: dia, mes_completo: mes, ano: ano,
        manaus_dia: dia, manaus_mes: mes, manaus_ano: ano
      };
      Object.keys(s).forEach(function (k) { d['s_' + k] = s[k]; });
      Object.keys(t).forEach(function (k) { d['t_' + k] = t[k]; });
      return d;
    }
    function preencher(buf, data, nomeArq) {
      var Dx = window.docxtemplater || window.Docxtemplater;
      var doc = new Dx(new window.PizZip(buf), { paragraphLoop: true, linebreaks: true, nullGetter: function () { return ''; } });
      doc.render(data);
      var blob = doc.getZip().generate({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = nomeArq;
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    }
    function baixarWord(id) {
      var p = S.permutaPorId(id); if (!p) return;
      var Ap = S.funcionarioPorNome(p.pessoa_a) || {}, Bp = S.funcionarioPorNome(p.pessoa_b) || {};
      A.toast('Gerando Word…');
      libsDoc()
        .then(function () { return fetch('termos/permuta-modelo.docx', { cache: 'reload' }); })
        .then(function (r) { if (!r.ok) throw new Error('SEM_MODELO'); return r.arrayBuffer(); })
        .then(function (buf) {
          var h = new Uint8Array(buf.slice(0, 4));
          if (!(h[0] === 0x50 && h[1] === 0x4B)) throw new Error('SEM_MODELO'); // não é um .docx (ZIP)
          preencher(buf, dadosDoc(Ap, Bp, p.turno_a_data, p.turno_a_parte, p), p.numero + '.docx');
          if (p.mao_dupla === 'sim' && p.turno_b_inicio) {
            setTimeout(function () {
              preencher(buf.slice(0), dadosDoc(Bp, Ap, p.turno_b_data, p.turno_b_parte, p), p.numero + '-parte-B.docx');
            }, 600);
          }
          A.toast('Word gerado', 'sucesso');
        })
        .catch(function (e) {
          if (String(e.message) === 'SEM_MODELO') {
            A.toast('Falta o arquivo web/termos/permuta-modelo.docx (veja termos/COMO-CRIAR-O-MODELO.md)', 'erro');
            return;
          }
          var det = e && e.properties && e.properties.errors
            ? e.properties.errors.map(function (x) { return (x.properties && (x.properties.explanation || x.properties.id)) || x.message; }).join(' | ')
            : (e.message || e);
          console.error('docxtemplater', e);
          A.toast('Erro no modelo Word: ' + det, 'erro');
        });
    }

    var CARGO_L = { investigador: 'Investigador de Polícia', delegado: 'Delegado de Polícia', diretor: 'Diretor', administrador: 'Administrador' };
    var PLNUM = { 'PL I': 1, 'PL II': 2, 'PL III': 3, 'PL IV': 4, 'PL V': 5 };
    var MESEXT = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

    function box(v) { return '<span class="cx">(' + (v ? ' X ' : '&nbsp;&nbsp;&nbsp;') + ')</span>'; }
    function lin(v) { return '<u>&nbsp;' + A.esc(v || '') + '&nbsp;</u>'; }
    function plCaixas(pl, comExp) {
      var n = PLNUM[pl] || 0;
      var s = '';
      for (var i = 1; i <= 5; i++) s += box(n === i) + 'P' + i + '&nbsp;&nbsp;';
      if (comExp) s += box(!n) + 'EXPEDIENTE';
      return s;
    }
    function bloco(f, tit) {
      return '<p class="sec">' + tit + '</p>' +
        '<p class="fld">' + lin(f.nome_completo || f.nome_curto || '') + '</p>' +
        '<p class="fld"><b>CARGO:</b> ' + lin(CARGO_L[f.cargo] || f.cargo || '') +
          ' &nbsp;&nbsp; <b>MATRÍCULA:</b> ' + lin(f.matricula || '') + '</p>' +
        '<p class="fld"><b>LOTAÇÃO:</b> ' + lin(S.config('lotacao') || '') + '</p>' +
        '<p class="fld"><b>NÚMERO DO PLANTÃO:</b> ' + plCaixas(f.plantao, tit.indexOf('SUBSTITUTO') >= 0) + '</p>' +
        '<p class="fld"><b>CELULAR:</b> ' + lin(f.celular || '') + '</p>';
    }
    function formOficial(sub, subst, dataIso, parte, p) {
      var hoje = new Date();
      var dp = String(dataIso).slice(0, 10).split('-');
      return '<div class="termo-oficial">' +
        '<p class="cab">EXCELENTÍSSIMO SENHOR DIRETOR DO DEPARTAMENTO DE ATIVIDADES POLICIAIS</p>' +
        '<p class="just">Os(As) Servidores(as) abaixo qualificados(as) vêm, à presença de Vossa Excelência, ' +
        'nos Termos do Direito Público, assegurados no artigo 155 e seguintes, da Lei nº 2271/94 – Estatuto ' +
        'do Policial Civil do Amazonas, requerer <b>PERMUTA DE PLANTÃO</b>:</p>' +
        '<p class="dt"><b>DATA DA PERMUTA:</b> ' + lin(dp[2] ? dp[2] + '/' + dp[1] + '/' + dp[0] : '') + ' &nbsp; ' +
          box(parte === 'diurno') + ' 8h às 20h &nbsp;&nbsp; ' + box(parte === 'noturno') + ' 20h às 8h</p>' +
        bloco(sub, 'NOME DO REQUERENTE A SER SUBSTITUÍDO (QUEM SERÁ SUBSTITUÍDO):') +
        bloco(subst, 'NOME DO REQUERENTE SUBSTITUTO:') +
        '<p class="ped">Nestes Termos, pede Deferimento. &nbsp; Manaus, ' + lin('' + hoje.getDate()) +
          ' de ' + lin(MESEXT[hoje.getMonth()]) + ' de ' + lin('' + hoje.getFullYear()) + '.</p>' +
        (p.obs ? '<p class="fld"><b>Observação:</b> ' + A.esc(p.obs) + '</p>' : '') +
        '<div class="assin">' +
          '<div>_____________________________________<br>ASSINATURA DO REQUERENTE A SER SUBSTITUÍDO<br>' +
            '_____________________________________<br>ASSINATURA DO REQUERENTE SUBSTITUTO</div>' +
          '<div class="ciente">Ciente:<br><br><br>_____________________________<br>DIRETOR DO DEPARTAMENTO<br>(carimbo e assinatura)</div>' +
        '</div>' +
        '<p class="obs"><b>OBS1:</b> PEDIDOS DE PERMUTA DE PLANTÃO DEVERÃO SER FEITOS NO PRAZO MÍNIMO DE 2 DIAS ÚTEIS DE ANTECEDÊNCIA À DATA DO PLANTÃO.</p>' +
        '<p class="obs"><b>OBS2:</b> NÃO SERÃO ACEITOS PEDIDOS DE PERMUTA DE PLANTÃO ENVIADOS POR E-MAIL.</p>' +
        '<p class="rodape">CENTRO INTEGRADO DE COMANDO E CONTROLE · Avenida André Araújo · Fone: (92) 3612-3122 · ' +
          'Manaus – AM – CEP 69067-375 · Departamento de Atividades Policiais &nbsp; | &nbsp; ' + p.numero + '</p>' +
        '</div>';
    }

    ['#p-a', '#p-b'].forEach(function (s) { $(s).addEventListener('change', s === '#p-a' ? atualB : function () { $('#p-lb').textContent = $('#p-b').value; turnos(); }); });
    $('#p-dupla').addEventListener('change', function () { $('#p-wtb').hidden = !$('#p-dupla').checked; });
    $('#p-propor').addEventListener('click', propor);
    render();
  }

  A.registrarTela('permuta', { titulo: 'PERMUTA', icone: '🔄', desc: 'Trocar turno com aprovação e termo', acesso: 'todos', montar: montar, contador: contador });
})();
