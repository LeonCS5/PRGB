# Sessões de prática

Um exercício dura de uns 10 a 45 segundos: foi feito para uma volta completa, e o modo treino só repete a mesma coisa. A sessão resolve isso encadeando exercícios, sem voltar ao menu. O código está em `src/services/practiceSession.ts` (a parte pura, testada), `src/components/SessionScreen.tsx` (montagem), `src/components/SessionStrip.tsx` (transição e resumo) e no `App.tsx` (a fila e o início de cada exercício).

## Como funciona

- Uma sessão é uma fila de itens `{ code, key, pattern? }`: um exercício, um tom e, onde há mais de um, um jeito de tocar. Cada item vira uma partida solo comum, então estrelas, recordes pessoais e o ensaio da semana funcionam como sempre. **Nada novo é gravado no navegador**: a fila vive na tela enquanto a sessão dura. Sessões não valem para o ranking.
- Ao terminar um exercício aparece o resultado de sempre, com uma faixa em cima: "A seguir: X", uma contagem de 10 s (Seguir agora, Pausar contagem, Encerrar sessão) e uma barra do andamento. O exercício seguinte começa sozinho, com contagem de 3 s em vez de 5 s.
- Durante o jogo o cabeçalho mostra "Sessão 2/8", com Pular e Encerrar. Voltar (a seta ou o botão do navegador) encerra a sessão.
- No último exercício, a faixa vira um resumo: exercícios feitos, tempo, estrelas e precisão média. Tocar de novo o mesmo exercício substitui o resultado dele, em vez de contar duas vezes.

## Três jeitos de montar

1. **Etapa da trilha:** todos os passos de uma etapa, na ordem. Entradas: botão "Tocar a etapa em sequência" na etapa, ou a tela de sessão.
2. **Por tempo (10, 15 ou 20 min):** o PRGB monta a partir do ponto do jogador na trilha. A ordem é fixa: aquecimento (começando pelo mais fácil), técnica, notas e escalas, acordes e progressões, ritmo, com a fatia de tempo de cada uma (15, 15, 30, 25 e 15%). Cada parte recebe ao menos um exercício. Dentro de cada uma entram primeiro os passos sem estrela mais perto do próximo, depois os já tocados (revisão, girando por dia). Só alcança um pouco além do ponto atual; se o que está perto não enche o tempo (jogador novo), o alcance aumenta. Mesma entrada no mesmo dia, mesma sessão. O tempo é uma estimativa: soma o exercício, a contagem de entrada e a pausa entre exercícios.
3. **Montar a minha:** escolher categoria, tom e jeito de tocar e adicionar exercícios; subir, descer e remover.

## Duas formas de deixar mais longa

- **Rodar os tons:** o mesmo exercício passa por 3, 6 ou 12 tons seguidos, de quarta em quarta a partir do tom do exercício (Dó, Fá, Si bemol…). Vale só para os exercícios que mudam de tom.
- **Todos os jeitos de tocar:** cada exercício que tem mais de um jeito toca em todos, tom por tom (escalas: sobe e desce, grupos de 3, grupos de 4, terças, 3 por corda; acordes e progressões: batida e dedilhado).

As duas valem nos três jeitos de montar. O limite é de 120 exercícios por sessão.

## Limites

- Não testado com guitarra real nem com uma sessão longa de verdade (a prova foi de duas a seis peças, com microfone sintético).
- A ordem e as fatias do "por tempo" são regras minhas, não validadas com quem toca.
- Só exercícios: peças do repertório e músicas do acervo não entram na sessão.
- A lista montada à mão não é guardada: fechar a tela a descarta.
