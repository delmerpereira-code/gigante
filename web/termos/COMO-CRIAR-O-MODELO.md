# Modelo oficial do Termo de Permuta (Word)

O app preenche o **próprio documento oficial** em `.docx` e você baixa o
arquivo já pronto — o layout (brasão do Amazonas, marca da Polícia Civil,
rodapé com a onda verde/azul, fontes, molduras) fica **idêntico**, porque é
o seu arquivo. O sistema só troca o texto dos campos.

## Passo a passo (uma vez só)

1. Abra o seu `PERMUTA DE PLANTÃO.doc` no **Word** (ou no Google Docs).
2. Onde hoje existe uma linha/espaço para preencher à mão, digite a
   **etiqueta** correspondente da tabela abaixo, **com as chaves**.
   Ex.: onde vai a data, escreva `{data_permuta}`.
3. Nas caixinhas `( )` de turno e de plantão, ponha a etiqueta **dentro**
   do parêntese: `({turno_diurno})` `8h às 20h`  /  `({s_p1})P1`  etc.
   A etiqueta vira `X` quando marcada e fica vazia quando não.
4. Salve como **`.docx`** (não `.doc`) com o nome exato:
   **`permuta-modelo.docx`**
5. Coloque o arquivo nesta pasta: `web/termos/permuta-modelo.docx`
6. Publique de novo (arraste a pasta `web` no Netlify).

Pronto. Em **Permuta → termo → Baixar Word (modelo oficial)** o app baixa o
`.docx` preenchido. Permuta de mão dupla baixa **dois** arquivos
(`...-parte-B.docx`).

## Etiquetas disponíveis

| Etiqueta | Vira |
|---|---|
| `{numero}` | número interno da permuta (ex.: PERM-2026-0007) |
| `{data_permuta}` | data do plantão, DD/MM/AAAA |
| `{turno_diurno}` | `X` se for o turno das 8h às 20h |
| `{turno_noturno}` | `X` se for o turno das 20h às 8h |
| `{obs}` | observação digitada na permuta |
| `{manaus_dia}` `{manaus_mes}` `{manaus_ano}` | data de hoje por extenso ("Manaus, __ de __ de __") |

### Requerente a ser substituído (quem sai) — prefixo `s_`
| Etiqueta | Vira |
|---|---|
| `{s_nome}` | nome completo |
| `{s_cargo}` | cargo por extenso |
| `{s_matricula}` | matrícula |
| `{s_lotacao}` | lotação (campo em Config) |
| `{s_celular}` | celular |
| `{s_p1}`…`{s_p5}` | `X` no plantão dele (PL I → p1 … PL V → p5) |

### Requerente substituto (quem cobre) — prefixo `t_`
| Etiqueta | Vira |
|---|---|
| `{t_nome}` `{t_cargo}` `{t_matricula}` `{t_lotacao}` `{t_celular}` | idem acima |
| `{t_p1}`…`{t_p5}` | `X` no plantão dele |
| `{t_exp}` | `X` em EXPEDIENTE (quando o substituto não é de plantão) |

## Dicas

- Digite cada etiqueta **de uma vez** (sem parar no meio, sem corretor
  automático trocando aspas). Se o Word quebrar a etiqueta em pedaços, o
  sistema ainda tenta juntar, mas o mais seguro é digitar direto.
- Não use "aspas curvas" — só as chaves `{ }` normais.
- Pode repetir a mesma etiqueta quantas vezes precisar.
- Enquanto o `permuta-modelo.docx` não existir, o botão avisa e você pode
  usar o **Imprimir / PDF** (reprodução em HTML) como alternativa.
