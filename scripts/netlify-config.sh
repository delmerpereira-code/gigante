#!/bin/sh
# Gera web/config.js no build do Netlify a partir das variáveis de ambiente.
set -e

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
  echo "AVISO: SUPABASE_URL / SUPABASE_ANON_KEY não definidas nas variáveis de ambiente do Netlify."
  echo "       O app vai subir em modo local (sem banco)."
  exit 0
fi

cat > web/config.js <<EOF
/* Gerado no build do Netlify — não editar à mão. */
window.SUPABASE_URL = '${SUPABASE_URL}';
window.SUPABASE_ANON_KEY = '${SUPABASE_ANON_KEY}';
EOF

echo "web/config.js gerado para ${SUPABASE_URL}"
