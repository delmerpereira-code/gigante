/* ============================================================================
 *  sync.js — Ponte entre store.js (cache em memória) e o Supabase.
 *  Carregar DEPOIS de: rotacao.js, db.js, store.js.
 *
 *  Sem web/config.js preenchido → modo LOCAL (não faz nada; store.js segue
 *  usando localStorage). Com config → modo BANCO:
 *    - Sync.iniciar()  puxa tudo do Supabase para o cache do store;
 *    - leituras continuam síncronas (Store.funcionarios(), etc.);
 *    - escritas de cadastro/eventos/banco reconciliam com o servidor em 2º plano;
 *    - permuta usa as funções (RPC) do Postgres.
 * ==========================================================================*/
(function (root) {
  'use strict';

  var Store = root.Store, DB = root.DB;

  var Sync = {
    modo: 'local',
    iniciar: function () { return Promise.resolve({ logado: true, modo: 'local' }); },
    eu: function () { return null; },
    sair: function () { return Promise.resolve(); },
    criarLogin: function () { return Promise.reject(new Error('Modo local — sem contas de login.')); },
    trocarSenha: function () { return Promise.reject(new Error('Modo local — sem contas de login.')); }
  };
  root.Sync = Sync;

  if (!Store || !DB || !DB.configurado) return;   // modo local
  Sync.modo = 'db';
  Store._skipExpiry = true;

  var _euAuth = null;        // user do Supabase
  var _remoto = null;        // último snapshot conhecido do servidor (forma do cache)
  var _push = null;          // Promessa da fila de push

  // ─── conversões DB ⇄ cache ───────────────────────────────────────────────
  function nomeDe(id) { if (!id) return ''; var f = Store.funcionarioPorId(id); return f ? f.nome_curto : ''; }
  function idDe(nome) { if (!nome) return null; var f = Store.funcionarioPorNome(nome); return f ? f.id : null; }
  function d10(v) { return v ? String(v).slice(0, 10) : null; }
  function uuidValido(v) { return typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v); }

  var REGIME_CACHE = { plantao: 'plantao', coringa: 'coringa', expediente: 'expediente', externo: '' };
  var REGIME_DB = { plantao: 'plantao', coringa: 'coringa', expediente: 'expediente', '': 'externo', externo: 'externo' };

  function funcCache(r) {
    return {
      id: r.id, matricula: r.matricula || '', nome_completo: r.nome_completo || '',
      nome_curto: r.nome_curto, foto: r.foto || '', email: r.email || '',
      celular: r.celular || '', celular2: r.celular2 || '',
      nascimento: d10(r.nascimento) || '', cargo: r.cargo,
      regime: REGIME_CACHE[r.regime] != null ? REGIME_CACHE[r.regime] : '',
      plantao: r.plantao || '', lider: r.lider ? 'sim' : 'nao', oculto: r.oculto ? 'sim' : 'nao',
      admissao: d10(r.admissao) || '', status: r.status,
      saldo_inicial_banco: Number(r.saldo_inicial_banco) || 0,
      dias_ferias_ano: Number(r.dias_ferias_ano) || 30, auth_user_id: r.auth_user_id || null
    };
  }
  function funcDB(f) {
    var o = {
      id: f.id, matricula: f.matricula || null, nome_completo: f.nome_completo || '',
      nome_curto: f.nome_curto, foto: f.foto || '', email: f.email || '',
      celular: f.celular || '', celular2: f.celular2 || '',
      nascimento: d10(f.nascimento), cargo: f.cargo, regime: REGIME_DB[f.regime] || 'externo',
      plantao: f.plantao || '', lider: f.lider === 'sim', oculto: f.oculto === 'sim',
      admissao: d10(f.admissao),
      status: f.status, saldo_inicial_banco: Number(f.saldo_inicial_banco) || 0,
      dias_ferias_ano: Number(f.dias_ferias_ano) || 30
    };
    // só manda auth_user_id quando é um UUID de verdade — nunca sobrescreve com null
    if (f.auth_user_id && uuidValido(f.auth_user_id)) o.auth_user_id = f.auth_user_id;
    return o;
  }

  function evtCache(r) {
    return {
      id: r.id, tipo: r.tipo, pessoa: nomeDe(r.funcionario_id), substituto: nomeDe(r.substituto_id),
      plantao: r.plantao || '',
      inicio: r.inicio, fim: r.fim, irregular: r.irregular ? 'sim' : 'nao',
      nivel: r.nivel || '', obs: r.obs || '',
      situacao: r.situacao || '', justificativa: r.justificativa || '', decidido_por: r.decidido_por || ''
    };
  }
  function evtDB(e) {
    return {
      id: e.id, tipo: e.tipo, funcionario_id: idDe(e.pessoa),
      substituto_id: idDe(e.substituto), plantao: e.plantao || null, inicio: e.inicio, fim: e.fim,
      irregular: e.irregular === 'sim', nivel: e.nivel || null, obs: e.obs || '',
      situacao: e.situacao || null, justificativa: e.justificativa || '', decidido_por: e.decidido_por || ''
    };
  }

  function bhCache(r, i) {
    return {
      id: r.id, seq: i + 1, data_hora: r.data_hora, pessoa: nomeDe(r.funcionario_id),
      sentido: r.sentido, horas: Number(r.horas), motivo: r.motivo, evento_id: r.evento_id || '',
      saldo_resultante: Number(r.saldo_resultante) || 0, obs: r.obs || ''
    };
  }
  function bhDB(l) {
    return {
      id: l.id, data_hora: l.data_hora, funcionario_id: idDe(l.pessoa),
      sentido: l.sentido, horas: Number(l.horas) || 0, motivo: l.motivo,
      evento_id: l.evento_id || null, obs: l.obs || ''
    };
  }

  function permCache(r, hist) {
    return {
      id: r.id, numero: r.numero, pessoa_a: nomeDe(r.pessoa_a_id), pessoa_b: nomeDe(r.pessoa_b_id),
      turno_a_data: r.turno_a_data, turno_a_parte: r.turno_a_parte,
      turno_a_inicio: r.turno_a_inicio, turno_a_fim: r.turno_a_fim,
      mao_dupla: r.mao_dupla ? 'sim' : 'nao',
      turno_b_data: r.turno_b_data || '', turno_b_parte: r.turno_b_parte || '',
      turno_b_inicio: r.turno_b_inicio || '', turno_b_fim: r.turno_b_fim || '',
      obs: r.obs || '', estado: r.estado, criada_em: r.criada_em,
      historico: (hist || []).filter(function (h) { return h.permuta_id === r.id; })
        .sort(function (a, b) { return String(a.quando).localeCompare(String(b.quando)); })
        .map(function (h) { return { quando: h.quando, quem: h.quem, texto: h.texto }; })
    };
  }
  function cpCache(r) {
    return {
      id: r.id, data: r.data, de: nomeDe(r.de_id), para: nomeDe(r.para_id),
      horas: Number(r.horas), tipo: r.tipo, permuta_id: r.permuta_id || '', obs: r.obs || ''
    };
  }

  // ─── carga ───────────────────────────────────────────────────────────────
  function pull() {
    return DB.rpc('permutas_expirar').catch(function () {}).then(function () {
      return Promise.all([
        DB.all('funcionarios'), DB.all('config'), DB.all('eventos'),
        DB.all('banco_horas'), DB.all('permutas'),
        DB.all('permuta_historico'), DB.all('conta_permutas')
      ]);
    }).then(function (res) {
      var fs = res[0], cfg = res[1], evs = res[2], bh = res[3], pms = res[4], hist = res[5], cp = res[6];
      bh.sort(function (a, b) {
        var c = String(a.data_hora).localeCompare(String(b.data_hora));
        return c !== 0 ? c : String(a.id).localeCompare(String(b.id));
      });
      var cfgObj = {}; cfg.forEach(function (c) { cfgObj[c.chave] = c.valor; });

      // 1ª passada: só funcionários + config (para resolver nomes)
      Store._carregarSnapshot({ Funcionarios: fs.map(funcCache), Config: cfgObj }, true);
      // 2ª passada: tudo
      Store._carregarSnapshot({
        Funcionarios: fs.map(funcCache), Config: cfgObj,
        Eventos: evs.map(evtCache),
        BancoHoras: bh.map(bhCache),
        Permutas: pms.map(function (p) { return permCache(p, hist); }),
        ContaPermutas: cp.map(cpCache)
      }, true);
      _remoto = Store._snapshot();
      cacheOffline();
    });
  }

  // cache offline no localStorage (só leitura, para quando cair a rede)
  function cacheOffline() {
    try { localStorage.setItem('plantao_offline', JSON.stringify(Store._snapshot())); } catch (e) {}
  }
  function carregarOffline() {
    try {
      var t = localStorage.getItem('plantao_offline');
      if (t) { Store._carregarSnapshot(JSON.parse(t), true); return true; }
    } catch (e) {}
    return false;
  }

  // ─── reconciliação (empurra cadastro/eventos/banco para o servidor) ───────
  function difTabela(atual, remoto, toDB) {
    var rem = {}; (remoto || []).forEach(function (x) { rem[x.id] = x; });
    var ups = [], dels = [];
    atual.forEach(function (x) {
      var alvo = toDB(x), r = rem[x.id];
      if (!r || JSON.stringify(alvo) !== JSON.stringify(toDB(r))) ups.push(alvo);
      delete rem[x.id];
    });
    Object.keys(rem).forEach(function (k) { if (uuidValido(k)) dels.push(k); });
    return { ups: ups, dels: dels };
  }

  function empurrar() {
    var atual = Store._snapshot(), rem = _remoto || {};
    var jobs = [];

    // config
    var cfgAtual = atual.Config || {}, cfgRem = rem.Config || {};
    Object.keys(cfgAtual).forEach(function (k) {
      if (cfgAtual[k] !== cfgRem[k]) jobs.push(DB.upsertConfig(k, cfgAtual[k]));
    });

    [['funcionarios', 'Funcionarios', funcDB],
     ['eventos', 'Eventos', evtDB],
     ['banco_horas', 'BancoHoras', bhDB]].forEach(function (t) {
      var d = difTabela(atual[t[1]] || [], rem[t[1]] || [], t[2]);
      d.ups.forEach(function (row) {
        jobs.push(DB.client.from(t[0]).upsert(row).then(function (r) { if (r.error) throw r.error; }));
      });
      d.dels.forEach(function (id) { jobs.push(DB.remove(t[0], id)); });
    });

    return Promise.all(jobs).then(function () { return pull(); });
  }

  function agendarPush() {
    if (_push) { _push._again = true; return _push; }
    var p = _push = new Promise(function (resolve) {
      setTimeout(function () {
        var again = _push && _push._again;
        empurrar().then(function () {
          _push = null; resolve();
          if (again) agendarPush();
        }).catch(function (e) {
          _push = null;
          if (Store.onErro) Store.onErro('Não foi possível salvar no servidor: ' + (e.message || e));
          pull().then(resolve, resolve);   // servidor manda
        });
      }, 300);
    });
    return p;
  }

  // ─── envolve as escritas do Store ────────────────────────────────────────
  ['salvarFuncionario', 'removerFuncionario', 'salvarEvento', 'removerEvento', 'decidirFerias',
   'ajusteManual', 'removerLancamento', 'setConfig', 'seedElencoExemplo',
   'limparTudo', 'importar'].forEach(function (m) {
    var orig = Store[m];
    Store[m] = function () {
      var r = orig.apply(Store, arguments);   // muta o cache (lógica local intacta)
      var pushed = agendarPush();
      if (r && typeof r.then === 'function') return r;
      return r;   // mantém retorno síncrono; o push acontece em 2º plano
    };
  });

  // ─── permuta: via RPC do Postgres ────────────────────────────────────────
  function rpcThenPull(fn, args) { return DB.rpc(fn, args).then(function (x) { return pull().then(function () { return x; }); }); }

  Store.proporPermuta = function (dados) {
    var maoDupla = dados.mao_dupla === 'sim';
    var tA = dados.turno_a || {}, tB = dados.turno_b || {};
    var a = Store.funcionarioPorNome(dados.pessoa_a), b = Store.funcionarioPorNome(dados.pessoa_b);
    if (!a || !b) return Promise.reject(new Error('Pessoa não encontrada.'));
    return rpcThenPull('permuta_propor', {
      p_a: a.id, p_b: b.id,
      ta_data: tA.data, ta_parte: tA.parte,
      ta_inicio: new Date(tA.inicio).toISOString(), ta_fim: new Date(tA.fim).toISOString(),
      dupla: maoDupla,
      tb_data: maoDupla ? tB.data : null, tb_parte: maoDupla ? tB.parte : null,
      tb_inicio: maoDupla ? new Date(tB.inicio).toISOString() : null,
      tb_fim: maoDupla ? new Date(tB.fim).toISOString() : null,
      nota: dados.obs || ''
    });
  };
  // líder não aprova permuta: 'aprovar' e 'confirmar' são a mesma transição
  Store.aprovarPermuta  = function (id) { return rpcThenPull('permuta_confirmar', { p_id: id }); };
  Store.rejeitarPermuta = function (id, quem, motivo) { return rpcThenPull('permuta_recusar', { p_id: id }); };
  Store.confirmarPermuta = function (id) { return rpcThenPull('permuta_confirmar', { p_id: id }); };
  Store.recusarPermuta  = function (id) { return rpcThenPull('permuta_recusar',  { p_id: id }); };
  Store.cancelarPermuta = function (id) { return rpcThenPull('permuta_cancelar', { p_id: id }); };
  Store.concluirPermuta = function (id) { return rpcThenPull('permuta_concluir', { p_id: id }); };
  Store.quitarPermuta = function (de, para, h, obs) {
    return rpcThenPull('permuta_quitar', { de: idDe(de), para: idDe(para), h: Number(h), nota: obs || '' });
  };

  // ─── sessão / bootstrap ──────────────────────────────────────────────────
  Sync.eu = function () {
    if (!_euAuth) return null;
    return Store.funcionarios().filter(function (f) { return f.auth_user_id === _euAuth.id; })[0] || null;
  };
  Sync.sair = function () { return DB.sair(); };
  Sync.criarLogin = function (email, senha) { return DB.criarLogin(email, senha); };
  Sync.trocarSenha = function (nova) { return DB.trocarMinhaSenha(nova); };

  Sync.iniciar = function () {
    return DB.sessao().then(function (s) {
      if (!s) return { logado: false };
      _euAuth = s.user;
      return pull().then(function () {
        var eu = Sync.eu();
        if (eu) {
          var gestao = eu.lider === 'sim' || eu.cargo === 'administrador';
          Store.setVerComo(gestao ? 'Lider' : eu.nome_curto);
        }
        return { logado: true, modo: 'db', eu: eu, semVinculo: !eu };
      }).catch(function (e) {
        if (carregarOffline()) return { logado: true, modo: 'offline', erro: e.message };
        throw e;
      });
    });
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
