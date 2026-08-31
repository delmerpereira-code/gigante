// Edge Function: criar-login
// Cria a conta de acesso de um funcionário (login = matrícula).
// Só o líder pode chamar. Usa a chave admin → sem limite de e-mail / validação.
//
// Deploy:
//   - Painel Supabase → Edge Functions → Deploy a new function → nome "criar-login"
//     → cole este arquivo → Deploy.
//   - ou:  npx supabase functions deploy criar-login --project-ref lzofyvjetfahkaywapsd
import { createClient } from "jsr:@supabase/supabase-js@2";

const DOMINIO = "plantao.app"; // domínio do e-mail interno do login

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    // quem chamou tem que ser líder
    const asUser = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: ehLider, error: e1 } = await asUser.rpc("is_lider");
    if (e1) return json({ ok: false, error: e1.message }, 200);
    if (ehLider !== true) return json({ ok: false, error: "Só o líder pode criar acessos." }, 200);

    const { matricula, email, senha } = await req.json().catch(() => ({}));
    const ident = String(email ?? matricula ?? "").trim().toLowerCase();
    const pass = String(senha ?? "");
    if (!ident) return json({ ok: false, error: "Informe o e-mail." }, 200);
    if (pass.length < 6) return json({ ok: false, error: "A senha precisa de pelo menos 6 caracteres." }, 200);

    const loginEmail = ident.includes("@")
      ? ident
      : ident.replace(/[^a-z0-9]+/g, "") + "@" + DOMINIO;

    const admin = createClient(url, service);
    const { data, error } = await admin.auth.admin.createUser({
      email: loginEmail,
      password: pass,
      email_confirm: true,
    });
    if (error) {
      const m = error.message || String(error);
      if (/already been registered|already exists/i.test(m)) {
        return json({ ok: false, error: "Já existe uma conta com esse e-mail." }, 200);
      }
      return json({ ok: false, error: m }, 200);
    }
    return json({ ok: true, user_id: data.user!.id, login_email: loginEmail }, 200);
  } catch (e) {
    return json({ ok: false, error: String((e as Error)?.message ?? e) }, 200);
  }
});
