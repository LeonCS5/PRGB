# Repertório original: procedência

Peças de domínio público (compositor morto há mais de 70 anos) com arranjo próprio. O código e a notação estão em `src/services/songs.ts`; os metadados, em `src/content/songs/index.ts`; as notas, um arquivo por peça em `src/content/songs/`. Os códigos nunca são renumerados: recordes e desafios guardam os ids (`src/services/songIds.ts`, faixa -200000 a -299999).

Regra de entrada: o compositor morreu até 1955 (`PUBLIC_DOMAIN_LAST_DEATH_YEAR`, que só avança, um ano por vez); melodia tradicional, sem autor conhecido, entra como "Tradicional"; obra composta pelo próprio PRGB entra como "Original" (o filtro de texto dos desafios reserva a palavra PRGB). O arranjo é do PRGB. Toda peça precisa ser tocada e conferida por uma pessoa antes de valer para o ranking.

| Código | Obra | Compositor | Morte | Fonte da melodia | Arranjador | Revisor | Data |
|---|---|---|---|---|---|---|---|
| 1 | Ode à Alegria (tema do último movimento da Sinfonia nº 9) | Beethoven | 1827 | Melodia do tema, de memória do agente; **jogada e aprovada pelo dono em 2026-11-17** (funciona bem tocando); não conferida contra partitura | PRGB | dono (jogou) | 2026-11-17 |
| 2 | Greensleeves (estrofe do verso, Mi menor) | Tradicional | n/a | Melodia tradicional, de memória do agente (65 a 75%); a cadência final (C#, D#) e o andamento são os pontos de dúvida | PRGB | pendente | 2026-11-17 |
| 6 | Minueto em Sol (primeira seção, duas vezes) | Petzold (atribuído a Bach) | 1733 | De memória do agente (80%), uma oitava abaixo da partitura de piano; compassos 7 e 8 menos seguros | PRGB | pendente | 2026-11-17 |
| 7 | Brilha, brilha, estrelinha | Mozart (tema tradicional francês das variações) | 1791 | Melodia tradicional, de memória (99%) | PRGB | pendente | 2026-11-17 |
| 10 | Riff de rock em Mi menor (pentatônica) | Original | n/a | Composição original do PRGB, escrita pelo agente | PRGB | pendente | 2026-11-17 |
| 11 | Riff de blues em Lá | Original | n/a | Composição original do PRGB (swing em tercinas) | PRGB | pendente | 2026-11-17 |
| 12 | Riff funk em Ré menor (pentatônica) | Original | n/a | Composição original do PRGB (semicolcheias sincopadas; pode pedir andamento menor) | PRGB | pendente | 2026-11-17 |
| 13 | Riff com saltos de oitava em Sol | Original | n/a | Composição original do PRGB | PRGB | pendente | 2026-11-17 |
| 14 | Progressão em Dó maior (I-vi-IV-V) | Original | n/a | Composição original do PRGB | PRGB | pendente | 2026-11-17 |
| 15 | Progressão em Lá menor (i-VI-III-VII) | Original | n/a | Composição original do PRGB | PRGB | pendente | 2026-11-17 |

Descartadas por falta de segurança na melodia (o agente preferiu não entregar): Atirei o pau no gato, Ciranda cirandinha, O cravo e a rosa, Para Elisa e Canon em Ré. Os códigos 3 a 5, 8 e 9 ficam livres. Só a Ode (código 1) está semeada no ranking; as outras valem recorde pessoal e desafio, não ranking.
