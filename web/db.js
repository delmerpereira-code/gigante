/* ============================================================================
 *  db.js — Cliente Supabase + sessão. Carrega ANTES de store.js.
 *  Requer:  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 *           <script src="config.js"></script>   (window.SUPABASE_URL / _ANON_KEY)
 * ==========================================================================*/
(function (root) {
  'use strict';

  var URL = root.SUPABASE_URL, KEY = root.SUPABASE_ANON_KEY;
  var temConfig = !!(URL && KEY && KEY.indexOf('COLE_AQUI') < 0);

  var client = null;
  if (temConfig && root.supabase && root.supabase.createClient) {
    try {
      client = root.supabase.createClient(URL, KEY, {
        auth: { persistSession: true, autoRefreshToken: true }
      });
    } catch (e) { client = null; }
  }
  var configurado = !!client;
  if (temConfig && !client && typeof console !== 'undefined') {
    console.warn('[db] Supabase configurado mas a biblioteca não carregou (CDN?). Rodando em modo local.');
  }

  // O login é pela matrícula; o Supabase exige um e-mail, então geramos um interno.
  var LOGIN_DOMINIO = 'plantao.app';
  function emailDeMatricula(m) {
    return String(m || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '') + '@' + LOGIN_DOMINIO;
  }
  /** Aceita matrícula OU e-mail (se tiver "@"). */
  function identParaEmail(ident) {
    ident = String(ident || '').trim();
    return ident.indexOf('@') >= 0 ? ident.toLowerCase() : emailDeMatricula(ident);
  }

  var DB = {
    configurado: configurado,
    client: client,

    /** { user } ou null. */
    sessao: function () {
      return client ? client.auth.getSession().then(function (r) { return r.data.session; }) : Promise.resolve(null);
    },
    onAuth: function (cb) {
      if (client) client.auth.onAuthStateChange(function (_e, s) { cb(s); });
    },
    emailDeMatricula: emailDeMatricula,

    /** identificador = matrícula (ou e-mail, se tiver "@"). */
    entrar: function (identificador, senha) {
      if (!client) return Promise.reject(new Error('Supabase não configurado (web/config.js).'));
      return client.auth.signInWithPassword({ email: identParaEmail(identificador), password: senha })
        .then(function (r) { if (r.error) throw r.error; return r.data; });
    },
    sair: function () { return client ? client.auth.signOut() : Promise.resolve(); },

    /** Troca a senha do usuário logado. */
    trocarMinhaSenha: function (nova) {
      if (!client) return Promise.reject(new Error('Supabase não configurado.'));
      return client.auth.updateUser({ password: nova }).then(function (r) { if (r.error) throw r.error; return r.data; });
    },

    /**
     * Cria a conta de acesso de um funcionário via Edge Function `criar-login`
     * (usa a chave admin no servidor — sem limite de e-mail, sem validação chata).
     * Devolve o user_id.
     */
    criarLogin: function (email, senha) {
      if (!client) return Promise.reject(new Error('Supabase não configurado.'));
      return client.functions.invoke('criar-login', { body: { email: email, senha: senha } })
        .then(function (r) {
          if (r.error) {
            var m = (r.error && r.error.message) || String(r.error);
            if (/not found|404/i.test(m)) throw new Error('A função "criar-login" não está publicada no Supabase (veja supabase/functions/criar-login).');
            throw new Error(m);
          }
          if (!r.data || r.data.ok !== true) throw new Error((r.data && r.data.error) || 'Não foi possível criar a conta.');
          return r.data.user_id;
        });
    },

    /** SELECT * de uma tabela/view (respeitando RLS). */
    all: function (tabela) {
      return client.from(tabela).select('*').then(function (r) {
        if (r.error) throw r.error; return r.data || [];
      });
    },
    insert: function (tabela, linha) {
      return client.from(tabela).insert(linha).select().then(function (r) {
        if (r.error) throw r.error; return r.data && r.data[0];
      });
    },
    update: function (tabela, id, patch) {
      return client.from(tabela).update(patch).eq('id', id).select().then(function (r) {
        if (r.error) throw r.error; return r.data && r.data[0];
      });
    },
    remove: function (tabela, id) {
      return client.from(tabela).delete().eq('id', id).then(function (r) {
        if (r.error) throw r.error;
      });
    },
    upsertConfig: function (chave, valor) {
      return client.from('config').upsert({ chave: chave, valor: String(valor) }).then(function (r) {
        if (r.error) throw r.error;
      });
    },
    /** Chama uma função RPC (as regras de permuta). */
    rpc: function (fn, args) {
      return client.rpc(fn, args || {}).then(function (r) {
        if (r.error) throw new Error(r.error.message || String(r.error));
        return r.data;
      });
    }
  };

  root.DB = DB;
})(typeof globalThis !== 'undefined' ? globalThis : this);
