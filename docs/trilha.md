# Trilha de evolução

A trilha é uma ordem sugerida para a biblioteca de exercícios: do primeiro som, com as cordas soltas, até o material mais difícil. Cada passo é um exercício numa tonalidade (e, quando há mais de um jeito de tocar, num deles). Nada fica bloqueado: quem quiser pula etapas. O código está em `src/services/trail.ts` (dados e resumo) e `src/components/TrailScreen.tsx` (tela). O progresso é o mesmo que a biblioteca já guarda (`prgb:progress:v1`, chave `songId:partId`); a trilha não grava nada novo.

## De onde veio a ordem

A pesquisa foi uma leitura de programas de ensino de violão e guitarra e de guias de prática. **É uma síntese editorial, não equivale a nenhum exame**, e nenhuma das fontes valida a ordem exata das nossas 15 etapas. Fontes abertas consultadas em 2026-11-18, descritas sem nomes nem links de terceiros. Elas inspiraram a ordem, não a certificam nem têm relação com o PRGB:

| Ideia aplicada | Fonte |
|---|---|
| Escalas e arpejos crescem de uma oitava para duas e depois para mais; a velocidade pedida sobe nos graus finais | programa de exames de violão acústico de uma instituição britânica e programa de graus de violão de outra instituição de exames |
| Escalas em intervalos (terças e sextas), cromática e sétimas dominantes só nos graus avançados | o segundo desses programas |
| Tríades primeiro, depois acordes de quatro notas, depois arpejos | ementa de aula particular, nível 1, de uma escola de música e nível 2 da mesma ementa |
| Escalas de três notas por corda, com os padrões de dedos 1-2-3, 1-2-4 e 1-3-4 | guia de aprendizado do braço |
| Dois ou quatro acordes abertos bem treinados antes de ampliar; troca medida em trocas limpas por minuto (de 20 a 30 como meta de iniciante, 40 como confortável) | guia de prática de acordes e exercício de trocas em um minuto |
| Aumentar o andamento aos poucos (cerca de 5 bpm depois de várias repetições limpas), ou trocar a subdivisão sem mexer no metrônomo | artigo sobre rajadas de velocidade e artigo sobre ganho de velocidade com metrônomo |
| Palhetada econômica e saltos de corda como técnica à parte, depois do alternado | exercícios de palhetada |

O que **não** ficou provado: os números de "trocas por minuto" e de "bpm a cada rodada" são convenções de professores, sem estudo controlado nas fontes encontradas; o programa de uma entidade de exames de guitarra elétrica e a ementa completa da escola de música não foram obtidos em detalhe. Ninguém testou a ordem com alunos.

## Critérios

1. **Nível de cada exercício** (`level` 1 a 3 em `exercises.ts`) manda: dentro de uma etapa nenhum passo é mais fácil que o anterior, e nenhuma etapa tem média de nível menor que a anterior. Os testes (`trail.test.ts`) barram o contrário.
2. As quatro primeiras etapas só têm exercícios de nível 1; nível 3 só aparece da etapa 13 em diante, e as três últimas só têm nível 3.
3. **Mão antes de cabeça, cabeça antes de velocidade:** cordas soltas, dois dedos e cromático vêm antes das escalas; escalas e pentatônicas, antes dos modos e das posições de três notas por corda; ritmos simples, antes do contratempo, da síncope e das semicolcheias.
4. **Acordes em dois tempos:** abertos fáceis (duas trocas, depois quatro), depois sétimas, suspensos e F com pestana, só então a pestana móvel e o blues.
5. **Tonalidades confortáveis:** os passos usam tons com a tônica perto do começo do braço (Dó, Ré, Mi, Sol, Lá) onde isso ajuda; a biblioteca continua oferecendo os 12 tons.
6. **Sem pressão:** nenhum texto fala em perda, urgência ou falta (um teste confere). O resumo mostra o que foi feito e aponta o próximo passo sem estrela como "Continue daqui".

## As 15 etapas

| # | Etapa | Níveis | Passos |
|---|---|---|---|
| 1 | Primeiros sons | 1 | 6 |
| 2 | Primeiros acordes | 1 | 9 |
| 3 | Ritmo e primeiras progressões | 1 | 13 |
| 4 | Notas e primeiras escalas | 1 | 12 |
| 5 | Pentatônica menor | 1 a 2 | 9 |
| 6 | Mais acordes abertos | 1 a 2 | 9 |
| 7 | Pestana e blues | 2 | 9 |
| 8 | Pentatônica maior e tom maior | 2 | 11 |
| 9 | Escalas e modos | 2 | 11 |
| 10 | Técnicas da mão | 2 | 15 |
| 11 | Ritmos e levadas | 2 | 6 |
| 12 | Sétimas, arpejos e cadências | 2 | 11 |
| 13 | Braço inteiro | 3 | 10 |
| 14 | Velocidade e precisão | 3 | 9 |
| 15 | Harmonia avançada | 3 | 8 |

## Exercícios acrescentados

58 exercícios novos (a biblioteca passou de 96 para 154, e de 1.891 para 3.339 variantes), todos gerados por regras e conferidos pelos mesmos testes de antes:

- **Começo do braço:** cordas soltas, Dó maior, Lá menor e Sol maior na primeira posição.
- **Aquecimento e palhetada:** dois dedos, aranha e aranha invertida, cromático em semicolcheias e em tercinas, palhetada em semicolcheias, troca de corda.
- **Técnicas:** trinado, slide longo, slide seguido de ligado.
- **Pentatônicas:** as cinco posições emendadas (menor e maior) e seis frases curtas.
- **Escalas:** três notas por corda, posições 2 a 7, na maior e na menor natural.
- **Acordes:** sete trocas de acordes abertos, power chords I-IV-V e pestana em duas formas (maior e menor).
- **Progressões:** dez novas (tom maior, tom menor, blues de 8 compassos e a volta do blues).
- **Ritmo:** batida e pausa, tempos 2 e 4, baixo e batida, funk em semicolcheias.

## Como estender

- **Exercício novo:** código novo em `exercises.ts` (nunca reutilize nem renumere: recordes, desafios e progresso guardam esses códigos). Os testes passam a cobrir todas as variantes sozinhos.
- **Passo novo na trilha:** uma linha em `TRAIL` (`trail.ts`), no lugar que a dificuldade pedir. Mudar a **tonalidade** ou o **jeito de tocar** de um passo existente troca o conteúdo ao qual o progresso se refere; faça isso só junto com uma decisão sobre as estrelas já ganhas.
- **Etapa nova:** `id` único e estável; os testes conferem a ordem de nível.

## Limites

- Não testado com guitarra real. A ordem foi conferida por regras (nível, tom, padrões) e pelos testes, não por quem toca.
- Os exercícios de acorde são julgados pela tônica (ver as notas da biblioteca) e os de arpejo exigem notas separadas.
- A trilha vive na biblioteca de exercícios: ela não vale para o ranking, por decisão já tomada (só a demo e o repertório semeado valem).
