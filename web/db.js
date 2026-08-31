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
    entrar: function (email, senha) {
      if (!client) return Promise.reject(new Error('Supabase não configurado (web/config.js).'));
      return client.auth.signInWithPassword({ email: email, password: senha })
        .then(function (r) { if (r.error) throw r.error; return r.data; });
    },
    sair: function () { return client ? client.auth.signOut() : Promise.resolve(); },

    /** Troca a senha do usuário logado. */
    trocarMinhaSenha: function (nova) {
      if (!client) return Promise.reject(new Error('Supabase não configurado.'));
      return client.auth.updateUser({ password: nova }).then(function (r) { if (r.error) throw r.error; return r.data; });
    },

    /**
     * Cria uma conta de login (e-mail + senha) SEM derrubar a sessão de quem chama
     * — usa um cliente descartável. Devolve o user_id da conta criada.
     * Exige "Enable Sign Ups" ligado no Supabase (Auth → Email).
     */
    criarLogin: function (email, senha) {
      if (!client || !root.supabase) return Promise.reject(new Error('Supabase não configurado.'));
      var tmp = root.supabase.createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
      return tmp.auth.signUp({ email: email, password: senha }).then(function (r) {
        if (r.error) {
          var m = r.error.message || String(r.error);
          if (/already registered|already been registered/i.test(m)) throw new Error('Esse e-mail já tem uma conta.');
          if (/Signups not allowed|signup is disabled/i.test(m)) throw new Error('Cadastro de contas está desligado no Supabase (Auth → Email → Enable Sign Ups).');
          throw new Error(m);
        }
        if (!r.data || !r.data.user) throw new Error('Não foi possível criar a conta.');
        return r.data.user.id;
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
