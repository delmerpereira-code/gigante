# Controle de Plantão — Especificação (v0.1)

Documento de alinhamento. Base para a implementação. Convertido de conversa em 2026-08-30.

---

## 1. Objetivo

Controlar as horas trabalhadas de funcionários em regime de plantão, garantindo que
**nenhum funcionário perca horas** quando a escala é quebrada. No pior caso, as horas
de descanso/folga perdidas viram **saldo no banco de horas**.

O sistema **valida e calcula** — aponta quebras de regra e o impacto em horas. Não faz
conformidade CLT nesta versão (sem adicional noturno, hora noturna reduzida, DSR, feriado).

---

## 2. Ciclo do plantão — 120 h (5 dias)

Ciclo contínuo, que se repete indefinidamente:

| Etapa | Janela (a partir do dia D às 08:00) | Duração | Situação |
|---|---|---|---|
| 1º Turno | D 08:00 → D 20:00 | 12 h | Trabalhando |
| Descanso protegido | D 20:00 → D+1 20:00 | 24 h | **Protegido** |
| 2º Turno | D+1 20:00 → D+2 08:00 | 12 h | Trabalhando |
| Folga | D+2 08:00 → D+5 08:00 | 72 h | **Protegido** |
| (reinício) | D+5 08:00 → ... | — | Novo 1º Turno |

- Trabalho efetivo por ciclo: **24 h** (2 turnos de 12 h).
- Período protegido por ciclo: **96 h** (24 h + 72 h).
- "Protegido" = o funcionário não deve ser convocado. Não é bloqueio absoluto (ver §5).

---

## 3. Equipe (12 pessoas + gerente)

### 5 plantões fixos — 2 pessoas por plantão, trabalhando os turnos juntas

| Plantão | Dupla titular |
|---|---|
| PL I  | Cássia + Geciane |
| PL II | Elizete + Maryah |
| PL III | Melanye + Nádia |
| PL IV | Camila + Patrício |
| PL V  | Adriana + Célia |

### 2 coringas

- Tainá + (2ª a confirmar no cadastro).
- **Cobrindo vaga** (férias / licença de um titular): assume o **ciclo completo de 120 h**
  no lugar do titular, com **as mesmas proteções**. Enquanto uma coringa cobre vaga,
  a outra fica **sozinha no sobreaviso**.
- **Sobreaviso** ("bombeiro"): fica em casa e **só trabalha se acionada**. Não acionada = 0 h.
  A escala registra **quem é o sobreaviso de cada dia**, mesmo sem acionamento.

### Cargo, regime e líder

- **Cargo** (`investigador` / `delegado` / `diretor`): informativo. O Delegado é o chefe
  do plantão, mas **não aprova** nada relacionado a funcionários.
- **Regime** (`plantao` / `coringa` / vazio): define se a pessoa entra na rotação, é
  coringa, ou está fora da escala (ex.: direção).
- **Líder** (`sim` / `nao`): flag de acesso — faz a **manutenção do sistema** (cadastro,
  config) e **aprova permutas / recebe a comunicação de férias**. Hoje quem tem é a
  Diretora, mas pode mudar. Substitui o antigo papel "gerente".

### Cadastro pessoal

Cada funcionário edita os **próprios** dados: nome completo, nome curto, foto,
celular, celular 2, nascimento. **Matrícula, cargo, regime, plantão, líder, status,
saldos** são do Líder. Chave interna: `id`. Identificador humano: `matricula`.
Exibição em todo o sistema: `nome_curto`.

### Papéis e visibilidade

Cada pessoa vê só o que é dela + o que é comum a todos. Simulado localmente pelo
seletor **"Ver como"** (Líder ou um funcionário); com a API entra o login real.

| Área | Quem vê |
|---|---|
| Calendário, Escala | Todos |
| Férias — períodos marcados de todos | Todos |
| Férias — saldo detalhado | O próprio + Gerente |
| Banco de horas | O próprio + Gerente |
| Eventos (folga, convocação, sobreaviso) | O próprio + Gerente |
| Permuta | A, B e Gerente |
| Funcionários, Config / Dados | Só Gerente |

---

## 4. Rotação da escala

Os 5 plantões entram no ciclo defasados em 1 dia. Consequência: todo dia há um plantão no
1º turno e outro no 2º turno; o plantão do 2º turno de hoje é o que fez o 1º turno ontem.

- **Âncora:** `2026-09-01`. Nesse dia o **PL IV** inicia o 1º turno (dia 1 do ciclo dele).
- **Ordem de entrada no ciclo:** PL IV → PL V → PL I → PL II → PL III → (repete).
- Rotação contínua, válida para frente e para trás da âncora.

### Fórmula

```
delta = dias_inteiros(data - 2026-09-01)
offset = { "PL IV":0, "PL V":1, "PL I":2, "PL II":3, "PL III":4 }
fase(plantao, data) = ((delta - offset[plantao]) mod 5 + 5) mod 5
```

| fase | Significado no dia |
|---|---|
| 0 | Faz o **1º turno** (08:00–20:00) |
| 1 | Está no **descanso protegido** de dia e faz o **2º turno** à noite (20:00–08:00) |
| 2 | Encerra o 2º turno às 08:00; **folga** a partir daí |
| 3 | Folga |
| 4 | Folga (até 08:00 da fase 0 seguinte) |

Conferido contra a planilha "1ª QUINZENA — SETEMBRO/2026".

---

## 5. Quebra de período protegido

Pode acontecer por acordo entre as partes. O sistema **sempre**:

1. **Registra a quebra explicitamente** (evento com marcação de irregularidade).
2. **Calcula o impacto em horas** e lança no banco de horas do funcionário:

   ```
   horas_folga_perdidas = fim_do_periodo_protegido − momento_da_convocacao
   credito_folga  = horas_folga_perdidas  × mult_folga_perdida      (padrão 1:1)
   credito_trabalho = horas_trabalhadas_na_convocacao × fator_convocacao (padrão 1:1)
   ```

3. Se um **novo ciclo começar antes de terminar o atual** (por acordo), **todas as horas
   impactadas** vão para o banco. Teoricamente o novo ciclo só deveria começar após o
   término do atual.

Cenários cobertos:

- Convocado durante o **descanso de 24 h** → impacto = fim do descanso − convocação.
- Convocado durante a **folga de 72 h** → impacto = fim da folga − convocação.
- Coringa de sobreaviso **acionada** → horas trabalhadas entram no **banco dela** (1:1).

---

## 6. Banco de horas

Livro-caixa (ledger). Cada movimento é uma linha:

| Campo | Descrição |
|---|---|
| data_hora | Quando o movimento foi lançado |
| pessoa | A quem pertence o saldo |
| sentido | `entrada` (crédito) ou `saida` (débito) |
| horas | Quantidade (decimal) |
| motivo | `folga_perdida`, `convocacao`, `sobreaviso_acionado`, `abatimento`, `ajuste_manual`, `saldo_inicial` |
| evento_id | Referência ao evento que gerou (quando houver) |
| saldo_resultante | Saldo da pessoa após este movimento |

- Sem validade, sem teto, sem regra fixa de abatimento (por enquanto).
- `(BCO DE HORAS)` na escala = pessoa de folga **abatendo saldo** → gera `saida`.
- O essencial é ter **entrada e saída** de todas as horas rastreadas.

---

## 6.1. Férias e licenças

- Cada pessoa tem um **direito anual** (`dias_ferias_ano`, padrão 30). O sistema
  controla o consumido no ano-calendário; férias que estouram o saldo são bloqueadas.
  Licença médica **não** consome o saldo.
- Marcar férias é **comunicação** à gerente — não há aprovação. Antecedência abaixo de
  `antecedencia_ferias_dias` só gera alerta.
- Ao escolher o período o sistema classifica (`Eventos.nivel`):

| Nível | Quando | Ação |
|---|---|---|
| 🟢 `livre` | Há coringa disponível e o sobreaviso se mantém | Registra |
| 🟡 `impacto` | Sobreaviso ficará descoberto; 2ª+ cobertura simultânea; antecedência curta; plantão com 1 titular | Registra + **alerta** (decisão do gestor) |
| 🔴 `bloqueado` | Nenhuma coringa cobre o período; sobreposição com o parceiro da mesma dupla; coringa sem outra coringa de reserva; estouro de saldo | **Não registra** |

- Avaliação **dia a dia**: para cada dia do período conta titulares fora (cada um
  consome 1 coringa) contra coringas disponíveis (total − coringas de férias). O nível
  final é o pior dia.
- Quando cai em 🟡/🔴, o sistema sugere a **próxima janela 🟢** de mesma duração.

---

## 7. Parâmetros configuráveis (aba `Config`)

| Parâmetro | Padrão | Uso |
|---|---|---|
| `ancora_rotacao` | 2026-09-01 | Marco zero da rotação |
| `ordem_rotacao` | PL IV;PL V;PL I;PL II;PL III | Ordem de entrada no ciclo |
| `mult_folga_perdida` | 1 | Multiplicador das horas de folga perdidas |
| `fator_convocacao` | 1 | Fator das horas trabalhadas em convocação irregular |
| `credito_sobreaviso` | 0 | Crédito por tempo de sobreaviso **não** acionado |
| `dias_ferias_padrao` | 30 | Direito anual de férias quando o funcionário não tem valor próprio |
| `antecedencia_ferias_dias` | 30 | Antecedência mínima para comunicar férias (só alerta) |
| `permuta_prazo_horas` | 12 | Prazo antes do início do turno para fechar a permuta |

Valores acima são ponto de partida — sujeitos a negociação futura.

---

## 8. Arquitetura

- **Frontend:** `web/index.html` (responsivo, desktop + celular) hospedado no **GitHub Pages**.
- **API:** Google Apps Script Web App (`apps-script/Codigo.js`), publicado como JSON
  (`ContentService`). POST com `Content-Type: text/plain` para evitar preflight CORS.
- **Banco:** Google Sheets — uma aba por entidade.

### Abas da planilha

| Aba | Colunas |
|---|---|
| `Funcionarios` | id (chave interna), matricula (visível, única), nome_completo, nome_curto (exibição), foto (dataURL ~220px), celular, celular2, nascimento, cargo (`investigador`/`delegado`/`diretor`), regime (`plantao`/`coringa`/`` — fora da escala), plantao (PL I..PL V), lider (`sim`/`nao`), admissao, status (`ativo`/`ferias`/`licenca`/`afastado`), saldo_inicial_banco, dias_ferias_ano |
| `Plantoes` | codigo (PL I..PL V), pessoa_1, pessoa_2 |
| `Config` | chave, valor |
| `Eventos` | id, tipo, pessoa, substituto, inicio, fim, irregular (`sim`/`nao`), nivel (`livre`/`impacto`/`bloqueado`, só férias/licença), obs |
| `BancoHoras` | data_hora, pessoa, sentido, horas, motivo, evento_id, saldo_resultante |
| `Permutas` | id, numero (`PERM-AAAA-NNN`), pessoa_a, pessoa_b, turno_a_data/parte/inicio/fim, mao_dupla, turno_b_data/parte/inicio/fim, obs, estado, criada_em, historico |
| `ContaPermutas` | data, de (devedor), para (credor), horas, tipo (`divida`/`quitacao`), permuta_id, obs |
| `_USUARIOS` | Usuario, Senha, Nome, Perfil (`ADMIN`/`CONSULTA`), Ativo |

### Tipos de evento (`Eventos.tipo`)

`ferias`, `licenca_medica`, `folga_abatendo_banco`, `troca`, `convocacao`,
`sobreaviso_escalado`, `sobreaviso_acionado`.

---

## 9. Módulos

1. **Motor de rotação** — dada uma data/hora, retorna a fase de cada plantão e o estado
   de cada pessoa (turno / descanso 24 h / turno / folga 72 h).
2. **Validador de proteção** — dado um evento de convocação, detecta se cai em período
   protegido, marca a quebra e calcula o impacto (§5).
3. **Banco de horas** — livro-caixa com entrada/saída e saldo corrente por pessoa.
4. **Sobreaviso** — escala diária do "bombeiro"; acionamento gera evento + lançamento.
5. **Cobertura de vaga** — férias/licença: coringa assume o ciclo do titular.
6. **Tela de escala** — grade mensal (modelo do anexo), com marcação de substituição/quebra.

---

## 10. Entregas

- **1ª entrega (feita):** motor de rotação + tela de escala reproduzindo **setembro/2026**.
- **2ª entrega (feita):** cadastro de funcionários, eventos (férias, licença, folga
  abatendo banco, troca, convocação, sobreaviso), banco de horas com livro-caixa e
  ajuste manual, tela de parâmetros e backup — tudo em `localStorage`, sem backend.
- **3ª entrega (feita):** papéis e seletor "Ver como" (visibilidade por pessoa/gerente),
  tela **Calendário** (gantt mensal + alertas), tela **Férias** (saldo anual + semáforo
  de disponibilidade 🟢/🟡/🔴 + próxima janela livre). Gerente como 13ª pessoa.
- **4ª entrega:** **permuta** de turno — máquina de estados (proposta → termo → aprovação
  da gerente → confirmação de B → confirmada), termo imprimível com nº de registro,
  regra das `permuta_prazo_horas` (fluxo todo fecha antes do turno), lançamento no banco
  na permuta de 1 perna (B +12 h / A −12 h).
- **Depois:** publicar planilha + API Apps Script (persistência real e multiusuário),
  login por `_USUARIOS`, substituições de coringa desenhadas na grade da escala,
  recálculo de eventos ao mudar parâmetros.

Regras de banco de horas por tipo de evento (2ª entrega):

| Tipo | Lançamento |
|---|---|
| `convocacao` em período protegido | `entrada` folga perdida (× `mult_folga_perdida`) + `entrada` trabalho (× `fator_convocacao`) |
| `convocacao` fora de proteção | `entrada` só do trabalho (× `fator_convocacao`) |
| `sobreaviso_acionado` | `entrada` das horas trabalhadas (× `fator_convocacao`) |
| `sobreaviso_escalado` | `entrada` (× `credito_sobreaviso`; 0 por padrão = só registro) |
| `folga_abatendo_banco` | `saida` das horas da folga |
| `ferias`, `licenca_medica`, `troca` | só registro, sem banco (férias/licença ganham `nivel`) |

---

## 10.1. Permuta (4ª entrega — implementada; texto do termo provisório)

Permuta é **acordo entre funcionários** — **não passa pelo banco de horas**. O sistema
só registra o acordo e mostra **quem deve horas a quem**, para eles se organizarem.

- **Unidade:** um turno de uma data — **diurno** (08–20) ou **noturno** (20–08).
- **Mão dupla** (troca de dia: "me cobre hoje, te cubro amanhã") → as duas pernas se
  anulam, **nenhuma dívida**.
- **Mão única** (A passa o turno, B cobre, sem contrapartida) → **A fica devendo 12 h a B**.
- **Conta entre funcionários** (livro próprio, fora do `BancoHoras`): cada linha =
  `de` (devedor), `para` (credor), `horas`, `permuta_id`, `tipo` (`divida` / `quitacao`).
  `saldoEntre(A,B)` = líquido. Quitação: registro manual "A pagou X h a B".
- **Estados:** `proposta` → `termo_gerado` → `aprovada` (Líder) → `aguardando_confirmacao`
  (B) → `confirmada` (entra na escala e na conta) → `concluida` (após o turno).
  `rejeitada` (Líder) e `recusada` (B) e `expirada` = **encerra** (sem reenvio).
- **Prazo:** todo o fluxo tem de chegar a `confirmada` **antes de `permuta_prazo_horas`
  (12 h) do início do turno** mais próximo envolvido. Estourou → `expirada`.
- **Termo:** tela imprimível com nº de registro sequencial (`PERM-AAAA-NNN`), dados das
  duas partes, turno(s), e espaço para a aprovação do Líder. Texto a definir.
- **Visibilidade:** só A, B e o Líder.

---

## 11. Pendências

- Nome da 2ª coringa e confirmação final dos 12 nomes (cadastro em uso — hoje com
  elenco de exemplo).
- Definir, em negociação: valores de `mult_folga_perdida`, `fator_convocacao`,
  tratamento das horas trabalhadas em convocação, regra de abatimento do banco.
- Cobertura de vaga por coringa (assume o ciclo do titular) ainda é registrada como
  evento comum — falta a coringa "herdar" o ciclo e a grade mostrar a troca.
