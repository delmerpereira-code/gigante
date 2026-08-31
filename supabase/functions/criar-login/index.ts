// Edge Function: criar-login
// Cria a conta de acesso de um funcionario (login = e-mail cadastrado).
// So o lider pode chamar. Usa a chave admin -> sem limite de e-mail / validacao.
import { createClient } from "jsr:@supabase/supabase-js@2";

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

    const asUser = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: ehLider, error: e1 } = await asUser.rpc("is_lider");
    if (e1) return json({ ok: false, error: e1.message });
    if (ehLider !== true) return json({ ok: false, error: "So o lider pode criar acessos." });

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const ident = String(body.email ?? body.matricula ?? "").trim().toLowerCase();
    const pass = String(body.senha ?? "");
    if (!/^\S+@\S+\.\S+$/.test(ident)) return json({ ok: false, error: "Informe um e-mail valido." });
    if (pass.length < 6) return json({ ok: false, error: "A senha precisa de pelo menos 6 caracteres." });

    const admin = createClient(url, service);
    const { data, error } = await admin.auth.admin.createUser({
      email: ident,
      password: pass,
      email_confirm: true,
    });
    if (error) {
      const m = error.message || String(error);
      if (/already been registered|already exists/i.test(m)) {
        return json({ ok: false, error: "Ja existe uma conta com esse e-mail." });
      }
      return json({ ok: false, error: m });
    }
    return json({ ok: true, user_id: data.user!.id, login_email: ident });
  } catch (e) {
    return json({ ok: false, error: String((e as Error)?.message ?? e) });
  }
});
