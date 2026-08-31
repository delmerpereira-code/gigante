# Backend Supabase — passo a passo

O `web/store.js` vai deixar de usar `localStorage` e passar a falar com o Supabase.
As telas **não mudam** — só a camada de dados.

## 1. Projeto

Use o projeto Supabase que você já tem **ou** crie um novo em <https://supabase.com/dashboard>
(Free tier basta). Anote:

- **Project URL** — `https://xxxx.supabase.co`
- **anon public key** — em *Project Settings → API* (a chave `anon`, não a `service_role`)

## 2. Criar as tabelas

*SQL Editor → New query* → cole o conteúdo de [`schema.sql`](schema.sql) → **Run**.
**Depois** rode também [`schema_delta_1.sql`](schema_delta_1.sql) (ajusta uma
política e cria a função `permuta_propor`).

Isso cria: `funcionarios`, `config`, `eventos`, `banco_horas`, `permutas`,
`permuta_historico`, `conta_permutas`, as views de saldo, os *enums*, as políticas de
acesso (RLS) e as funções de permuta (`permuta_propor`, `permuta_aprovar`,
`permuta_confirmar`, …).

A `config` já entra preenchida com os padrões.

## 3. Autenticação

*Authentication → Providers* → deixe **Email** habilitado.
*Authentication → Sign In / Providers → Email* → desligue **Confirm email**
(evita ter que confirmar por e-mail cada login criado).

### Criar o primeiro líder

1. *Authentication → Users → Add user* → e-mail e senha do líder (ex.: a Diretora).
   Copie o **User UID** que aparece.
2. *SQL Editor*:
   ```sql
   insert into funcionarios (matricula, nome_curto, nome_completo, cargo, regime, lider, auth_user_id)
   values ('M1013', 'Diretora', 'Nome completo da diretora', 'diretor', 'externo', true,
           'COLE_AQUI_O_USER_UID');
   ```
3. Pronto — esse login já entra como líder e cadastra o resto da equipe pela tela
   **Funcionários**.

### Ligar um login a um funcionário já cadastrado

Crie o usuário em *Authentication → Users*, copie o UID e:
```sql
update funcionarios set auth_user_id = 'UID' where matricula = 'M1007';
```
(Como líder, isso também dá pra fazer pela tela de cadastro depois que eu adicionar o campo.)

## 4. Ligar o frontend

Crie `web/config.js` (está no `.gitignore` — não vai pro git):
```js
window.SUPABASE_URL = 'https://xxxx.supabase.co';
window.SUPABASE_ANON_KEY = 'a-chave-anon';
```
Me avise quando os passos 1–3 estiverem feitos que eu:
- adapto o `store.js` para async + `@supabase/supabase-js`;
- adiciono a tela de login;
- mantenho um modo offline (cache local) para quando cair a rede.

## Migrar os dados que já estão no navegador

Na tela **Config / Dados**, "Baixar backup (JSON)". Depois que o Supabase estiver
ligado, eu faço um importador que joga esse JSON nas tabelas.

## Observações

- **RLS ligado**: sem login, não se lê nada. A chave `anon` é segura de expor no
  frontend justamente por isso.
- **Regras no servidor**: transições de permuta e o vínculo dívida→conta acontecem
  em funções `SECURITY DEFINER` — o navegador não consegue burlar.
- **Rotação** (fase do ciclo, próximos turnos) continua calculada no cliente
  (`rotacao.js`) — é matemática pura, sem risco.
