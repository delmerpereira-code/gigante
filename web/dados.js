/* ============================================================================
 *  dados.js — Config da rotação + backup/restauração dos dados locais.
 * ==========================================================================*/
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  function carregarCfg() {
    var c = Store.configTodos();
    $('cAncora').value = c.ancora_rotacao;
    $('cOrdem').value = c.ordem_rotacao;
    $('cMultFolga').value = c.mult_folga_perdida;
    $('cFatorConv').value = c.fator_convocacao;
    $('cCredSob').value = c.credito_sobreaviso;
    $('cDiasFerias').value = c.dias_ferias_padrao;
    $('cAntecedFerias').value = c.antecedencia_ferias_dias;
    $('cPermutaPrazo').value = c.permuta_prazo_horas;
  }

  function salvarCfg(e) {
    e.preventDefault();
    Store.setConfig('ancora_rotacao', $('cAncora').value);
    Store.setConfig('ordem_rotacao', $('cOrdem').value);
    Store.setConfig('mult_folga_perdida', $('cMultFolga').value);
    Store.setConfig('fator_convocacao', $('cFatorConv').value);
    Store.setConfig('credito_sobreaviso', $('cCredSob').value);
    Store.setConfig('dias_ferias_padrao', $('cDiasFerias').value);
    Store.setConfig('antecedencia_ferias_dias', $('cAntecedFerias').value);
    Store.setConfig('permuta_prazo_horas', $('cPermutaPrazo').value);
    var m = $('cfgMsg');
    m.textContent = 'Parâmetros salvos. Eventos já lançados não são recalculados automaticamente.';
    setTimeout(function () { m.textContent = ''; }, 4000);
  }

  function exportar() {
    var txt = Store.exportar();
    $('dump').value = txt;
    try {
      var blob = new Blob([txt], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'plantao-backup-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e) { /* em file:// alguns navegadores bloqueiam; o textarea serve de fallback */ }
  }

  function importar(ev) {
    var file = ev.target.files[0];
    if (!file) return;
    var fr = new FileReader();
    fr.onload = function () {
      try {
        Store.importar(fr.result);
        alert('Backup restaurado.');
        carregarCfg();
      } catch (e) {
        alert('Arquivo inválido: ' + e.message);
      }
      ev.target.value = '';
    };
    fr.readAsText(file);
  }

  document.addEventListener('dados-prontos', function () {
    if (!Store.ehLider()) {
      document.querySelector('main').innerHTML =
        '<section class="card"><h2>Acesso restrito</h2><p class="muted">' +
        'Configuração e backup são do Líder. Use <b>"Ver como" → Líder</b> no topo.</p></section>';
      return;
    }
    carregarCfg();
    $('formCfg').addEventListener('submit', salvarCfg);
    $('btnExport').addEventListener('click', exportar);
    $('fileImport').addEventListener('change', importar);
    var modoBanco = window.Sync && Sync.modo === 'db';
    if (modoBanco) {
      $('btnSeed').style.display = 'none';
      $('btnWipe').style.display = 'none';
    } else {
      $('btnSeed').addEventListener('click', function () {
        if (confirm('Isto substitui TODOS os dados atuais pelo elenco de exemplo. Continuar?')) {
          Store.seedElencoExemplo(); carregarCfg(); alert('Elenco de exemplo carregado.');
        }
      });
      $('btnWipe').addEventListener('click', function () {
        if (confirm('Apagar TODOS os funcionários, eventos e lançamentos deste navegador?')) {
          Store.limparTudo(); carregarCfg(); $('dump').value = ''; alert('Dados apagados.');
        }
      });
    }
  });
})();
