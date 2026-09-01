/* ============================================================================
 *  store.js — Camada de dados local (localStorage) do Controle de Plantão.
 *
 *  Espelha as abas da planilha (docs/ESPECIFICACAO.md §8). Quando a API do
 *  Apps Script entrar, cada coleção aqui vira uma aba — os nomes de campo são
 *  os mesmos, então a migração é só despejar os arrays nas abas.
 *
 *  Funciona no navegador e no Node (fallback em memória) para os testes.
 * ==========================================================================*/
(function (root) {
  'use strict';

  var R = (typeof require !== 'undefined')
    ? (function () { try { return require('./rotacao.js'); } catch (e) { return root.Rotacao; } })()
    : root.Rotacao;

  var KEY = 'plantao_v1';
  var VC_KEY = 'plantao_vercomo';
  var memoria = null;   // fallback quando não há localStorage
  var memoriaVC = null;
  var MS_DIA = 24 * 3600 * 1000;

  // ─── persistência bruta ────────────────────────────────────────────────────
  function lerBruto(k) {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) return localStorage.getItem(k);
    } catch (e) { /* ignore */ }
    return k === VC_KEY ? memoriaVC : memoria;
  }
  function gravarBruto(k, txt) {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) { localStorage.setItem(k, txt); return; }
    } catch (e) { /* ignore */ }
    if (k === VC_KEY) memoriaVC = txt; else memoria = txt;
  }

  function vazio() {
    return {
      Funcionarios: [], Config: {}, Eventos: [], BancoHoras: [],
      Permutas: [], ContaPermutas: [],
      _seq: 0, _permutaSeq: {}
    };
  }

  function carregar() {
    var txt = lerBruto(KEY);
    if (!txt) return vazio();
    try {
      var db = JSON.parse(txt);
      var base = vazio();
      for (var k in base) if (!(k in db)) db[k] = base[k];
      db.Funcionarios = (db.Funcionarios || []).map(migrarFuncionario);
      return db;
    } catch (e) { return vazio(); }
  }

  var _db = carregar();

  function salvar() {
    recomputar(_db);
    gravarBruto(KEY, JSON.stringify(_db));
  }

  // ─── helpers ──────────────────────────────────────────────────────────────
  /** UUID v4 — funciona em qualquer contexto (http, file://, celular). */
  function uid() {
    try { if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID(); } catch (e) { /* */ }
    var b = new Array(16), rnd;
    try {
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        var a = new Uint8Array(16); crypto.getRandomValues(a);
        for (var i = 0; i < 16; i++) b[i] = a[i];
      } else { throw 0; }
    } catch (e2) {
      for (var j = 0; j < 16; j++) b[j] = Math.floor(Math.random() * 256);
    }
    b[6] = (b[6] & 0x0f) | 0x40;   // versão 4
    b[8] = (b[8] & 0x3f) | 0x80;   // variante
    var h = b.map(function (n) { return (n + 0x100).toString(16).slice(1); });
    return h[0] + h[1] + h[2] + h[3] + '-' + h[4] + h[5] + '-' + h[6] + h[7] + '-' +
           h[8] + h[9] + '-' + h[10] + h[11] + h[12] + h[13] + h[14] + h[15];
  }
  function r2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
  function horasEntre(ini, fim) { return (new Date(fim) - new Date(ini)) / 3600000; }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function parseDia(v) {
    if (v instanceof Date) return v;
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));
    if (m) return new Date(+m[1], +m[2] - 1, +m[3], 12, 0, 0); // meio-dia local, sem surpresa de fuso
    return new Date(v);
  }
  function meiaNoite(d) { var x = parseDia(d); return new Date(x.getFullYear(), x.getMonth(), x.getDate()); }
  function isoData(d) {
    var x = new Date(d);
    return x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate());
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function sobrepoe(aIni, aFim, bIni, bFim) {
    return new Date(aIni) <= new Date(bFim) && new Date(bIni) <= new Date(aFim);
  }
  function cobreDia(evIni, evFim, dia) {
    var d0 = meiaNoite(dia).getTime();
    return meiaNoite(evIni).getTime() <= d0 && meiaNoite(evFim).getTime() >= d0;
  }
  function diasInclusive(ini, fim) {
    return Math.max(1, Math.round((meiaNoite(fim) - meiaNoite(ini)) / MS_DIA) + 1);
  }

  // ─── Config / rotação ─────────────────────────────────────────────────────
  var CFG_DEFAULT = {
    ancora_rotacao: (R && R.CONFIG_PADRAO.ancora) || '2026-09-01',
    ordem_rotacao: ((R && R.CONFIG_PADRAO.ordem) || ['PL IV', 'PL V', 'PL I', 'PL II', 'PL III']).join(';'),
    mult_folga_perdida: '1',
    fator_convocacao: '1',
    credito_sobreaviso: '0',
    dias_ferias_padrao: '30',
    antecedencia_ferias_dias: '30',
    permuta_prazo_horas: '12',
    comunicado: '',
    lotacao: 'Departamento de Atividades Policiais'
  };

  function config(chave) {
    return (chave in _db.Config) ? _db.Config[chave] : CFG_DEFAULT[chave];
  }
  function setConfig(chave, valor) { _db.Config[chave] = String(valor); salvar(); }
  function configTodos() {
    var o = {};
    Object.keys(CFG_DEFAULT).forEach(function (k) { o[k] = config(k); });
    return o;
  }
  function rotacaoConfig() {
    return {
      ancora: config('ancora_rotacao'),
      ordem: String(config('ordem_rotacao')).split(';').map(function (s) { return s.trim(); }).filter(Boolean),
      multFolgaPerdida: Number(config('mult_folga_perdida')) || 0,
      fatorConvocacao: Number(config('fator_convocacao')) || 0,
      creditoSobreaviso: Number(config('credito_sobreaviso')) || 0
    };
  }

  // ─── "Ver como" (papel da sessão, simulado) ───────────────────────────────
  //  'Lider' sintético = acesso total. Um funcionário com lider='sim' idem.
  function verComo() { return lerBruto(VC_KEY) || 'Lider'; }
  function setVerComo(v) { gravarBruto(VC_KEY, v || 'Lider'); }
  function papelAtual() {
    var v = verComo();
    if (v === 'Lider' || v === 'Gerente') return { tipo: 'lider', nome: 'Líder', lider: true, admin: true };
    var f = funcionarioPorNome(v) || funcionarioPorMatricula(v);
    var ehL = !!(f && f.lider === 'sim');
    var ehA = !!(f && f.cargo === 'administrador');
    if (ehL || ehA) return { tipo: 'lider', nome: f.nome_curto, lider: ehL, admin: ehA };
    return { tipo: f ? 'funcionario' : 'lider', nome: f ? f.nome_curto : v, lider: false, admin: false };
  }
  // Perfis:
  //   • líder        → gestão do processo (aprova/ajusta férias e licença,
  //                    cobertura, vê banco/permuta de todos).
  //   • administrador → acesso a TUDO (o que o líder faz + cadastro, config,
  //                    logins, backup). administrador ⊇ líder.
  function ehLider() { return papelAtual().tipo === 'lider'; }   // líder OU admin: acesso de gestão
  var ehGerente = ehLider; // alias de compatibilidade
  function ehAdmin() { return papelAtual().admin === true; }     // só administrador
  function podeGerirFerias() { return ehLider(); }               // líder e admin decidem férias
  /** Filtra uma lista: líder vê tudo, funcionário só o que é dele. */
  function visivelPara(lista, campoPessoa) {
    var p = papelAtual();
    if (p.tipo === 'lider') return lista;
    var campo = campoPessoa || 'pessoa';
    return lista.filter(function (x) {
      return x[campo] === p.nome || x.pessoa_a === p.nome || x.pessoa_b === p.nome;
    });
  }

  // ─── Funcionários ─────────────────────────────────────────────────────────
  //  Chave interna: id. Identificador visível: matricula. Exibição: nome_curto.
  var CAMPOS_FUNC = ['id', 'matricula', 'nome_completo', 'nome_curto', 'foto', 'email',
    'celular', 'celular2', 'nascimento', 'cargo', 'regime', 'plantao', 'lider', 'oculto',
    'admissao', 'status', 'saldo_inicial_banco', 'dias_ferias_ano', 'auth_user_id'];
  var CARGOS = ['investigador', 'delegado', 'diretor', 'administrador'];
  // campos que o próprio funcionário pode editar (o resto é só do líder)
  var CAMPOS_PESSOAIS = ['nome_completo', 'nome_curto', 'foto', 'email', 'celular', 'celular2', 'nascimento'];

  /** Converte um registro antigo (papel/nome) para o esquema novo. */
  function migrarFuncionario(f) {
    if ('regime' in f || 'nome_curto' in f) {
      if (!('regime' in f)) {
        f.regime = f.papel === 'coringa' ? 'coringa' : (f.papel === 'gerente' ? '' : 'plantao');
      }
      if (!('lider' in f)) f.lider = f.papel === 'gerente' ? 'sim' : 'nao';
      return f;
    }
    var nome = f.nome || f.nome_curto || '';
    return {
      id: f.id || uid(),
      matricula: f.matricula || '',
      nome_completo: f.nome_completo || nome,
      nome_curto: nome,
      foto: f.foto || '',
      celular: f.celular || '', celular2: f.celular2 || '',
      nascimento: f.nascimento || '',
      cargo: f.cargo || (f.papel === 'gerente' ? 'diretor' : 'investigador'),
      regime: f.papel === 'coringa' ? 'coringa' : (f.papel === 'gerente' ? '' : 'plantao'),
      plantao: f.plantao || '',
      lider: f.lider || (f.papel === 'gerente' ? 'sim' : 'nao'),
      admissao: f.admissao || '',
      status: f.status || 'ativo',
      saldo_inicial_banco: Number(f.saldo_inicial_banco) || 0,
      dias_ferias_ano: Number(f.dias_ferias_ano) || 30
    };
  }

  function funcionarios() { return clone(_db.Funcionarios); }
  // a equipe "de verdade" — sem usuários de sistema (oculto = prestador/dono)
  function equipe() { return clone(_db.Funcionarios).filter(function (f) { return f.oculto !== 'sim'; }); }
  function funcionarioPorNome(nome) {
    return _db.Funcionarios.filter(function (f) { return f.nome_curto === nome; })[0] || null;
  }
  function funcionarioPorMatricula(m) {
    if (!m) return null;
    return _db.Funcionarios.filter(function (f) { return f.matricula && f.matricula === m; })[0] || null;
  }
  function funcionarioPorId(id) {
    return _db.Funcionarios.filter(function (f) { return f.id === id; })[0] || null;
  }

  function salvarFuncionario(dados, apenasPessoais) {
    var atual = dados.id ? funcionarioPorId(dados.id) : null;
    if (apenasPessoais && !atual) throw new Error('Registro não encontrado.');

    var reg = atual ? clone(atual) : {};
    CAMPOS_FUNC.forEach(function (c) {
      if (apenasPessoais && CAMPOS_PESSOAIS.indexOf(c) < 0) return; // trava campos administrativos
      if (dados[c] != null) reg[c] = dados[c];
      else if (reg[c] == null) reg[c] = '';
    });

    reg.nome_curto = String(reg.nome_curto || '').trim();
    reg.nome_completo = String(reg.nome_completo || reg.nome_curto).trim();
    if (!reg.nome_curto) throw new Error('Nome curto é obrigatório.');
    reg.regime = reg.regime || 'plantao';
    reg.cargo = CARGOS.indexOf(reg.cargo) >= 0 ? reg.cargo : 'investigador';
    reg.lider = reg.lider === 'sim' ? 'sim' : 'nao';
    reg.oculto = reg.oculto === 'sim' ? 'sim' : 'nao';
    reg.status = reg.status || 'ativo';
    reg.saldo_inicial_banco = Number(reg.saldo_inicial_banco) || 0;
    reg.dias_ferias_ano = Number(reg.dias_ferias_ano) > 0
      ? Number(reg.dias_ferias_ano) : (Number(config('dias_ferias_padrao')) || 30);
    if (reg.regime !== 'plantao') reg.plantao = '';

    var outros = _db.Funcionarios.filter(function (f) { return f.id !== reg.id; });
    if (outros.some(function (f) { return (f.nome_curto || '').toLowerCase() === reg.nome_curto.toLowerCase(); }))
      throw new Error('Já existe alguém com o nome curto "' + reg.nome_curto + '".');
    if (reg.matricula && outros.some(function (f) { return f.matricula === reg.matricula; }))
      throw new Error('Matrícula "' + reg.matricula + '" já cadastrada.');

    if (reg.id) {
      var i = idxFunc(reg.id);
      if (i >= 0) {
        var nomeAntigo = _db.Funcionarios[i].nome_curto;
        _db.Funcionarios[i] = reg;
        if (nomeAntigo && nomeAntigo !== reg.nome_curto) renomearPessoa(nomeAntigo, reg.nome_curto);
        salvar();
        return reg.id;
      }
    }
    reg.id = uid();
    _db.Funcionarios.push(reg);
    salvar();
    return reg.id;
  }

  /** Propaga a troca de nome curto para eventos e lançamentos. */
  function renomearPessoa(de, para) {
    _db.Eventos.forEach(function (e) {
      if (e.pessoa === de) e.pessoa = para;
      if (e.substituto === de) e.substituto = para;
    });
    _db.BancoHoras.forEach(function (l) { if (l.pessoa === de) l.pessoa = para; });
  }

  function removerFuncionario(id) {
    var i = idxFunc(id);
    if (i < 0) return false;
    _db.Funcionarios.splice(i, 1);
    salvar();
    return true;
  }
  function idxFunc(id) {
    for (var i = 0; i < _db.Funcionarios.length; i++) if (_db.Funcionarios[i].id === id) return i;
    return -1;
  }

  function ehPlantao(f) { return f && f.regime === 'plantao'; }
  function ehCoringa(f) { return f && f.regime === 'coringa'; }
  function ehExpediente(f) { return f && f.regime === 'expediente'; }
  // quem pode ser designado para cobrir uma ausência
  function ehCobridor(f) { return ehCoringa(f) || ehExpediente(f); }

  function plantoes() {
    var cfg = rotacaoConfig();
    return cfg.ordem.map(function (cod) {
      var dupla = _db.Funcionarios.filter(function (f) {
        return ehPlantao(f) && f.plantao === cod;
      }).map(function (f) { return f.nome_curto; });
      return { codigo: cod, pessoa_1: dupla[0] || '', pessoa_2: dupla[1] || '' };
    });
  }
  function coringas() {
    return _db.Funcionarios.filter(ehCoringa).map(function (f) { return f.nome_curto; });
  }
  function parceiroDeDupla(nome) {
    var f = funcionarioPorNome(nome);
    if (!ehPlantao(f) || !f.plantao) return null;
    var p = _db.Funcionarios.filter(function (x) {
      return ehPlantao(x) && x.plantao === f.plantao && x.nome_curto !== nome;
    })[0];
    return p ? p.nome_curto : null;
  }

  // ─── Férias: saldo e disponibilidade ──────────────────────────────────────
  function diasFeriasDe(nome) {
    var f = funcionarioPorNome(nome);
    var d = f && Number(f.dias_ferias_ano) > 0 ? Number(f.dias_ferias_ano) : Number(config('dias_ferias_padrao'));
    return d || 30;
  }

  function feriasDoAno(nome, ano, excluirId) {
    return _db.Eventos.filter(function (e) {
      return e.tipo === 'ferias' && e.pessoa === nome && e.id !== excluirId &&
        parseDia(e.inicio).getFullYear() === Number(ano);
    });
  }
  function feriasConsumidas(nome, ano, excluirId) {
    return feriasDoAno(nome, ano, excluirId).reduce(function (s, e) {
      return s + diasInclusive(e.inicio, e.fim);
    }, 0);
  }
  function saldoFerias(nome, ano) {
    var a = ano || new Date().getFullYear();
    var base = diasFeriasDe(nome);
    var usado = feriasConsumidas(nome, a);
    return { ano: a, base: base, consumido: usado, restante: base - usado };
  }

  /**
   * Classifica um período de férias/licença para uma pessoa:
   *   'livre'      — coringa disponível, sobreaviso mantido
   *   'impacto'    — permitido, mas com alerta (sobreaviso descoberto, 2ª cobertura,
   *                  antecedência curta, plantão com 1 titular)
   *   'bloqueado'  — sem coringa disponível / sobreposição com parceiro de dupla /
   *                  coringa sem coringa de reserva / excede saldo de férias
   */
  function avaliarFerias(nome, inicio, fim, excluirId, semJanela, tipo, substituto) {
    var f = funcionarioPorNome(nome);
    var ehTitular = ehPlantao(f);
    var ehCoringaP = ehCoringa(f);
    var coringasAtivas = _db.Funcionarios.filter(function (x) {
      return ehCoringa(x) && x.status !== 'afastado';
    }).length;

    var msgs = [];
    var quebrasCarga = [];
    var pior = 'livre';
    function rebaixa(n) {
      var ordem = { livre: 0, impacto: 1, bloqueado: 2 };
      if (ordem[n] > ordem[pior]) pior = n;
    }

    // Cobertura nomeada: alguém foi designado para cobrir esta ausência
    // (normalmente uma coringa "entrando" no plantão). Se essa pessoa estiver
    // livre no período, a lacuna de cobertura é considerada resolvida.
    var subNome = substituto || '';
    var subOcupado = false;
    if (subNome) {
      subOcupado = _db.Eventos.some(function (e) {
        if (e.id === excluirId) return false;
        if (e.tipo !== 'ferias' && e.tipo !== 'licenca_medica') return false;
        if (!sobrepoe(e.inicio, e.fim, inicio, fim)) return false;
        return e.pessoa === subNome || e.substituto === subNome;
      });
      if (subOcupado) {
        rebaixa('impacto');
        msgs.push(subNome + ' já está de férias ou cobrindo outra ausência nesse período — confirmar com o gestor.');
      } else {
        msgs.push('Cobertura definida: ' + subNome + '.');
      }
      // Quebra de carga horária: a coringa se apresenta num plantão antes de
      // terminar o descanso/folga protegido de outra cobertura.
      var evTmp = { id: '__tmp__', tipo: tipo || 'ferias', pessoa: nome, substituto: subNome, inicio: inicio, fim: fim };
      avaliarCoberturas(subNome, evTmp, excluirId).forEach(function (q) {
        if (q.eventoDestino !== '__tmp__' && q.eventoAnterior !== '__tmp__') return;
        rebaixa('bloqueado');
        quebrasCarga.push(q);
        msgs.push('QUEBRA DE CARGA HORÁRIA: ' + subNome + ' encerra a cobertura em ' + q.plantaoAnterior +
          ' (proteção até ' + new Date(q.protegidoAte).toLocaleString('pt-BR') + ') mas se apresenta em ' +
          q.plantaoDestino + ' em ' + new Date(q.apresentacao).toLocaleString('pt-BR') + ' — ' + q.horasPerdidas +
          'h de descanso a menos. Se o líder assumir, entram ' + q.creditoFolga + 'h no banco de ' + subNome + '.');
      });
    }
    var coberturaOk = subNome && !subOcupado;

    // saldo de férias (só para tipo férias — licença não consome)
    var ano = parseDia(inicio).getFullYear();
    var base = diasFeriasDe(nome);
    var consumido = feriasConsumidas(nome, ano, excluirId);
    var novos = diasInclusive(inicio, fim);
    var contaSaldo = (tipo || 'ferias') === 'ferias';
    if (contaSaldo && consumido + novos > base) {
      rebaixa('bloqueado');
      msgs.push('Excede o saldo de férias de ' + nome + ': ' + consumido + ' dias já usados em ' +
        ano + ' + ' + novos + ' novos > ' + base + '.');
    }

    // sobreposição com o parceiro de dupla
    if (ehTitular) {
      var parc = parceiroDeDupla(nome);
      if (parc) {
        var conflito = _db.Eventos.some(function (e) {
          return e.id !== excluirId && (e.tipo === 'ferias' || e.tipo === 'licenca_medica') &&
            e.pessoa === parc && sobrepoe(e.inicio, e.fim, inicio, fim);
        });
        if (conflito) {
          rebaixa('bloqueado');
          msgs.push('Sobreposição com ' + parc + ' (mesma dupla do ' + f.plantao + ').');
        }
      }
    }

    // avaliação dia a dia
    var d = meiaNoite(inicio), fimD = meiaNoite(fim);
    var diasSobreaviso = 0, diasSegundaCobertura = 0;
    while (d <= fimD) {
      var outrosTit = eventosCobrindo(d, ['ferias', 'licenca_medica'], excluirId)
        .filter(function (e) { return ehPlantao(funcionarioPorNome(e.pessoa)) && e.pessoa !== nome; });
      var outrasCor = eventosCobrindo(d, ['ferias'], excluirId)
        .filter(function (e) { return ehCoringa(funcionarioPorNome(e.pessoa)) && e.pessoa !== nome; });

      var corForaTotal = outrasCor.length + (ehCoringaP ? 1 : 0);
      var coringasDisp = coringasAtivas - corForaTotal;
      var cobertura = outrosTit.length + (ehTitular ? 1 : 0);

      if (!coberturaOk) {
        if (coringasDisp < 0 || (ehCoringaP && coringasDisp <= 0)) {
          rebaixa('bloqueado');
        } else if (cobertura > coringasDisp) {
          rebaixa('bloqueado');
        } else if (cobertura === coringasDisp && cobertura > 0) {
          rebaixa('impacto'); diasSobreaviso++;
        }
      }
      if (cobertura >= 2) diasSegundaCobertura++;
      d = new Date(d.getTime() + MS_DIA);
    }
    if (pior === 'bloqueado' && !msgs.some(function (m) { return /coringa/i.test(m); }) &&
        !msgs.some(function (m) { return /Sobreposição|saldo/.test(m); })) {
      msgs.push('Sem coringa livre para cobrir todo o período — defina quem cobre ou ajuste as datas.');
    }
    if (diasSobreaviso > 0 && pior !== 'bloqueado') {
      msgs.push('Sobreaviso ficará descoberto em ' + diasSobreaviso + ' dia(s) do período.');
    }
    if (diasSegundaCobertura > 0) {
      msgs.push('Haverá 2 (ou mais) coberturas simultâneas em ' + diasSegundaCobertura + ' dia(s) — decisão do gestor.');
    }

    // antecedência mínima (só alerta)
    var anteced = Number(config('antecedencia_ferias_dias')) || 0;
    var faltam = Math.round((meiaNoite(inicio) - meiaNoite(new Date())) / MS_DIA);
    if (anteced > 0 && faltam < anteced) {
      msgs.push('Comunicação com ' + faltam + ' dia(s) de antecedência (mínimo sugerido: ' + anteced + ').');
      if (pior === 'livre') rebaixa('impacto');
    }

    var out = {
      nivel: pior,
      mensagens: msgs,
      quebraCarga: quebrasCarga,
      saldo: { base: base, consumido: consumido, novos: novos, restante: base - consumido - novos },
      diasSobreaviso: diasSobreaviso
    };
    if (pior !== 'livre' && !semJanela) out.proximaJanela = proximaJanelaLivre(nome, inicio, fim, excluirId, tipo);
    return out;
  }

  // Turnos que uma coringa efetivamente cumpre ao cobrir um plantão em [ini,fim]
  // e até quando vai a proteção (descanso/folga) logo após o último turno.
  function _stintCobertura(plantao, ini, fim, cfg) {
    var d0 = String(ini).slice(0, 10), d1 = String(fim).slice(0, 10);
    var turnos = R.proximosTurnos(plantao, ini, 200, cfg).filter(function (t) {
      return t.data >= d0 && t.data <= d1;
    });
    if (!turnos.length) return null;
    var ult = turnos[turnos.length - 1];
    var est = R.estadoEm(plantao, new Date(ult.fim.getTime() + 60000), cfg);
    return {
      plantao: plantao,
      apresentacao: turnos[0].inicio,
      ultimoFim: ult.fim,
      protegidoAte: est && est.fimProtecao ? est.fimProtecao : ult.fim,
      horasTurnos: turnos.reduce(function (s, t) { return s + t.horas; }, 0)
    };
  }

  /**
   * Detecta quebra de descanso/folga de uma coringa que cobre plantões
   * diferentes em sequência. Retorna lista de quebras:
   *   { coringa, plantaoAnterior, plantaoDestino, eventoAnterior, eventoDestino,
   *     apresentacao, protegidoAte, horasPerdidas, creditoFolga }
   */
  function avaliarCoberturas(coringa, eventoExtra, excluirId) {
    var cfg = rotacaoConfig();
    // Expediente é urgência: cobre pontualmente e folga em seguida — sem
    // ciclo de 120h, então não há quebra de descanso a calcular. O líder
    // gerencia esses casos manualmente.
    var subF = funcionarioPorNome(coringa);
    if (subF && subF.regime === 'expediente') return [];
    var evs = _db.Eventos.filter(function (e) {
      return (e.tipo === 'ferias' || e.tipo === 'licenca_medica') &&
        e.substituto === coringa && e.id !== excluirId && (!eventoExtra || e.id !== eventoExtra.id);
    });
    if (eventoExtra && eventoExtra.substituto === coringa) evs = evs.concat([eventoExtra]);

    var stints = [];
    evs.forEach(function (e) {
      var alvo = funcionarioPorNome(e.pessoa);
      var pl = alvo && alvo.plantao;
      if (!pl) return;
      var s = _stintCobertura(pl, e.inicio, e.fim, cfg);
      if (s) { s.eventoId = e.id; stints.push(s); }
    });
    stints.sort(function (a, b) { return a.apresentacao - b.apresentacao; });

    var quebras = [];
    for (var i = 1; i < stints.length; i++) {
      var ant = stints[i - 1], cur = stints[i];
      if (ant.plantao === cur.plantao) continue;               // mesma cobertura contínua
      if (cur.apresentacao >= ant.protegidoAte) continue;      // descansou o previsto
      var horasPerdidas = (ant.protegidoAte - cur.apresentacao) / 3600000;
      quebras.push({
        coringa: coringa,
        plantaoAnterior: ant.plantao,
        plantaoDestino: cur.plantao,
        eventoAnterior: ant.eventoId,
        eventoDestino: cur.eventoId,
        apresentacao: cur.apresentacao,
        protegidoAte: ant.protegidoAte,
        horasPerdidas: r2(horasPerdidas),
        creditoFolga: r2(horasPerdidas * (Number(cfg.multFolgaPerdida) || 1))
      });
    }
    return quebras;
  }

  function eventosCobrindo(dia, tipos, excluirId) {
    return _db.Eventos.filter(function (e) {
      return e.id !== excluirId && tipos.indexOf(e.tipo) >= 0 && cobreDia(e.inicio, e.fim, dia);
    });
  }

  function proximaJanelaLivre(nome, inicio, fim, excluirId, tipo) {
    var dur = diasInclusive(inicio, fim);
    var base = meiaNoite(inicio);
    for (var k = 1; k <= 366; k++) {
      var ci = new Date(base.getTime() + k * MS_DIA);
      var cf = new Date(ci.getTime() + (dur - 1) * MS_DIA);
      var a = avaliarFerias(nome, isoData(ci), isoData(cf), excluirId, true, tipo);
      if (a.nivel === 'livre') return { inicio: isoData(ci), fim: isoData(cf) };
    }
    return null;
  }

  // ─── Eventos ──────────────────────────────────────────────────────────────
  var CAMPOS_EVT = ['id', 'tipo', 'pessoa', 'substituto', 'inicio', 'fim', 'irregular', 'nivel', 'obs'];
  var TIPOS_EVT = ['ferias', 'licenca_medica', 'folga_abatendo_banco', 'troca',
                   'convocacao', 'sobreaviso_escalado', 'sobreaviso_acionado'];

  function eventos() {
    return clone(_db.Eventos).sort(function (a, b) {
      return String(a.inicio).localeCompare(String(b.inicio));
    });
  }
  function eventosVisiveis() { return visivelPara(eventos(), 'pessoa'); }

  function salvarEvento(dados) {
    var reg = {};
    CAMPOS_EVT.forEach(function (c) { reg[c] = dados[c] != null ? dados[c] : ''; });
    if (TIPOS_EVT.indexOf(reg.tipo) < 0) throw new Error('Tipo de evento inválido: ' + reg.tipo);
    if (!reg.pessoa) throw new Error('Selecione a pessoa.');
    if (!reg.inicio) throw new Error('Informe o início.');
    if (!reg.fim) reg.fim = reg.inicio;

    reg.id = dados.id || uid();

    var avaliacao = null;
    if (reg.tipo === 'ferias' || reg.tipo === 'licenca_medica') {
      // Férias/licença é COMUNICAÇÃO, não aprovação: nunca barra. O nível
      // (livre / impacto / crítico) fica registrado só como alerta ao gestor.
      avaliacao = avaliarFerias(reg.pessoa, reg.inicio, reg.fim, reg.id, false, reg.tipo, reg.substituto);
      reg.nivel = avaliacao.nivel;
    }

    removerLancamentosDoEvento(reg.id);
    var impacto = aplicarImpacto(reg);
    reg.irregular = impacto && impacto.irregular ? 'sim' : 'nao';

    // Quebra de carga horária da coringa: só lança no banco se o líder assumir.
    var quebras = (avaliacao && avaliacao.quebraCarga) || [];
    if (quebras.length && dados.assumirQuebra) {
      quebras.forEach(function (q) {
        if (q.creditoFolga > 0) {
          lancar(q.coringa, 'entrada', q.creditoFolga, 'folga_perdida', reg.id,
            typeof q.apresentacao === 'string' ? q.apresentacao : new Date(q.apresentacao).toISOString());
        }
      });
      reg.irregular = 'sim';
    }

    var i = idxEvt(reg.id);
    if (i >= 0) _db.Eventos[i] = reg; else _db.Eventos.push(reg);
    salvar();
    return {
      id: reg.id, irregular: reg.irregular === 'sim', nivel: reg.nivel || '',
      impacto: impacto, avaliacao: avaliacao,
      quebraCarga: quebras, quebraAssumida: !!(quebras.length && dados.assumirQuebra)
    };
  }

  function removerEvento(id) {
    var i = idxEvt(id);
    if (i < 0) return false;
    _db.Eventos.splice(i, 1);
    removerLancamentosDoEvento(id);
    salvar();
    return true;
  }
  function idxEvt(id) {
    for (var i = 0; i < _db.Eventos.length; i++) if (_db.Eventos[i].id === id) return i;
    return -1;
  }

  function aplicarImpacto(ev) {
    var cfg = rotacaoConfig();
    var h = Math.max(0, horasEntre(ev.inicio, ev.fim));

    if (ev.tipo === 'convocacao') {
      var f = funcionarioPorNome(ev.pessoa);
      var plantao = f && f.plantao;
      if (!plantao) {
        if (h > 0) lancar(ev.pessoa, 'entrada', r2(h * cfg.fatorConvocacao), 'convocacao', ev.id, ev.inicio);
        return { irregular: false, semPlantao: true, creditoTrabalho: r2(h * cfg.fatorConvocacao) };
      }
      var imp = R.avaliarConvocacao(plantao, new Date(ev.inicio), h, cfg);
      if (imp.creditoFolga > 0) lancar(ev.pessoa, 'entrada', imp.creditoFolga, 'folga_perdida', ev.id, ev.inicio);
      if (imp.creditoTrabalho > 0) lancar(ev.pessoa, 'entrada', imp.creditoTrabalho, 'convocacao', ev.id, ev.inicio);
      return imp;
    }
    if (ev.tipo === 'sobreaviso_acionado') {
      var cred = r2(h * cfg.fatorConvocacao);
      if (cred > 0) lancar(ev.pessoa, 'entrada', cred, 'sobreaviso_acionado', ev.id, ev.inicio);
      return { irregular: false, creditoTrabalho: cred };
    }
    if (ev.tipo === 'sobreaviso_escalado') {
      var c2 = r2(h * cfg.creditoSobreaviso);
      if (c2 > 0) lancar(ev.pessoa, 'entrada', c2, 'sobreaviso_escalado', ev.id, ev.inicio);
      return { irregular: false, creditoTrabalho: c2 };
    }
    if (ev.tipo === 'folga_abatendo_banco') {
      if (h > 0) lancar(ev.pessoa, 'saida', r2(h), 'abatimento', ev.id, ev.inicio);
      return { irregular: false, debito: r2(h) };
    }
    return null; // ferias, licenca_medica, troca: só registro
  }

  // ─── Banco de horas ───────────────────────────────────────────────────────
  var MOTIVOS = ['folga_perdida', 'convocacao', 'sobreaviso_acionado', 'sobreaviso_escalado',
                 'abatimento', 'permuta', 'ajuste_manual', 'saldo_inicial'];

  function lancar(pessoa, sentido, horas, motivo, evento_id, data_hora) {
    _db._seq = (_db._seq || 0) + 1;
    _db.BancoHoras.push({
      id: uid(),
      seq: _db._seq,
      data_hora: data_hora ? new Date(data_hora).toISOString() : new Date().toISOString(),
      pessoa: pessoa,
      sentido: sentido === 'saida' ? 'saida' : 'entrada',
      horas: r2(horas),
      motivo: motivo || 'ajuste_manual',
      evento_id: evento_id || '',
      saldo_resultante: 0
    });
  }

  function ajusteManual(pessoa, sentido, horas, obs, data_hora) {
    if (!pessoa) throw new Error('Selecione a pessoa.');
    if (!(Number(horas) > 0)) throw new Error('Informe uma quantidade de horas maior que zero.');
    lancar(pessoa, sentido, horas, 'ajuste_manual', obs ? 'obs:' + obs : '', data_hora);
    salvar();
  }

  function removerLancamento(seq) {
    var antes = _db.BancoHoras.length;
    _db.BancoHoras = _db.BancoHoras.filter(function (r) { return r.seq !== seq; });
    if (_db.BancoHoras.length !== antes) { salvar(); return true; }
    return false;
  }
  function removerLancamentosDoEvento(evId) {
    _db.BancoHoras = _db.BancoHoras.filter(function (r) { return r.evento_id !== evId; });
  }

  function bancoHoras() { return clone(_db.BancoHoras).sort(ordenaBH); }
  function bancoHorasVisivel() { return visivelPara(bancoHoras(), 'pessoa'); }
  function ordenaBH(a, b) {
    var c = String(a.data_hora).localeCompare(String(b.data_hora));
    return c !== 0 ? c : (a.seq - b.seq);
  }

  function recomputar(db) {
    var saldo = {};
    db.Funcionarios.forEach(function (f) { saldo[f.nome_curto] = Number(f.saldo_inicial_banco) || 0; });
    db.BancoHoras.slice().sort(ordenaBH).forEach(function (r) {
      if (!(r.pessoa in saldo)) saldo[r.pessoa] = 0;
      saldo[r.pessoa] += (r.sentido === 'saida' ? -1 : 1) * (Number(r.horas) || 0);
      var orig = db.BancoHoras.filter(function (x) { return x.seq === r.seq; })[0];
      if (orig) orig.saldo_resultante = Math.round(saldo[r.pessoa] * 100) / 100;
    });
    db._saldos = {};
    Object.keys(saldo).forEach(function (k) { db._saldos[k] = Math.round(saldo[k] * 100) / 100; });
  }

  function saldos() { recomputar(_db); return clone(_db._saldos); }
  function saldoDe(nome) {
    var s = saldos();
    if (nome in s) return s[nome];
    var f = funcionarioPorNome(nome);
    return f ? (Number(f.saldo_inicial_banco) || 0) : 0;
  }

  // ─── Permuta (acordo entre funcionários; NÃO passa pelo banco de horas) ────
  //  Estados: proposta → confirmada (B aceita) → concluida.
  //           recusada (B) / cancelada (A) / expirada.
  //  O líder NÃO aprova — só é comunicado. O termo é impresso e o Diretor
  //  assina no papel (fora do sistema). 'aprovada' fica só por retrocompat.
  var ESTADOS_PERMUTA = ['proposta', 'aprovada', 'confirmada', 'concluida',
                         'rejeitada', 'recusada', 'cancelada', 'expirada'];
  var ESTADOS_VIVOS = { proposta: 1, aprovada: 1 };

  function prazoPermutaH() { return Number(config('permuta_prazo_horas')) || 12; }

  function proximosTurnosDe(nome, quantos, desde) {
    var f = funcionarioPorNome(nome);
    if (!ehPlantao(f) || !f.plantao) return [];
    return R.proximosTurnos(f.plantao, desde || new Date(), quantos || 8, rotacaoConfig());
  }

  function numeroPermuta(ano) {
    if (!_db._permutaSeq) _db._permutaSeq = {};
    _db._permutaSeq[ano] = (_db._permutaSeq[ano] || 0) + 1;
    return 'PERM-' + ano + '-' + ('00' + _db._permutaSeq[ano]).slice(-3);
  }

  function idxPermuta(id) {
    for (var i = 0; i < _db.Permutas.length; i++) if (_db.Permutas[i].id === id) return i;
    return -1;
  }

  /** Marca como expiradas as permutas ainda não confirmadas cujo prazo passou. */
  function expirarPendentes() {
    if (Store && Store._skipExpiry) return;   // no modo Supabase quem expira é o servidor
    var agora = Date.now(), limite = prazoPermutaH() * 3600000, mudou = false;
    _db.Permutas.forEach(function (p) {
      if (!ESTADOS_VIVOS[p.estado]) return;
      var t = primeiroTurno(p);
      if (t && (new Date(t).getTime() - agora) < limite) {
        p.estado = 'expirada';
        hist(p, 'sistema', 'prazo de ' + prazoPermutaH() + ' h esgotado');
        mudou = true;
      }
    });
    if (mudou) salvar();
  }
  function primeiroTurno(p) {
    var ts = [p.turno_a_inicio];
    if (p.mao_dupla === 'sim' && p.turno_b_inicio) ts.push(p.turno_b_inicio);
    ts = ts.filter(Boolean).map(function (x) { return new Date(x).getTime(); });
    return ts.length ? new Date(Math.min.apply(null, ts)) : null;
  }
  function hist(p, quem, texto) {
    p.historico = p.historico || [];
    p.historico.push({ quando: new Date().toISOString(), quem: quem, texto: texto });
  }

  function permutas() { expirarPendentes(); return clone(_db.Permutas); }
  function permutasVisiveis() {
    var pa = papelAtual();
    return permutas().filter(function (p) {
      return pa.tipo === 'lider' || p.pessoa_a === pa.nome || p.pessoa_b === pa.nome;
    });
  }
  function permutaPorId(id) { expirarPendentes(); var i = idxPermuta(id); return i < 0 ? null : clone(_db.Permutas[i]); }

  /** Cria uma permuta no estado 'proposta'. dados: pessoa_a, pessoa_b, turno_a{...},
   *  mao_dupla, turno_b{...}, obs. */
  function proporPermuta(dados) {
    if (!dados.pessoa_a || !dados.pessoa_b) throw new Error('Informe as duas pessoas.');
    if (dados.pessoa_a === dados.pessoa_b) throw new Error('As duas pessoas têm de ser diferentes.');
    if (!dados.turno_a || !dados.turno_a.inicio) throw new Error('Escolha o turno que ' + dados.pessoa_a + ' vai passar.');
    var maoDupla = dados.mao_dupla === 'sim';
    if (maoDupla && (!dados.turno_b || !dados.turno_b.inicio))
      throw new Error('Na troca de dia, escolha também o turno que ' + dados.pessoa_b + ' vai passar.');

    var ini = new Date(dados.turno_a.inicio);
    var reg = {
      id: uid(),
      numero: numeroPermuta(new Date().getFullYear()),
      pessoa_a: dados.pessoa_a, pessoa_b: dados.pessoa_b,
      turno_a_data: dados.turno_a.data, turno_a_parte: dados.turno_a.parte,
      turno_a_inicio: new Date(dados.turno_a.inicio).toISOString(),
      turno_a_fim: new Date(dados.turno_a.fim).toISOString(),
      mao_dupla: maoDupla ? 'sim' : 'nao',
      turno_b_data: maoDupla ? dados.turno_b.data : '',
      turno_b_parte: maoDupla ? dados.turno_b.parte : '',
      turno_b_inicio: maoDupla ? new Date(dados.turno_b.inicio).toISOString() : '',
      turno_b_fim: maoDupla ? new Date(dados.turno_b.fim).toISOString() : '',
      obs: dados.obs || '',
      estado: 'proposta',
      criada_em: new Date().toISOString(),
      historico: []
    };
    if ((ini.getTime() - Date.now()) < prazoPermutaH() * 3600000)
      throw new Error('O turno começa em menos de ' + prazoPermutaH() + ' h — fora do prazo da permuta.');
    hist(reg, dados.pessoa_a, 'propôs a permuta');
    _db.Permutas.push(reg);
    salvar();
    return clone(reg);
  }

  function _transicao(id, de, para, quem, texto, checa) {
    expirarPendentes();
    var i = idxPermuta(id);
    if (i < 0) throw new Error('Permuta não encontrada.');
    var p = _db.Permutas[i];
    var des = Array.isArray(de) ? de : [de];
    if (des.indexOf(p.estado) < 0)
      throw new Error('Permuta está em "' + p.estado + '", não dá para ' + texto + '.');
    if (checa) checa(p);
    p.estado = para;
    p[para + '_em'] = new Date().toISOString();
    hist(p, quem, texto);
    if (para === 'confirmada') aplicarContaPermuta(p);
    if (de.indexOf && de.indexOf('confirmada') >= 0 && para !== 'concluida') removerContaPermuta(p.id);
    salvar();
    return clone(p);
  }

  // 'aprovar' vira um alias de 'confirmar' (retrocompat com dados/telas antigas)
  function aprovarPermuta(id, quem) { return confirmarPermuta(id, quem); }
  function rejeitarPermuta(id, quem, motivo) {
    return _transicao(id, ['proposta', 'aprovada'], 'recusada', quem || '?', 'recusar' + (motivo ? ' (' + motivo + ')' : ''));
  }
  function confirmarPermuta(id, quem) {
    return _transicao(id, ['proposta', 'aprovada'], 'confirmada', quem, 'confirmar o acordo');
  }
  function recusarPermuta(id, quem) { return _transicao(id, ['proposta', 'aprovada'], 'recusada', quem, 'recusar o acordo'); }
  function cancelarPermuta(id, quem) {
    return _transicao(id, ['proposta', 'aprovada', 'confirmada'], 'cancelada', quem || '?', 'cancelar');
  }
  function concluirPermuta(id) { return _transicao(id, 'confirmada', 'concluida', 'sistema', 'concluir'); }

  // conta entre funcionários (livro próprio) --------------------------------
  function aplicarContaPermuta(p) {
    removerContaPermuta(p.id);
    // perna 1: A passou o turno, B cobriu → A deve as horas a B
    var hA = Math.round((new Date(p.turno_a_fim) - new Date(p.turno_a_inicio)) / 3600000);
    _db.ContaPermutas.push({
      data: new Date().toISOString(), de: p.pessoa_a, para: p.pessoa_b,
      horas: hA, tipo: 'divida', permuta_id: p.id,
      obs: p.numero + (p.mao_dupla === 'sim' ? ' (turno de ' + p.pessoa_a + ')' : '')
    });
    // perna 2 (mão dupla): B passou o turno, A cobriu → B deve as horas a A
    if (p.mao_dupla === 'sim' && p.turno_b_inicio) {
      var hB = Math.round((new Date(p.turno_b_fim) - new Date(p.turno_b_inicio)) / 3600000);
      _db.ContaPermutas.push({
        data: new Date().toISOString(), de: p.pessoa_b, para: p.pessoa_a,
        horas: hB, tipo: 'divida', permuta_id: p.id, obs: p.numero + ' (turno de ' + p.pessoa_b + ')'
      });
    }
  }
  function removerContaPermuta(permutaId) {
    _db.ContaPermutas = _db.ContaPermutas.filter(function (r) { return r.permuta_id !== permutaId; });
  }

  function quitarPermuta(de, para, horas, obs) {
    if (!de || !para || de === para) throw new Error('Informe quem pagou e quem recebeu.');
    if (!(Number(horas) > 0)) throw new Error('Informe as horas quitadas.');
    _db.ContaPermutas.push({
      data: new Date().toISOString(), de: de, para: para,
      horas: Number(horas), tipo: 'quitacao', permuta_id: '', obs: obs || ''
    });
    salvar();
  }

  function contaPermutas() { return clone(_db.ContaPermutas); }

  /** Saldo líquido entre A e B: >0 = A deve a B; <0 = B deve a A. */
  function saldoEntre(a, b) {
    var s = 0;
    _db.ContaPermutas.forEach(function (r) {
      var h = Number(r.horas) || 0;
      if (r.tipo === 'divida') {
        if (r.de === a && r.para === b) s += h;
        else if (r.de === b && r.para === a) s -= h;
      } else if (r.tipo === 'quitacao') {
        if (r.de === a && r.para === b) s -= h;
        else if (r.de === b && r.para === a) s += h;
      }
    });
    return Math.round(s * 100) / 100;
  }

  /**
   * Contas de permuta de uma pessoa (saldo != 0).
   *   saldo > 0  → `nome` DEVE horas a `outra`
   *   saldo < 0  → `outra` deve horas a `nome`
   * Cada item: { outra, saldo, horas, turnos, permutas: ['PERM-...'] }.
   */
  function contasDe(nome) {
    var mapa = {};
    _db.ContaPermutas.forEach(function (r) {
      [r.de, r.para].forEach(function (n) { if (n !== nome) mapa[n] = true; });
    });
    return Object.keys(mapa).map(function (outra) {
      var saldo = saldoEntre(nome, outra);
      var refs = {};
      _db.ContaPermutas.forEach(function (r) {
        if (r.tipo !== 'divida' || !r.obs) return;
        if ((r.de === nome && r.para === outra) || (r.de === outra && r.para === nome)) refs[r.obs] = 1;
      });
      var h = Math.abs(saldo);
      return {
        outra: outra, saldo: saldo, horas: h,
        turnos: h % 12 === 0 ? h / 12 : null,
        permutas: Object.keys(refs).sort()
      };
    }).filter(function (x) { return Math.abs(x.saldo) > 0.001; })
      .sort(function (a, b) { return a.outra.localeCompare(b.outra); });
  }

  /** Frases prontas do resumo de contas de permuta, na ótica de `nome`. */
  function resumoContas(nome) {
    return contasDe(nome).map(function (c) {
      var qt = c.turnos != null
        ? c.turnos + (c.turnos === 1 ? ' turno' : ' turnos') + ' (' + c.horas + ' h)'
        : c.horas + ' h';
      var ref = c.permutas.length ? ' — ' + c.permutas.join(', ') : '';
      return {
        outra: c.outra, devo: c.saldo > 0,
        texto: c.saldo > 0
          ? 'Você deve ' + qt + ' a ' + c.outra + ref
          : c.outra + ' deve ' + qt + ' a você' + ref
      };
    });
  }

  // ─── Seed / manutenção ────────────────────────────────────────────────────
  function seedElencoExemplo() {
    var titulares = [
      ['Cássia', 'PL I'], ['Geciane', 'PL I'],
      ['Elizete', 'PL II'], ['Maryah', 'PL II'],
      ['Melanye', 'PL III'], ['Nádia', 'PL III'],
      ['Camila', 'PL IV'], ['Patrício', 'PL IV'],
      ['Adriana', 'PL V'], ['Célia', 'PL V']
    ];
    var dpad = Number(CFG_DEFAULT.dias_ferias_padrao);
    var n = 0;
    function novo(o) {
      n++;
      _db.Funcionarios.push({
        id: uid(), matricula: 'M' + (1000 + n),
        nome_curto: o.nome, nome_completo: o.nome, foto: '',
        celular: '', celular2: '', nascimento: '',
        cargo: o.cargo || 'investigador', regime: o.regime || '', plantao: o.plantao || '',
        lider: o.lider || 'nao', admissao: '', status: 'ativo',
        saldo_inicial_banco: 0, dias_ferias_ano: dpad
      });
    }
    _db = vazio();
    titulares.forEach(function (t) { novo({ nome: t[0], regime: 'plantao', plantao: t[1] }); });
    ['Tainá', 'Coringa 2'].forEach(function (nm) { novo({ nome: nm, regime: 'coringa' }); });
    novo({ nome: 'Diretora', regime: '', cargo: 'diretor', lider: 'sim' });
    salvar();
  }

  function limparTudo() { _db = vazio(); salvar(); }

  function exportar() {
    recomputar(_db);
    return JSON.stringify({
      versao: KEY, exportado_em: new Date().toISOString(),
      Funcionarios: _db.Funcionarios, Config: configTodos(),
      Eventos: _db.Eventos, BancoHoras: _db.BancoHoras,
      Permutas: _db.Permutas, ContaPermutas: _db.ContaPermutas
    }, null, 2);
  }
  /** Substitui todo o conteúdo em memória por um snapshot (mesma forma de exportar()). */
  function _carregarSnapshot(d, semPersistir) {
    var novo = vazio();
    novo.Funcionarios = (d.Funcionarios || []).map(migrarFuncionario);
    novo.Eventos = d.Eventos || [];
    novo.BancoHoras = d.BancoHoras || [];
    novo.Permutas = d.Permutas || [];
    novo.ContaPermutas = d.ContaPermutas || [];
    novo.Config = d.Config || {};
    novo._seq = novo.BancoHoras.reduce(function (m, r) { return Math.max(m, r.seq || 0); }, 0);
    novo._permutaSeq = d._permutaSeq || {};
    if (!Object.keys(novo._permutaSeq).length) {
      novo.Permutas.forEach(function (p) {
        var m = /PERM-(\d+)-(\d+)/.exec(p.numero || '');
        if (m) novo._permutaSeq[m[1]] = Math.max(novo._permutaSeq[m[1]] || 0, +m[2]);
      });
    }
    _db = novo;
    if (semPersistir) recomputar(_db); else salvar();
  }

  function importar(texto) { _carregarSnapshot(JSON.parse(texto)); }

  // ─── API ──────────────────────────────────────────────────────────────────
  var Store = {
    KEY: KEY, TIPOS_EVT: TIPOS_EVT, MOTIVOS: MOTIVOS, CARGOS: CARGOS, CAMPOS_PESSOAIS: CAMPOS_PESSOAIS,
    config: config, setConfig: setConfig, configTodos: configTodos, rotacaoConfig: rotacaoConfig,
    verComo: verComo, setVerComo: setVerComo, papelAtual: papelAtual,
    ehLider: ehLider, ehGerente: ehGerente, ehAdmin: ehAdmin, podeGerirFerias: podeGerirFerias,
    equipe: equipe, visivelPara: visivelPara,
    funcionarios: funcionarios, funcionarioPorNome: funcionarioPorNome,
    funcionarioPorMatricula: funcionarioPorMatricula, funcionarioPorId: funcionarioPorId,
    ehPlantao: ehPlantao, ehCoringa: ehCoringa,
    salvarFuncionario: salvarFuncionario, removerFuncionario: removerFuncionario,
    plantoes: plantoes, coringas: coringas, parceiroDeDupla: parceiroDeDupla,
    diasFeriasDe: diasFeriasDe, feriasConsumidas: feriasConsumidas, saldoFerias: saldoFerias,
    avaliarFerias: avaliarFerias, proximaJanelaLivre: proximaJanelaLivre, avaliarCoberturas: avaliarCoberturas,
    eventos: eventos, eventosVisiveis: eventosVisiveis, salvarEvento: salvarEvento, removerEvento: removerEvento,
    bancoHoras: bancoHoras, bancoHorasVisivel: bancoHorasVisivel, ajusteManual: ajusteManual,
    removerLancamento: removerLancamento, saldos: saldos, saldoDe: saldoDe,
    ESTADOS_PERMUTA: ESTADOS_PERMUTA, prazoPermutaH: prazoPermutaH,
    proximosTurnosDe: proximosTurnosDe,
    permutas: permutas, permutasVisiveis: permutasVisiveis, permutaPorId: permutaPorId,
    proporPermuta: proporPermuta, aprovarPermuta: aprovarPermuta, rejeitarPermuta: rejeitarPermuta,
    confirmarPermuta: confirmarPermuta, recusarPermuta: recusarPermuta,
    cancelarPermuta: cancelarPermuta, concluirPermuta: concluirPermuta,
    quitarPermuta: quitarPermuta, contaPermutas: contaPermutas, saldoEntre: saldoEntre,
    contasDe: contasDe, resumoContas: resumoContas,
    seedElencoExemplo: seedElencoExemplo, limparTudo: limparTudo, exportar: exportar, importar: importar,
    _db: function () { return _db; },
    _snapshot: function () { return clone(_db); },
    _carregarSnapshot: _carregarSnapshot,
    _skipExpiry: false,
    onErro: null
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Store;
  root.Store = Store;

})(typeof globalThis !== 'undefined' ? globalThis : this);
