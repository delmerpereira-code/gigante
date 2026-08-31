# Changelog

Todas as modificações notáveis deste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

## [Não lançado]

### Adicionado
- Camada de dados local `web/store.js` (localStorage, com fallback em memória para
  testes no Node). Coleções espelham as abas da planilha — migração futura é só
  despejar os arrays.
- Tela **Funcionários** (`web/cadastro.html` + `cadastro.js`): CRUD de titulares e
  coringas, duplas por plantão derivadas automaticamente, botão de elenco de exemplo,
  saldo atual por pessoa.
- Tela **Eventos** (`web/eventos.html` + `eventos.js`): férias, licença, folga
  abatendo banco, troca, convocação e sobreaviso. Prévia do impacto e lançamento
  automático no banco de horas (convocação em período protegido gera folga perdida +
  horas trabalhadas; sobreaviso acionado credita 1×fator; folga abatendo banco debita).
- Tela **Banco de horas** (`web/banco.html` + `banco.js`): livro-caixa com saldo por
  pessoa, filtro, e lançamento manual de ajuste.
- Tela **Config / Dados** (`web/dados.html` + `dados.js`): edição dos parâmetros da
  aba `Config`, backup/restauração em JSON, recarga do elenco e limpeza.
- Navegação compartilhada (`web/nav.js`).
- `tests/teste-eventos.js`: 20 checagens sobre store.js (cadastro, impacto de
  convocação, débito de folga, remoção de evento, saldo inicial, ajuste, export/import).

#### 3ª entrega — visibilidade, papéis e férias
- **Papéis / "Ver como"** (`nav.js` + `store.js`): seletor no topo simula o papel da
  sessão (Gerente ou um funcionário). Gerente vê tudo; funcionário vê só o que é dele
  (banco de horas, seus eventos). Funcionários e Config/Dados são telas só da gerente.
  Papel `gerente` no cadastro (13ª pessoa "Gerente" no elenco de exemplo).
- Tela **Calendário** (`web/calendario.html` + `calendario.js`): gantt mensal — uma
  linha por pessoa, rotação de fundo, faixas de férias/licença/sobreaviso/convocação/
  permuta, e lista de alertas do mês (sobreaviso descoberto, coberturas simultâneas).
- Tela **Férias** (`web/ferias.html` + `ferias.js`): comunicação de férias/licença com
  **semáforo** 🟢 livre / 🟡 impacto / 🔴 bloqueado, saldo anual por pessoa e sugestão
  da próxima janela livre. Regras: bloqueia sem coringa disponível, sobreposição com o
  parceiro de dupla, coringa sem reserva, e estouro de saldo; alerta (sem bloquear)
  sobreaviso descoberto, 2ª cobertura simultânea e antecedência curta.
- `store.js`: `avaliarFerias`, `saldoFerias`, `papelAtual`/`ehGerente`/`visivelPara`,
  `dias_ferias_ano` por funcionário, novos parâmetros da aba `Config`
  (`dias_ferias_padrao`, `antecedencia_ferias_dias`, `permuta_prazo_horas`).
- `tests/teste-ferias.js`: 22 checagens (saldo, semáforo em todos os cenários,
  bloqueio no `salvarEvento`, visibilidade por papel).

### Alterado
- `web/index.html` + `app.js`: escala passa a ler as duplas do cadastro (cai no elenco
  de exemplo só quando vazio) e usa os parâmetros da aba `Config` (âncora e ordem).
- `web/eventos.html`: férias e licença saíram da tela de Eventos (agora em **Férias**);
  Eventos cobre folga/troca/convocação/sobreaviso.
- Aba `Eventos` ganhou a coluna `nivel` (livre/impacto/bloqueado das férias).
- Aba `Funcionarios` ganhou a coluna `dias_ferias_ano`.

#### 3ª entrega (cont.) — cadastro pessoal, cargos e líder
- **Cadastro reestruturado** (`store.js`): chave interna `id`, identificador visível
  `matricula`, exibição por `nome_curto`. Novos campos: `nome_completo`, `foto`
  (reduzida ~220 px, JSON local), `celular`, `celular2`, `nascimento`,
  `cargo` (investigador / delegado / diretor), `regime` (plantão / coringa / fora da
  escala), `lider` (sim/não). Migração automática dos registros antigos (`papel`→`regime`).
- **Papel `gerente` → flag `lider`.** "Ver como" agora é *Líder* (acesso total:
  manutenção do sistema + aprovação de permutas) ou um funcionário. Cargo é informativo
  (o Delegado, chefe de plantão, não aprova nada hoje).
- Tela **Meu cadastro** (`web/meu-cadastro.html` + `.js`): cada funcionário edita só os
  próprios dados pessoais (nome, foto, celulares, nascimento); matrícula/cargo/regime/
  plantão ficam travados (definição do Líder).
- Tela **Funcionários** refeita: todos os campos + upload de foto, só para o Líder.
- `web/foto.js`: redução de imagem via canvas.
- `store.js`: `salvarFuncionario(dados, apenasPessoais)`, `funcionarioPorMatricula`,
  `funcionarioPorId`, `renomearPessoa` (propaga troca de nome curto), `ehLider`,
  `ehPlantao`, `ehCoringa`.
- Aba `Funcionarios` reescrita (16 colunas); telas passam a exibir `nome_curto`.

#### 4ª entrega — permuta de turno
- Tela **Permuta** (`web/permuta.html` + `.js`): propor troca de um **turno** (diurno
  08–20 / noturno 20–08) escolhido da lista dos **próximos turnos** da pessoa;
  opção "troca de dia" (mão dupla). Fluxo `proposta` → `aprovada` (Líder) →
  `confirmada` (contraparte) → `concluída`; `rejeitada`/`recusada`/`cancelada`/
  `expirada` encerram. Prazo `permuta_prazo_horas` (12 h) antes do turno.
- **Conta entre funcionários** (`ContaPermutas`, fora do banco de horas): permuta de
  mão única gera dívida de 12 h de A para B; troca de dia não gera nada. Painel
  "minhas contas" (quem devo / quem me deve) + **registro de quitação**.
- **Termo** imprimível com nº `PERM-AAAA-NNN` (texto provisório, `@media print`).
- `rotacao.js`: `proximosTurnos(plantao, desde, quantos)` e `isoData`.
- `store.js`: coleções `Permutas` e `ContaPermutas`; `proporPermuta`, `aprovar/
  rejeitar/confirmar/recusar/cancelar/concluirPermuta`, `expirarPendentes`,
  `saldoEntre`, `contasDe`, `quitarPermuta`, `proximosTurnosDe`.
- **Calendário**: permutas confirmadas aparecem como marca de troca (P) nos dois
  envolvidos, no dia do turno.
- Evento `troca` saiu da tela **Eventos** (substituído pela Permuta).
- Resumo das contas de permuta (`Store.resumoContas`) aparece também em **Meu cadastro**
  e na ficha de **Funcionários** — "Você deve 2 turnos (24 h) a Fulana — PERM-…".
- `tests/teste-permuta.js` (24 checagens).

### Corrigido
- Tela **Férias**: o `<select>` de Pessoa voltava para o primeiro nome ao trocar
  qualquer campo (o rebuild da lista zerava a seleção). Agora preserva a escolha.
  Mesmo ajuste no `<select>` de pessoa do **Banco de horas**.

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
