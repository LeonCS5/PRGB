# Trilha de evolução

A trilha é uma ordem sugerida para a biblioteca de exercícios: do primeiro som, com as cordas soltas, até o material mais difícil. Cada passo é um exercício numa tonalidade (e, quando há mais de um jeito de tocar, num deles). Nada fica bloqueado: quem quiser pula etapas. O código está em `src/services/trail.ts` (dados e resumo) e `src/components/TrailScreen.tsx` (tela). O progresso é o mesmo que a biblioteca já guarda (`prgb:progress:v1`, chave `songId:partId`); a trilha não grava nada novo.

## De onde veio a ordem

A pesquisa foi uma leitura de programas de ensino de violão e guitarra e de guias de prática. **É uma síntese editorial, não equivale a nenhum exame**, e nenhuma das fontes valida a ordem exata das nossas 16 etapas. Fontes abertas consultadas em 2026-11-18, descritas sem nomes nem links de terceiros. Elas inspiraram a ordem, não a certificam nem têm relação com o PRGB:

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
2. As quatro primeiras etapas só têm exercícios de nível 1; nível 3 só aparece da etapa 14 em diante, e as três últimas só têm nível 3. A média de nível é comparada com a tolerância de um décimo (uma etapa pode abrir com um passo mais fácil, como a primeira posição da pentatônica maior).
3. **Mão antes de cabeça, cabeça antes de velocidade:** cordas soltas, dois dedos e cromático vêm antes das escalas; escalas e pentatônicas, antes dos modos e das posições de três notas por corda; ritmos simples, antes do contratempo, da síncope e das semicolcheias.
4. **Acordes em dois tempos:** abertos fáceis (duas trocas, depois quatro), as primeiras progressões também com acordes abertos (G, Em, C e D; A, D e E), depois sétimas, suspensos e F com pestana, só então a pestana móvel, o blues e as progressões que dependem da pestana (etapa 8). Um teste barra qualquer progressão móvel antes dela.
5. **Tonalidades confortáveis:** os passos usam tons com a tônica perto do começo do braço onde isso ajuda; a biblioteca continua oferecendo os 12 tons. As três primeiras etapas não passam da casa 9 (um teste confere); os exercícios de nível 1 e 2 não passam da casa 20 em tom nenhum (nível 3, da casa 22).
6. **Sem pressão:** nenhum texto fala em perda, urgência ou falta (um teste confere). O resumo mostra o que foi feito e aponta o próximo passo sem estrela como "Continue daqui".

## As 16 etapas

| # | Etapa | Níveis | Passos |
|---|---|---|---|
| 1 | Primeiros sons | 1 | 6 |
| 2 | Primeiros acordes | 1 | 7 |
| 3 | Ritmo e primeiras progressões | 1 | 8 |
| 4 | Notas e primeiras escalas | 1 | 17 |
| 5 | Pentatônica menor | 1 a 2 | 9 |
| 6 | Mais acordes abertos | 1 a 2 | 9 |
| 7 | Pestana e blues | 2 | 9 |
| 8 | Progressões com pestana | 2 | 8 |
| 9 | Pentatônica maior e tom maior | 1 a 2 | 11 |
| 10 | Escalas e modos | 2 | 11 |
| 11 | Técnicas da mão | 2 | 15 |
| 12 | Ritmos e levadas | 2 | 6 |
| 13 | Sétimas, arpejos e cadências | 2 | 11 |
| 14 | Braço inteiro | 3 | 10 |
| 15 | Velocidade e precisão | 3 | 9 |
| 16 | Harmonia avançada | 3 | 8 |

São 154 passos. Cada etapa tem a sua meta (`goal`) escrita de acordo com os passos que ela tem de fato.

## Decisões da revisão crítica

- **Progressões com pestana (CONT-02).** As oito progressões de acorde móvel (exercícios 130, 131, 132, 133, 136, 140, 141 e 145) estavam na etapa 3, de nível 1, mas só têm forma de pestana, e em vários tons subiam até a casa 12 ou 14. Passaram para uma etapa própria depois de "Pestana e blues", com nível 2 (o nível dos exercícios foi de 1 para 2: ids e recordes não mudam), e nos tons em que a mão fica mais perto do começo do braço (no máximo a casa 10). A etapa 3 passou a ter as progressões com acordes abertos (115, G, Em, C e D, e 116, A, D, A e E, que antes eram da etapa 2), os power chords em tons baixos e os ritmos. Quem já tinha estrelas num passo cujo tom mudou (113, 124, 131, 132, 133, 136, 140 e 145) não as vê mais na trilha: elas continuam guardadas no progresso, no tom antigo.
- **Etapa 4 (CONT-13).** Ganhou as cordas 6 a 2 (180 a 184), que ficavam fora da trilha, e a meta passou a dizer que a etapa tem também os primeiros ligados e slides. O exercício 141 entrou na etapa 8. Os ritmos 169 e 170 vêm antes do 161, que é mais difícil.
- **Metas (CONT-13).** A de "Sétimas, arpejos e cadências" falava de jazz e blues, e a de "Harmonia avançada" de acordes alterados, que não existem na biblioteca: as duas foram reescritas pelo que os passos têm.
- **Pentatônica maior (CONT-14).** A posição 1 da maior passou a nível 1, como a da menor (tinham a mesma dificuldade). O exercício 138 descreve o bVII, não "o acorde de sétima menor", e a "Volta do blues" (154) diz que toca I, IV, I e V.
- **Limite de casas (CONT-15).** Os níveis 1 e 2 vão até a casa 20 (antes, até 22: 91 variantes pediam a casa 22 e 111 a casa 21). Acima disso a posição desce uma oitava. "Oitavas" (187) passou a começar nas cordas soltas para E e A. Um teste confere a casa mais alta de cada exercício, por nível.
- **Grafia dos tons (CONT-03).** Cada tom é escrito com um só tipo de acidente: Db, Eb, Ab e Bb com bemol; F#, B, E, A, D e G com sustenido. No tom menor vale a armadura do menor: C#m e G#m com sustenido, Ebm e Bbm com bemol. O título e os nomes dos acordes seguem isso ("em Db" mostra Db, Gb e Ab). O seletor de tom da biblioteca continua com a lista antiga (C# e Ab).
- **Cifra (CONT-20).** Nomes e descrições de exercícios usam cifra (C, Am, G, A, D), não Dó, Lá, Sol.
- **Textos (UX-10).** "Casa" em vez de "traste", títulos sem "Maior" ou "Menor" soltos, glossário curto nas notas das categorias (tônica, tom e semitom, números romanos, pestana, "blue note") e contagem falada nos ritmos.

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

## Como o jogo julga ligados e slides

Nos exercícios de ligados e de slide só a primeira nota é palhetada. O jogo trata a nota de destino de outro jeito (`classifyAttackRequirement` em `scoring.ts`):

- **Quando é uma nota ligada:** ela é marcada como hammer-on ou pull-off (`hp`), ou a nota anterior, na mesma corda, tem um slide para ela. A anterior precisa durar até ela (folga de 60 ms), em outra altura, e não pode ser nota morta nem parte de acorde. Slide que sai para o nada ou entra de baixo ou de cima não conta; qualquer outro slide vale como ligado, porque os dados não distinguem o slide que repalheta o destino, e uma nota repalhetada também muda de altura.
- **O que ela pede:** a nota exata (um semitom de diferença é a nota anterior ainda soando, e não acerta), lida por pelo menos duas leituras seguidas, depois de uma mudança de nota que nenhum acerto anterior usou. Não pede um ataque novo.
- **Tempo:** a janela de acerto vai 60 ms mais longe depois da linha, porque a leitura chega depois e o início da nota é fraco. Perfeito continua só na janela de sempre; fora dela é Bom.
- **Origem do slide:** a nota de onde o slide parte aceita como Bom as alturas por onde ele passa até o destino.
- **O que não muda:** as janelas e os pontos das notas palhetadas, o limite de pontos que o servidor confere e o que vale para o ranking.

**Quantas leituras por segundo.** O ataque, a espera do legato (duas leituras) e a regra da nota estável contam leituras, e foram calibrados para cerca de 60 por segundo. O laço de leitura só analisa nesse ritmo, medido no relógio do áudio (`fixedCadence.ts`), seja a tela de 60, 144 ou 165 Hz; numa tela de 30 Hz analisa uma vez por quadro, que é o máximo possível. Antes disso, numa tela rápida o jogo contava uma palhetada como mais de um ataque com mais frequência (em 165 Hz, 20 ataques para 16 palhetadas, contra 16 agora). Se você tem uma tela acima de 60 Hz, refaça o teste de latência.

Limites conhecidos: com guitarra de verdade nada disso foi testado, só sinais sintéticos; um palm mute ou uma nota muito baixa pode ficar abaixo do volume mínimo da leitura (`MIN_PITCH_VOLUME`) e não ser lida; ligados acima de 20 notas por segundo ainda perdem notas.

## Limites

- Não testado com guitarra real. A ordem foi conferida por regras (nível, tom, padrões) e pelos testes, não por quem toca.
- Os exercícios de acorde são julgados pela tônica (ver as notas da biblioteca) e os de arpejo exigem notas separadas.
- A trilha vive na biblioteca de exercícios: ela não vale para o ranking, por decisão já tomada (só a demo e o repertório semeado valem).
