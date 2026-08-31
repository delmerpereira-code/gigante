# Edge Function `criar-login`

Cria a conta de acesso de um funcionário (**login = e-mail cadastrado**) usando a
chave admin do projeto — assim **não** esbarra no limite de ~2 e-mails/hora do
signup comum.

## Publicar pelo painel (mais fácil)

1. Supabase → **Edge Functions** → **Deploy a new function** (ou *Create function*).
2. Nome: **`criar-login`**
3. Cole o conteúdo de [`criar-login/index.ts`](criar-login/index.ts).
4. **Deploy**.

Não precisa configurar segredos — `SUPABASE_URL`, `SUPABASE_ANON_KEY` e
`SUPABASE_SERVICE_ROLE_KEY` já são injetados automaticamente.

## Ou pelo CLI

```
npx supabase login
npx supabase functions deploy criar-login --project-ref lzofyvjetfahkaywapsd
```

## Como o app usa

Tela **Funcionários** (só líder) → ao salvar alguém com **senha inicial**, o app chama
esta função, que valida se quem pediu é líder (`is_lider()`) e cria a conta
`<matrícula>@plantao.app` com a senha. A pessoa entra com **matrícula + senha** e
troca a senha em *Meu cadastro*.

Depois de publicar, o *"Enable Sign Ups"* pode ficar **desligado** — a criação passa
toda por aqui.
