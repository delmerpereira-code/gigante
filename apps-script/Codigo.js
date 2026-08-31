/* ============================================================================
 *  Codigo.js — API JSON do Controle de Plantão (Google Apps Script Web App)
 *
 *  Deploy:  clasp push && clasp deploy
 *  O front (GitHub Pages) chama:
 *    GET  <URL>?acao=escala&mes=9&ano=2026
 *    POST <URL>   body = JSON string, Content-Type: text/plain  (evita preflight CORS)
 *                 { acao: "salvarFuncionario", token: "...", dados: {...} }
 * ==========================================================================*/

// >>> PREENCHER com o ID da planilha nova <<<
var SHEET_ID = 'COLOQUE_AQUI_O_ID_DA_PLANILHA';

var ABAS = {
  Funcionarios: ['id', 'matricula', 'nome_completo', 'nome_curto', 'foto', 'celular', 'celular2',
                 'nascimento', 'cargo', 'regime', 'plantao', 'lider', 'admissao', 'status',
                 'saldo_inicial_banco', 'dias_ferias_ano'],
  Plantoes:     ['codigo', 'pessoa_1', 'pessoa_2'],
  Config:       ['chave', 'valor'],
  Eventos:      ['id', 'tipo', 'pessoa', 'substituto', 'inicio', 'fim', 'irregular', 'nivel', 'obs'],
  BancoHoras:   ['data_hora', 'pessoa', 'sentido', 'horas', 'motivo', 'evento_id', 'saldo_resultante'],
  _USUARIOS:    ['Usuario', 'Senha', 'Nome', 'Perfil', 'Ativo']
};

var CONFIG_DEFAULT = [
  ['ancora_rotacao', '2026-09-01'],
  ['ordem_rotacao', 'PL IV;PL V;PL I;PL II;PL III'],
  ['mult_folga_perdida', '1'],
  ['fator_convocacao', '1'],
  ['credito_sobreaviso', '0'],
  ['dias_ferias_padrao', '30'],
  ['antecedencia_ferias_dias', '30'],
  ['permuta_prazo_horas', '12']
];

// ─── infra ──────────────────────────────────────────────────────────────────
function _ss() { return SpreadsheetApp.openById(SHEET_ID); }
function _sh(nome) { return _ss().getSheetByName(nome); }

function _json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function _linhas(nome) {
  var sh = _sh(nome);
  if (!sh) return [];
  var data = sh.getDataRange().getValues();
  if (data.length < 2) return [];
  var h = data[0];
  return data.slice(1).map(function (r) {
    var o = {};
    h.forEach(function (col, i) { o[col] = r[i]; });
    return o;
  });
}

// ─── config da rotação (lida da aba Config) ─────────────────────────────────
function configRotacao() {
  var map = {};
  _linhas('Config').forEach(function (r) { map[r.chave] = r.valor; });
  return {
    ancora: map.ancora_rotacao || '2026-09-01',
    ordem: (map.ordem_rotacao || 'PL IV;PL V;PL I;PL II;PL III').split(';').map(function (s) { return s.trim(); }),
    multFolgaPerdida: Number(map.mult_folga_perdida || 1),
    fatorConvocacao: Number(map.fator_convocacao || 1),
    creditoSobreaviso: Number(map.credito_sobreaviso || 0)
  };
}

// ─── setup: cria abas e cabeçalhos que faltarem ────────────────────────────
function setupPlanilha() {
  var ss = _ss();
  Object.keys(ABAS).forEach(function (nome) {
    var sh = ss.getSheetByName(nome) || ss.insertSheet(nome);
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, ABAS[nome].length).setValues([ABAS[nome]]);
    }
  });
  var cfg = _sh('Config');
  if (cfg.getLastRow() < 2) {
    cfg.getRange(2, 1, CONFIG_DEFAULT.length, 2).setValues(CONFIG_DEFAULT);
  }
  return 'Planilha configurada.';
}

// ─── roteamento ────────────────────────────────────────────────────────────
function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    switch (p.acao) {
      case 'escala':      return _json(acaoEscala(Number(p.mes), Number(p.ano)));
      case 'config':      return _json(configRotacao());
      case 'funcionarios': return _json(_linhas('Funcionarios'));
      case 'plantoes':    return _json(_linhas('Plantoes'));
      case 'estado':      return _json(acaoEstado(p.data));
      case 'ping':        return _json({ ok: true, agora: new Date() });
      default:            return _json({ ok: false, erro: 'acao desconhecida: ' + p.acao });
    }
  } catch (err) {
    return _json({ ok: false, erro: String(err) });
  }
}

function doPost(e) {
  var body;
  try { body = JSON.parse(e.postData.contents); }
  catch (err) { return _json({ ok: false, erro: 'JSON inválido' }); }

  try {
    switch (body.acao) {
      case 'login':               return _json(login(body.usuario, body.senha));
      case 'salvarFuncionario':   return _json(salvarFuncionario(body.dados));
      case 'salvarEvento':        return _json(salvarEvento(body.dados));
      case 'avaliarConvocacao':   return _json(
        avaliarConvocacao(body.plantao, body.instante, body.horasTrabalhadas));
      default:                    return _json({ ok: false, erro: 'acao desconhecida: ' + body.acao });
    }
  } catch (err) {
    return _json({ ok: false, erro: String(err) });
  }
}

// ─── ações ────────────────────────────────────────────────────────────────
function acaoEscala(mes, ano) {
  var cfg = configRotacao();
  var totalDias = new Date(ano, mes, 0).getDate(); // mes 1-based
  var dias = [];
  for (var d = 1; d <= totalDias; d++) {
    var data = new Date(ano, mes - 1, d);
    dias.push(turnosDoDia(data, cfg));
  }
  return { mes: mes, ano: ano, dias: dias, config: cfg };
}

function acaoEstado(dataStr) {
  var cfg = configRotacao();
  var inst = new Date(String(dataStr) + 'T08:30:00');
  return cfg.ordem.map(function (pl) { return estadoEm(pl, inst, cfg); });
}

function login(usuario, senha) {
  var us = _linhas('_USUARIOS');
  for (var i = 0; i < us.length; i++) {
    var r = us[i];
    if (String(r.Usuario).trim() === String(usuario).trim() &&
        String(r.Senha).trim() === String(senha).trim() &&
        String(r.Ativo).trim().toUpperCase() === 'SIM') {
      return { ok: true, nome: r.Nome, perfil: r.Perfil };
    }
  }
  return { ok: false, erro: 'Usuário ou senha inválidos.' };
}

function salvarFuncionario(dados) {
  var sh = _sh('Funcionarios');
  var h = ABAS.Funcionarios;
  var id = dados.id || Utilities.getUuid().substring(0, 8).toUpperCase();
  var linha = h.map(function (c) { return c === 'id' ? id : (dados[c] != null ? dados[c] : ''); });

  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      sh.getRange(i + 1, 1, 1, h.length).setValues([linha]);
      return { ok: true, id: id, modo: 'atualizado' };
    }
  }
  sh.appendRow(linha);
  return { ok: true, id: id, modo: 'criado' };
}

function salvarEvento(dados) {
  var sh = _sh('Eventos');
  var h = ABAS.Eventos;
  var id = dados.id || Utilities.getUuid().substring(0, 8).toUpperCase();
  var linha = h.map(function (c) { return c === 'id' ? id : (dados[c] != null ? dados[c] : ''); });
  sh.appendRow(linha);
  // TODO: se dados.tipo === 'convocacao', chamar avaliarConvocacao e lançar em BancoHoras.
  return { ok: true, id: id };
}
