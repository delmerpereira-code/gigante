# Changelog

Todas as modificações notáveis deste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

## [Não lançado]

### Adicionado
-

### Alterado
-

### Corrigido
-

---

## [2026-08-30]

### Adicionado
- Especificação v0.1 (`docs/ESPECIFICACAO.md`).
- Motor de rotação do plantão (`web/rotacao.js` + cópia servidor `apps-script/Rotacao.js`):
  ciclo de 120 h, rotação de 5 plantões ancorada em 01/09/2026, avaliação de quebra
  de período protegido com cálculo de impacto em horas.
- Frontend da 1ª entrega (`web/index.html`, `app.js`, `style.css`): escala mensal,
  estado dos plantões por data e simulador de quebra. Roda sem backend.
- Esqueleto da API Apps Script (`apps-script/Codigo.js`): rotas de escala/estado/config,
  login por `_USUARIOS`, CRUD inicial de funcionários e eventos, `setupPlanilha()`.
- Verificado: rotação reproduz a planilha "1ª QUINZENA — SETEMBRO/2026" (dias 01–18).
