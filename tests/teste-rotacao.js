const R = require('../web/rotacao.js');

// Esperado da planilha "1ª QUINZENA - SETEMBRO/2026"
const esperado = {
  1:  ['PL IV', 'PL III'],
  2:  ['PL V',  'PL IV'],
  3:  ['PL I',  'PL V'],
  4:  ['PL II', 'PL I'],
  5:  ['PL III','PL II'],
  6:  ['PL IV', 'PL III'],
  7:  ['PL V',  'PL IV'],
  8:  ['PL I',  'PL V'],
  9:  ['PL II', 'PL I'],
  10: ['PL III','PL II'],
  11: ['PL IV', 'PL III'],
  12: ['PL V',  'PL IV'],
  13: ['PL I',  'PL V'],
  14: ['PL II', 'PL I'],
  15: ['PL III','PL II'],
  16: ['PL IV', 'PL III'],
  17: ['PL V',  'PL IV'],
  18: ['PL I',  'PL V'],
};

let ok = true;
for (const [dia, [e1, e2]] of Object.entries(esperado)) {
  const t = R.turnosDoDia(`2026-09-${String(dia).padStart(2,'0')}`);
  const match = t.turno1 === e1 && t.turno2 === e2;
  if (!match) ok = false;
  console.log(
    `${String(dia).padStart(2)}  1º=${t.turno1||'--'} (esp ${e1})  2º=${t.turno2||'--'} (esp ${e2})  ${match ? 'OK' : 'FALHA <<<'}`
  );
}
console.log('\nResultado:', ok ? 'TODOS OK' : 'HÁ FALHAS');

// Cenário de quebra: terminou 2º turno dia 2 às 08:00, chamam de volta no 2º dia de folga
// PL IV: ciclo começa 2026-09-01 08:00. Folga: 03/09 08:00 -> 06/09 08:00.
// Convocado 04/09 10:00 (2º dia de folga), trabalha 12h.
const conv = R.avaliarConvocacao('PL IV', new Date(2026, 8, 4, 10, 0), 12);
console.log('\n--- Quebra PL IV em 04/09 10:00, 12h trabalhadas ---');
console.log(conv);
