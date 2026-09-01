# Guardar no GitHub + publicar no Netlify

O app é estático (pasta `web/`), backend no Supabase. Fonte no GitHub
(repositório **privado** `delmerpereira-code/gigante`), hospedagem no
**Netlify** ligado ao repositório: cada `git push` reimplanta sozinho.

## 1. Autenticar o GitHub nesta máquina (uma vez)

O `gh` está logado numa conta errada. No terminal:

```
gh auth logout -h github.com -u engenharia6-beep
gh auth login          # escolha: GitHub.com → HTTPS → Login with a web browser
gh auth setup-git      # faz o git usar esse login
```

## 2. Enviar o projeto

```
git push --force origin main
```

(`--force` porque o repositório só tinha um README inicial; nossa história
de 40+ commits passa a valer.)

Se o `git push` pedir usuário/senha ou der `403 denied to engenharia6-beep`,
limpe a credencial antiga:
*Windows → Gerenciador de Credenciais → Credenciais do Windows* → remova
`git:https://github.com`. Depois repita o `git push`.

## 3. Netlify: novo site ligado ao GitHub

O site atual (`cheerful-cuchufli-ae35e4`) veio do *Netlify Drop* e **não**
liga a um repositório. Crie um novo:

1. Netlify → **Add new site → Import an existing project → GitHub**.
2. Autorize e escolha o repositório `gigante`.
3. Build settings (o `netlify.toml` já define, confira):
   - **Build command:** `sh scripts/netlify-config.sh`
   - **Publish directory:** `web`
4. **Environment variables** (Site configuration → Environment variables):
   | Nome | Valor |
   |---|---|
   | `SUPABASE_URL` | `https://lzofyvjetfahkaywapsd.supabase.co` |
   | `SUPABASE_ANON_KEY` | a chave `anon` `public` (Supabase → Settings → API) |
5. **Deploy**. A URL nova (ex.: `https://SEU-SITE.netlify.app`) abre em
   qualquer rede e instala como app. Pode renomear em Site configuration →
   Change site name, ou apontar um domínio próprio.

O `web/config.js` continua **fora do git** — o Netlify gera no build a
partir das variáveis acima.

## Depois

Todo `git push` na `main` reimplanta sozinho. O site antigo do Drop pode
ser apagado quando o novo estiver ok.

## Migrar as regras do banco

No Supabase → SQL Editor, rode em ordem os `supabase/schema_delta_*.sql`
que ainda faltarem (até o `schema_delta_8.sql`).

## Testadores

Cada pessoa precisa de login: no app (como líder/admin) → **Funcionários**
→ cadastre com e-mail + senha inicial. Ela entra com e-mail + senha e
troca a senha em *Meu cadastro*.
