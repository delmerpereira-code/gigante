# Controle de Plantão

App (PWA) para escala de plantão em ciclo de **120 h / 5 dias**: rotação dos 5 plantões,
comunicação de férias com semáforo de disponibilidade, permuta de turno com termo e
aprovação, banco de horas. Backend em **Supabase (Postgres + Auth)**.

Especificação viva: [`docs/ESPECIFICACAO.md`](docs/ESPECIFICACAO.md).

## Estrutura

```
web/                    App PWA — página única, formato de app de celular
  index.html            casca (telas trocadas por dentro)
  app.css / app.js      design system + roteador/login/home
  telas/*.js            uma tela por módulo (calendário, escala, férias, permuta,
                        eventos, banco, meu-cadastro, funcionários, config)
  rotacao.js            motor de rotação do ciclo (fonte de verdade, puro)
  store.js              camada de dados + regras (cache em memória; localStorage
                        como modo local / offline)
  db.js                 cliente Supabase + auth
  sync.js               ponte cache ⇄ Postgres (reconcilia; permuta via RPC)
  foto.js               redução de imagem para a foto do cadastro
  manifest.json / sw.js / icon.svg   PWA
  config.js             URL + chave anon do Supabase (fora do git)
supabase/
  schema.sql            tabelas, views, enums, RLS, RPCs de permuta
  schema_delta_1.sql    permuta_propor + policy de banco_horas
  schema_delta_2.sql    security_invoker nas views
  README.md             passo a passo do backend
tests/                  teste-{rotacao,eventos,ferias,permuta}.js  (node)
```

## Rodar

1. Backend: siga [`supabase/README.md`](supabase/README.md) (criar tabelas, auth, líder).
2. `web/config.js` — copie de `config.example.js` e preencha URL + chave `anon`.
3. Servir e abrir:
   ```
   cd web && npx --yes http-server -p 8080 -a 0.0.0.0
   ```
   - PC/desktop: <http://localhost:8080>
   - Celular (mesma Wi-Fi): `http://<IP-do-PC>:8080`
   - Sem `config.js` preenchido, o app roda em **modo local** (localStorage), útil
     para testar a lógica sem internet.

## Testes

```
node tests/teste-rotacao.js
node tests/teste-eventos.js
node tests/teste-ferias.js
node tests/teste-permuta.js
```

## Papéis

Cada login está ligado a um funcionário (`funcionarios.auth_user_id`). A flag `lider`
dá acesso de administração (cadastro, config) e aprovação de permutas. O RLS no
Postgres garante que cada um só lê o que é dele + o que é comum.
`apps-script/` é legado (plano anterior, não usado).
