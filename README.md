# Controle de Plantão

Controle de horas trabalhadas para funcionários em regime de plantão (ciclo de 120 h /
5 dias), com validação de quebra de escala e banco de horas.

Projeto novo e independente. Veja a especificação completa em
[`docs/ESPECIFICACAO.md`](docs/ESPECIFICACAO.md).

## Estrutura

```
web/          Frontend estático (GitHub Pages) — desktop e celular
  calendario.html / .js      Gantt mensal (visão geral: rotação + eventos + alertas)
  index.html / app.js        Escala mensal + estado + simulador de quebra
  ferias.html / ferias.js    Comunicação de férias com semáforo de disponibilidade
  permuta.html / permuta.js  Permuta de turno: proposta, aprovação, termo, conta A↔B
  eventos.html / eventos.js   Folga, convocação, sobreaviso
  meu-cadastro.html / .js    Dados pessoais (self-service)
  banco.html / banco.js       Banco de horas (livro-caixa + saldos + ajuste manual)
  cadastro.html / cadastro.js Funcionários — só Gerente
  dados.html / dados.js       Parâmetros (aba Config) + backup JSON — só Gerente
  nav.js                     Navegação + seletor "Ver como" (papel simulado)
  store.js                   Camada de dados local (localStorage) — espelha as abas
  rotacao.js                 Motor de rotação (fonte de verdade)
  style.css
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

## Estado atual

Roda 100% no navegador, **sem backend**. Os dados ficam em `localStorage` (por
navegador) — a tela **Config / Dados** exporta e importa tudo em JSON.

No topo há o seletor **"Ver como"**: escolha *Gerente* (vê tudo) ou um funcionário
(vê só o que é dele). É a simulação local do controle de acesso.

- **Calendário** — gantt do mês: rotação de fundo + faixas de férias/licença/
  sobreaviso/convocação/permuta + alertas (sobreaviso descoberto, coberturas
  simultâneas).
- **Escala** — grade mensal, estado de cada plantão numa data, simulador de quebra.
- **Férias** — comunica férias/licença com semáforo 🟢/🟡/🔴 (disponibilidade de
  coringa, sobreposição de dupla, saldo anual) e sugere a próxima janela livre.
- **Eventos** — folga abatendo banco, troca, convocação e sobreaviso; prévia do
  impacto e lançamento automático no banco de horas.
- **Banco de horas** — livro-caixa, saldo por pessoa, ajuste manual.
- **Funcionários** / **Config / Dados** — só Gerente: cadastro, parâmetros, backup.

Falta: publicar a planilha + API (Apps Script) e login reais; **permuta** com termo e
aprovação da gerente; a escala/calendário mostrar a troca de coringa na grade.

## Rodar o frontend localmente

Basta abrir `web/index.html` no navegador (duplo-clique). Para servir via HTTP:

```
cd web
npx --yes http-server -p 8080    # ou: python -m http.server 8080
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
node tests/teste-eventos.js    # confere cadastro, eventos e banco de horas
node tests/teste-ferias.js     # confere saldo de férias e semáforo de disponibilidade
node tests/teste-permuta.js    # confere permuta de turno e conta entre funcionários
```
