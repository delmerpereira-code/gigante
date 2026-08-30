# Controle de Plantão

Controle de horas trabalhadas para funcionários em regime de plantão (ciclo de 120 h /
5 dias), com validação de quebra de escala e banco de horas.

Projeto novo e independente. Veja a especificação completa em
[`docs/ESPECIFICACAO.md`](docs/ESPECIFICACAO.md).

## Estrutura

```
web/          Frontend estático (GitHub Pages) — desktop e celular
  index.html
  style.css
  app.js
  rotacao.js  Motor de rotação (fonte de verdade)
apps-script/  API JSON sobre Google Sheets (deploy via clasp)
  Codigo.js
  Rotacao.js  Cópia servidor do motor — manter em sincronia com web/rotacao.js
  appsscript.json
  .clasp.json.example
docs/
  ESPECIFICACAO.md
```

## Arquitetura

- **Frontend:** HTML/CSS/JS estático hospedado no GitHub Pages.
- **API:** Google Apps Script Web App publicado como JSON (`ContentService`).
  POST usa `Content-Type: text/plain` para evitar preflight de CORS.
- **Banco:** Google Sheets, uma aba por entidade
  (`Funcionarios`, `Plantoes`, `Config`, `Eventos`, `BancoHoras`, `_USUARIOS`).

## Estado atual (1ª entrega)

Somente o **motor de rotação** e a leitura da escala. Abrir `web/index.html` no
navegador já mostra:

- Escala mensal (padrão: setembro/2026, que confere com a planilha enviada).
- Estado de cada plantão numa data (turno / descanso 24 h / folga 72 h).
- Simulador de quebra: calcula horas de folga perdidas + horas de trabalho → banco.

Ainda **não** persiste dados. Cadastro, eventos (férias/licença), banco de horas e
sobreaviso entram nas próximas etapas.

## Rodar o frontend localmente

```
cd web
python -m http.server 8080
# abrir http://localhost:8080
```

## Publicar a API (quando for a hora)

1. Criar a planilha e copiar o ID para `SHEET_ID` em `apps-script/Codigo.js`.
2. `cp apps-script/.clasp.json.example apps-script/.clasp.json` e preencher o `scriptId`.
3. `clasp push`
4. Rodar `setupPlanilha()` uma vez no editor do Apps Script.
5. `clasp deploy` e usar a URL `/exec` no frontend.

## Testes

```
node tests/teste-rotacao.js   # confere a rotação contra setembro/2026
```
