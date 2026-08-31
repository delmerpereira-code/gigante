# Publicar no GitHub Pages

O app é estático (pasta `web/`) e o backend é o Supabase. O deploy é automático
a cada `push` via `.github/workflows/deploy.yml`.

## Uma vez

1. **Criar o repositório no GitHub** e enviar o projeto:
   ```
   git remote add origin https://github.com/SEU_USUARIO/plantao-controle.git
   git push -u origin capelania
   ```
   (ou faça na interface: New repository → depois `git remote add` + `git push`)

2. **Secrets** — repo → *Settings* → *Secrets and variables* → *Actions* → *New repository secret*:
   | Nome | Valor |
   |---|---|
   | `SUPABASE_URL` | `https://lzofyvjetfahkaywapsd.supabase.co` |
   | `SUPABASE_ANON_KEY` | a chave `anon` `public` (Settings → API) |

   Assim a chave não fica no código — o workflow gera o `web/config.js` na hora.

3. **Ativar o Pages** — repo → *Settings* → *Pages* → *Source*: **GitHub Actions**.

4. Faça um `push` (ou *Actions* → *Deploy app* → *Run workflow*). Em ~1 min o app
   fica em:
   ```
   https://SEU_USUARIO.github.io/plantao-controle/
   ```
   Essa URL abre em qualquer rede, no celular, e dá pra instalar como app.

## Depois

Todo `git push` na branch republica sozinho. Nada mais a fazer.

## Testadores

Cada pessoa precisa de um login: no app (como líder) → **Funcionários** → cadastre
com e-mail + senha inicial. Ela entra com e-mail + senha e troca a senha em
*Meu cadastro*.
