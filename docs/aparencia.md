# Aparência (personalização visual): arquitetura e contrato

Fonte única para quem implementa uma parte. Tipos em `src/appearance/types.ts`, padrões em `defaults.ts`.

## Princípio
O tema Original com os padrões deve ser **idêntico** ao PRGB anterior. Tudo é só visual: nada toca áudio, detecção, pontuação, tempo ou ranking. O que for pesado no canvas se simplifica ou se desliga.

## Como cada configuração chega à tela
| Configuração | Mecanismo | Quem aplica |
|---|---|---|
| Tema (cores) | variáveis CSS em `<html>` que sobrescrevem as escalas `ink-*`, `amp-*`, `signal-*` (já existe em `services/themes.ts`, a mover para `src/appearance/themes.ts`); `data-theme="<id>"` (ausente no Original) | `appearance/apply.ts` |
| Estilo de componentes | `data-ui="soft\|sharp\|arcade"` em `<html>`; no CSS, `--radius-*` do Tailwind por `[data-ui]` (as classes `rounded-*` já usam essas variáveis) | `index.css` |
| Tipografia | `data-font="modern\|technical\|expressive"`; CSS redefine `--font-sans`, `--font-display`, `--font-mono` | `index.css` + fontes locais em `public/fonts` |
| Fundo | `data-bg="solid\|gradient\|grid\|ambient"` no `<html>`; CSS estático (sem animação, sem filtro) | `index.css` |
| Efeitos decorativos desligados | `data-effects="off"` quando `reduceEffects` ou `prefers-reduced-motion` | `apply.ts` |
| Sombra-guia e sons de acerto/erro | `GameplayAppearance.guide` (`enabled`, `intensity` 1–3, `style` `shadow` ou `hologram`; padrão ligada, 2, `shadow`) e `GameplayAppearance.hitSounds` (padrão ligado); `reducedMotion` diz se o movimento deve ser reduzido (a sombra então só troca de lugar, sem animar) | `practiceLanes.ts`, `PracticeGame.tsx` |
| Notas, cordas, efeitos de gameplay | o canvas lê `GameplayAppearance` (hook `useGameplayAppearance`) uma vez por mudança, nunca por quadro do React | `practiceLanes.ts`, `PracticeGame.tsx`, `FreePlay.tsx` |

## Sombra-guia e sons
- `guide` (estilo e opções da sombra), `hitSounds` e `reduceEffects` são escolhas do jogador: sobrevivem à troca de tema (`applyPreset` repassa o `guide` atual) e não entram na comparação "Personalizado" do tema. O estilo `hologram` é o halo luminoso original, `shadow` é a sombra escura, e a sombra cobre todas as notas que soam juntas.
- A sombra-guia é informação, não enfeite: `reduceEffects` e o movimento reduzido não a desligam, só pedem que ela não anime (`reducedMotion`).
- Opções detalhadas em `guide.shadow` (`GuideShadowSettings`, validadas campo a campo, com faixa e passo; valor fora da faixa ou do passo volta ao padrão daquele campo, dados antigos sem `shadow` recebem todos os padrões): opacidade 20–100, cor (`auto`, `black`, `string`, `white`, `amber`, `cyan`, `violet`, `green`, `red`), largura e altura 80–180 %, suavidade 0–100, deslocamento X e Y −50…50 % da altura da nota, forma (`capsule`, `ellipse`, `rounded`, `note` = cantos do estilo de nota), contorno (liga, espessura 1–6 px, cor), rastro (liga, comprimento 20–100 %, opacidade 10–100 %), pulso (liga, força), antecedência do salto 100–600 ms e curva (`smooth`, `snap`, `elastic`), cobertura de acorde (`between` cobre as cordas do meio, `played` só as tocadas), prévia da próxima nota e brilho do holograma. O estilo `hologram` usa as que cabem num brilho (cor, tamanho, opacidade, brilho, rastro, pulso, deslocamento, salto, acordes, próxima nota) e ignora forma, contorno e suavidade. Com os padrões o holograma é igual ao de antes.
- Padrão do estilo `shadow` = predefinição "Destaque": corpo escuro 40 % maior que a nota, atrás dela, com contorno na cor da corda. Predefinições em `src/appearance/guidePresets.ts` (`discreet`, `highlight`, `cinema`, `outline`, `neon`, a última usa o holograma); "Personalizada" é derivada: nenhuma predefinição igual às opções atuais. Tela: categoria "Sombra-guia" (`components/appearance/GuideSection.tsx`), com grupos recolhíveis e "Restaurar sombra"; a prévia usa as mesmas funções (`drawGuide`) e inclui acordes.
- A sombra vem antes das notas no desenho, nunca depois, e as opções chegam ao canvas por um objeto montado só quando o visual muda (nada é alocado por quadro).
- `hitSounds: false` silencia só os sons de Perfeito, Bom e Errou; o som das notas da tab e o metrônomo não fazem parte.
- Dados salvos antes destes campos continuam válidos: campo ausente vira o padrão, sem mudar a versão do esquema (`prgb:appearance:v1`).

**Preservar a nota (`guide.shadow.preserveNote`, ligado por padrão).** A sombra-guia nunca esconde a nota: o holograma vira um anel (preenchimento fraco e a luz na borda, sem núcleo denso), o corpo escuro do estilo Sombra fica abaixo de 85% de opacidade, a guia é desenhada atrás das notas e uma nota curta encolhida pelo espaçamento nunca fica menor que 1,9 rem. Desligado, volta ao desenho antigo.
**Tamanho das notas (`noteSize`).** Escolha do jogador, como `hitSounds`: fica fora do tema, sobrevive à troca de tema e não entra no "Personalizado". O cartão "Espaçamento" do jogo (antes "Zoom") só muda a distância entre as notas, não o tamanho.

## Persistência
Chave `prgb:appearance:v1` no `localStorage`, validada campo a campo (valor inválido volta ao padrão, versão desconhecida nunca derruba). Aplicada **antes da primeira pintura** por um script externo `public/appearance-boot.js` (a CSP não aceita script inline), que só aplica atributos e variáveis. Entra no export e na exclusão de dados locais (`localData.ts`), na Política (`legal.ts`) e é limpa por "Restaurar padrões".

## Regras
- Cores do gameplay (cordas, jogadores, acerto/quase/erro, linha de acerto) têm tokens próprios (`--color-string-*`, `--color-player-*`, `--color-play-signal`, `hit`, `near`, `miss`). Tema nenhum os altera; só o esquema de cordas (Original/Vibrant/Pastel) escolhe outro conjunto, sempre na ordem das cordas.
- Acerto e erro nunca dependem só de cor (texto/forma já existem; efeitos não os substituem).
- Sem biblioteca nova. Fontes novas só locais, em woff2, só os pesos usados.
- `prefers-reduced-motion` e `reduceEffects` desligam efeitos animados e glow.
- Sem flash estroboscópico: nenhum efeito pisca mais de 3 vezes por segundo nem muda a luminância da tela inteira de forma brusca.
- UI em pt-BR, tokens PRGB, alvos de 44 px, foco visível, teclado.

## Estado da implementação (o que existe)
- **Núcleo** (`src/appearance/`): `types.ts` e `defaults.ts` (contrato), `validate.ts` (leitura campo a campo; versão mais nova nunca derruba), `themes.ts` e `presets.ts`, `apply.ts` (plano de atributos e variáveis no `<html>`), `useAppearance.ts` (store externo com `useAppearance`, `useGameplayAppearance`, `setAppearance`, `applyPreset`, `resetAppearance`, `exportAppearance`, `clearAppearance`), `bootScript.ts` + `public/appearance-boot.js` (pintura antes do React).
- **Reduzir efeitos**: `toGameplayAppearance` zera glow das cordas e os cinco efeitos quando `reduceEffects` ou `prefers-reduced-motion` valem; `apply.ts` põe `data-effects="off"`. O HUD usa o mesmo resultado, então não há caminho em que o brilho apareça com movimento reduzido.
- **Brilho do COMBO no HUD** (`GameHud.tsx` + `hudGlow.ts`): com `effects.comboGlow`, o número do COMBO ganha um `text-shadow` na cor `signal-400`, de alpha até 0,3 (mesmo teto do canvas, escalado pela intensidade), crescendo com `comboGlowTarget(combo)` e com transição de 500 ms. Não cria estado por quadro: o HUD já re-renderiza quando o placar muda e o estilo é só calculado.
- **Dados locais**: `buildLocalDataExport` inclui `appearance` (`{ version, settings }` ou `null`); `clearLocalData` chama `clearAppearance()`, que remove a chave (mesmo de versão mais nova), volta o estado ao padrão e reaplica o `<html>` na hora (atributos `data-*` removidos ou redefinidos e variáveis do tema retiradas). A tela ainda recarrega em seguida (`LocalDataControls`), e o script de boot, sem chave salva, aplica o Original. A Política (`dados-no-navegador`) e `CONSENT_COPY.localDataDescription` citam a aparência; `LEGAL_VERSION` não muda, porque nada sai do dispositivo.
- **Offline** (`vite.config.ts`): entram no precache as fontes IBM Plex (tipografia "technical") e os chunks lazy do próprio conteúdo, reconhecidos pelo caminho do código-fonte: `src/content/songs/*`, `components/RepertoireLibrary`, `components/AppearanceScreen*` e `components/appearance/*`. Ficam de fora, de propósito, o cliente Supabase e o motor neural (`assets/nam-*`).
- **Não verificado**: as telas no navegador real, Firefox, Safari e celulares; a regra de cache para o chunk da tela de Aparência (ela só será provada quando o chunk existir no build).

## Unidades

O jogo roda em telas muito diferentes (um notebook de 1366x768, um monitor QHD, um 4K com escala do Windows), então **nada que o jogo desenha tem tamanho fixo em pixels**:

- **A nota** é uma fração da distância entre duas cordas (`stringSpacing`): 72% no tamanho Normal, vezes o "Tamanho das notas" (`appearance.noteSize`: 80, 100, 125 ou 150%), entre 50% e 92% do espaçamento, para duas notas de cordas vizinhas nunca se tocarem. Os limites absolutos são em **rem** (1,5 a 4,5 rem), lidos da fonte raiz do navegador. A conta está em `noteDiameterFor` e `computeLaneMetrics` (`practiceLanes.ts`).
- **O que fica dentro da nota** é fração dela: a fonte do número é metade do diâmetro, com piso de 0,875 rem; o subtítulo, o contorno, o brilho, o rastro e o salto da sombra-guia escalam com o diâmetro (`unit = diâmetro / MAX_NOTE_HEIGHT`, em que `MAX_NOTE_HEIGHT` é só o denominador das razões, não um tamanho nem um teto).
- **A fonte raiz** (`readRootFontPx`) é lida **só quando o canvas muda de tamanho**, nunca por quadro; o resultado fica em `laneGeometry` no `PracticeGame`.
- **Só são pixels**: linhas finas de 1 px (os fios claros do contorno da sombra) e o `devicePixelRatio` da camada em cache.
- **Telas e componentes** usam rem e os tokens do Tailwind (`min-h-11`, `p-3`), nunca valores arbitrários em px para o tamanho de um conteúdo.

### Duas unidades no canvas

Tudo o que o canvas desenha usa uma de duas unidades, e nenhuma é um número de pixels de uma tela:

| Unidade | O que é | Onde vale |
|---|---|---|
| **`u = remScale(rootPx)`** (`rootPx / 16`) | A fonte raiz do navegador sobre 16 px. Os tamanhos escritos para 16 px passam por ela, então seguem a raiz (o zoom da página e a escala de telas grandes do `index.css`). | Fundo da pista (`drawLaneBackground(..., rootPx)`): trilho e brilho das cordas, tracejado, rótulos das cordas, barra e brilho da linha de acerto, nome do jogador; margem superior da pista (`layoutLanes(..., rootPx)`); limites da linha de acerto (`hitLineX(width, rootPx)`: 7,5 rem a 22,5 rem, no máximo 40% da largura); margens das linhas de compasso e do corte fora da tela. |
| **`fxUnit = noteScaleOf(diâmetro)`** | O tamanho da nota sobre os 46 px para os quais os efeitos foram desenhados. | Texto de feedback ("Perfeito!", "Bom", "Errou"), faíscas e partículas (`playHitFeedback(..., unit)`, `GameEffects.onJudgement(..., unit)`), anel de pulso, brilho do combo (`EffectArea.unit`), nome do acorde, brilho e rastro da nota (`drawNoteGraphic`), sombra-guia. |

A janela de música é por tempo, não por pixel: a escala horizontal vem de `basePixelsPerMs(largura, linha)` (4 s de música à frente da linha em qualquer tela larga; numa tela estreita, `trackPixelsPerMs` põe um piso para a nota ter o seu lugar: ~2 s em 360 px), e o desvanecimento com a distância (`depthAt`) corre sobre a pista inteira à direita da linha. A `FreePlay` usa a mesma janela para o histórico das notas (4 s à esquerda da linha, que fica a 9% da largura do fim, no mínimo 7,5 rem), e o teste de latência desenha a faixa como fração da altura de 9,375 rem, com a mesma linha do jogo. A miniatura da tela Aparência usa frações da largura e a mesma janela.

**No CSS**: sombras e raios em rem (`index.css`), tamanhos de texto e consultas de altura em rem (`text-[0.6875rem]`, `max-height:31.25rem`: a consulta usa o rem inicial do navegador, 16 px), a grade de fundo em rem, e a escala da fonte raiz em telas grandes: 112,5% a partir de 137,5 rem (2200 px), 125% a partir de 150 rem (2400 px) e 150% a partir de 200 rem (3200 px). Full HD fica em 100%; uma QHD sem escala do sistema cresce 25%.

**Janelas baixas.** A variante `short:` (`@custom-variant` em `index.css`, altura até 37,5 rem = 600 px) dobra o cabeçalho do jogo e o placar numa linha e o rodapé numa linha com rolagem horizontal fina, para a pista manter a altura. Em 1856x397 a pista passou de 174 px (44% da janela) para 279 px (70%); em 1280x600, de 377 px para 482 px (80%).

**O que continua em pixels, de propósito:**

- Fios de 1 px e de 1,5 px (linhas de compasso, fio claro do contorno da sombra, grade das amostras da tela Aparência) e as bordas de 1 px do CSS: uma linha fina tem de continuar fina, em qualquer tela.
- Os contornos de foco (`outline: 2px` e `3px`) e os sombreamentos de 1 px e 2 px das bordas dos temas: são traços de acessibilidade e de acabamento, não dimensões de conteúdo.
- O `devicePixelRatio` da camada em cache e o tamanho do `<canvas>` em pixels do dispositivo.
- Os números de referência de cada fórmula (por exemplo 13 em `13 * u` ou 46 em `noteScaleOf`): são o tamanho para o qual a fórmula foi escrita, usados só como razão.
- A divisória de 2 px entre as pistas do duo.

## Técnicas na pista e espaçamento

**Técnicas.** `appearance.techniques` tem dois interruptores, do jogador (ficam quando ele troca de tema, como `noteSize`): `show` (padrão ligado; desligado, a pista mostra só os números) e `legend` (padrão ligado; a legenda dos símbolos na tela Aparência e na primeira partida). Só o desenho muda, nunca a pontuação.

Como os campos do parser chegam (conferido nos exercícios do app, em `techniques.ts`): `hammerOnOrPullOff` está na nota de **destino** (a que não é palhetada; H se a casa sobe em relação à anterior na mesma corda, P se desce); `slide` está na nota de **origem** e o destino é a próxima nota da corda (`shift` repalheta o destino, `legato` não); uma ligadura (`tie`) o parser já funde na nota anterior.

- **Bloco único.** Notas ligadas em sequência na mesma corda (5-7-8-7-5, um slide e o que vem depois) são **uma** pílula contínua, com um contorno só e um segmento por nota, de largura proporcional ao tempo dela. O ponto de cada segmento é onde a nota cai; a primeira (palhetada) fica em tom cheio e as que só a mão esquerda faz (hammer-on, pull-off, slide legato) em tom mais claro. Em cada divisão: um selo circular (H, P, `/` ou `\`) e uma seta pequena (ou o traço do slide), mais um arco pontilhado discreto atrás. Um segmento nunca é mais estreito que uma nota curta (1,05 vezes a altura); numa sequência rápida demais o bloco cresce além do tempo das notas, em vez de os números se sobreporem.
- **Slide que só entra ou sai** de uma nota: uma cunha curta ao lado dela, fina onde começa e grossa onde chega, com o selo.
- **Palm mute:** um colchete tracejado sobre **todo** o trecho de notas seguidas com palm mute, com um único rótulo PM que fica à vista enquanto o trecho passa. Nunca um selo por nota.
- **Vibrato:** uma onda sob a nota (ou sob o segmento). **Bend:** o tamanho em tons depois da seta (`↑¼`, `↑½`, `↑1`, `↑1½`). Nota morta é `x` e fantasma é `(5)`. Nota curta sem técnica continua sendo um círculo simples.
- Tudo é uma fração da altura da nota (sem px fixo), com forma e letra além da cor, e sem alocar por quadro (o bloco escreve em vetores já criados).

**Espaçamento automático (`noteSpacing.ts`).** A escala segue o quanto a música está cheia, medida pelos intervalos entre ataques (de qualquer corda; um acorde é um ataque) numa janela de 2 s, com um percentil baixo (25%) para um trecho rápido não se perder na média: entre 240 ms e 900 ms de intervalo a escala é 1 (colcheias até ~125 BPM e semínimas até ~67 BPM: uma peça uniforme fica idêntica ao 1× simples); trechos **mais rápidos diminuem** a escala (a pista anda mais devagar em px/s e cabem mais notas), até 0,7; trechos **mais lentos aumentam**, até 1,5 (acima disso dá desconforto). Rampas de 1,5 s, que começam antes de um trecho rápido chegar à linha, mantêm a velocidade de rolagem sem degraus. Onde as notas ficam mais próximas que o tamanho delas, elas **encolhem** (até 50%, com piso em rem) e se **sobrepõem um pouco**; o fator nunca sobe para evitar isso. As notas de um hammer-on, pull-off ou slide podem se tocar (são um bloco). A escala depende só da música, nunca da tela: os dois jogadores de uma dupla online veem o mesmo. Calibrado no catálogo inteiro: o pior toque entre círculos é 0 no notebook e na QHD (o teste barra acima de 10% do diâmetro); no celular o riff funk chega a 60%. Em trecho denso, a nota mais próxima da linha é desenhada por cima das outras.
