# Pesquisa de referências e direção de identidade visual do PRGB (C1)

Rascunho para decisão. Nada aqui foi aplicado ao código.

## 1. O que a pesquisa conseguiu e o que não conseguiu

| Fonte | Resultado |
|---|---|
| Buscas na web (estilos cyberpunk, neo-brutalismo, apps de música, acessibilidade) | Feitas. Resumo abaixo. |
| Realtime Colors | Lido: previsualiza cor e fonte numa página real e mostra contraste AA/AAA. Útil para validar a paleta. |
| Radix Colors | Lido: escala de 12 passos com papel fixo para cada passo (fundo, componente, borda, sólido, texto). Boa base para o motor de temas. |
| Refero | A página não devolveu categorias nem filtros; não sei se dá para navegar sem login. |
| Mobbin, Dribbble, Behance, Awwwards, Figma Community, Coolors, Color Hunt, shadcn, tweakcn, Material 3 | **Não consegui abrir como galeria** (exigem login, rolagem dinâmica ou bloqueiam leitura automática). Não vi imagem nenhuma deles. Tudo que digo sobre estilo vem de texto de artigos e de guias, não de ter olhado telas. |

Consequência: o que vem a seguir é direção fundamentada, **não** uma curadoria visual. A curadoria de imagens precisa dos seus prints (ver seção 7).

## 2. Diagnóstico do app atual

Lido em `src/index.css` e `BrandMark.tsx`:

- Fundo quase preto com tinta azulada (`ink-*`), laranja "válvula" como primária e ciano como secundária, brilho (`shadow-glow-*`) e painel com realce interno (`shadow-panel`).
- Títulos em Space Grotesk, corpo em Inter, números em JetBrains Mono. Cantos arredondados uniformes e ícones de uma única família (lucide).
- Logo: palheta com gradiente laranja e uma onda escura dentro.

Por que isso "parece IA": é a combinação padrão dos geradores de interface: fundo escuro azulado, dois neons complementares (laranja e ciano), brilho em volta de tudo, painéis arredondados iguais, fonte geométrica da moda. Nenhum elemento é feio; **nenhum é do PRGB**. Falta um traço que só existiria num produto de guitarra feito aqui (material, ruído, imperfeição, vocabulário).

Contraste hoje (WCAG, calculado): texto `ink-400` sobre o fundo 5,81:1 (ok); `ink-500` sobre o fundo **3,25:1** (reprova para texto normal; só serve para decoração); laranja sobre o fundo 7,71:1 (ok).

## 3. O que a pesquisa diz sobre os estilos

- **Cyberpunk.** Receita comum: base quase preta (#050505 a #0A0A0F), bordas de 1 px translúcidas, grade fraca no fundo, tipografia de terminal, painéis estilo HUD. Duas ressalvas importantes das fontes: neons costumam **reprovar contraste** sobre fundo escuro, e azul e vermelho saturados "vibram" sobre preto. Cyberpunk é sobre narrativa, não sobre pôr neon em tudo.
- **Neo-brutalismo.** Alto contraste, blocos, bordas grossas, cor chapada, aparência "não polida". É o mais fácil de manter acessível. Combina com o lado "periferia/cartaz" do que você pediu.
- **Dark mode.** Não inverter cores; separar camada primitiva (cores) e semântica (papéis) e redefinir só a semântica por tema. Evitar preto puro (arrasto ao rolar). Oferecer tema escuro não cumpre WCAG por si só.
- **Apps de música/guitarra.** Casos de estudo repetem dark mode para sessões longas. Há tensão sobre gamificação: um professor relata que atrapalhou os alunos; um artigo acadêmico diz que gamificação sozinha não sustenta valor. Não achei estudo que isole o efeito da identidade visual na retenção, então **não prometo que a identidade faz voltar**; o que faz voltar é o conteúdo e o progresso.

## 4. Direção proposta: "cyberpunk analógico de periferia"

Conceito: o cyberpunk que existe aqui de verdade, feito de gambiarra e luz de rua. Em vez de metrópole de vidro:

- **Luz:** letreiro de neon de bar, lâmpada de vapor de sódio, display CRT de fósforo verde, fita isolante amarela.
- **Papel e rua:** cartaz de lambe-lambe, xerox de baixa resolução, adesivo, fita cassete, pedal de guitarra pintado à mão.
- **Material:** granulado leve, bordas com leve desalinhamento, sombras duras (deslocadas, sem desfoque) no lugar do brilho difuso.

Regras que impedem a "cara de IA":

1. **Sem brilho difuso** (`shadow-glow-*` sai do padrão). Sombra dura e deslocada, ou contorno grosso.
2. **Um acento por tela**, o resto em papel/asfalto. Nada de dupla laranja+ciano em todo lugar.
3. **Cantos pouco arredondados** (0 a 4 px) e bordas de 2 px nos cartões principais; arredondado grande só em elementos que devem parecer botão físico.
4. **Tipografia com voz:** título condensado de cartaz, corpo legível, números em mono. Ver seção 6.
5. **Ícones próprios** nos pontos de marca (palheta, trilha, casa, pedal) em vez de lucide em tudo; lucide fica nas ações utilitárias.
6. **Textura sutil e desligável** (granulado/scanline), sempre respeitando `prefers-reduced-motion` e o modo calmo.
7. **Texto nunca depende só de cor de neon**; neon é acento, não corpo de texto.

## 5. Paleta candidata (tema padrão) com contraste calculado

Fundo `#0c0b0a` (asfalto morno) e superfície `#161412`. Valores abaixo são razão de contraste WCAG sobre o fundo / sobre a superfície:

| Papel | Cor | Fundo / Superfície | Uso |
|---|---|---|---|
| Texto principal ("papel") | `#ece6d8` | 15,8 / 14,8 | corpo, títulos |
| Texto secundário | `#a39d90` | 7,3 / 6,8 | legendas |
| Texto discreto (mínimo) | `#8d877b` | 5,5 / 5,2 | só texto auxiliar; nada mais escuro que isso para texto |
| Acento "sódio" | `#ff8a1f` | 8,3 / 7,8 | ação principal, foco da marca |
| Acento "fósforo" | `#7dff8a` | 15,5 / 14,5 | acerto, afinação, estado ok |
| Acento "letreiro" | `#ff3d9a` | 6,0 / 5,6 | destaque raro, palheta/conquista |
| Acento "fita" | `#ffd400` | 13,7 / 12,8 | aviso, "Bom" |
| Erro | `#ff5a5a` | 6,4 / 6,0 | errou |
| Texto escuro sobre sódio / letreiro / fita | `#0c0b0a` | 8,3 / 6,0 / 13,7 | rótulo em botão cheio |

Todas passam AA para texto normal (4,5:1). Atenção: as cores de acerto e erro do jogo (`hit`/`near`/`miss`) também precisam de forma ou rótulo além da cor (daltonismo); isso já é regra do plano (C4).

Valores são ponto de partida: só calculei contraste, **não vi essas cores juntas numa tela**. Validar no Realtime Colors e no próprio app antes de fixar.

## 6. Tipografia (candidatas, a validar visualmente)

Condição do projeto: fontes **hospedadas no próprio domínio** (privacidade e CSP), licença livre (OFL). Candidatas do Google Fonts, todas OFL:

- Título tipo cartaz: **Barlow Condensed** ou **Anton** (condensadas, peso alto).
- Título técnico alternativo: **Chakra Petch** (aparência de painel).
- Corpo: manter **Inter** (legibilidade; trocar o corpo traz risco sem ganho de identidade).
- Números e HUD: manter **JetBrains Mono**; **Space Mono** como alternativa mais "terminal".

Sugestão: trocar só o título (Space Grotesk sai) e manter corpo e mono. É a troca de maior efeito e menor risco. Não renderizei os espécimes; escolha final depende de ver o logo e a landing com cada uma.

## 7. Temas desbloqueáveis (decisão G1)

Tema padrão = cyberpunk analógico. Cada tema redefine só a camada semântica (`html[data-theme]`), mesmos componentes. Candidatos para o começo, todos liberados:

| Tema | Ideia |
|---|---|
| Asfalto (padrão) | seção 5 |
| Fósforo | CRT de fósforo verde, monocromático |
| Lambe-lambe | claro, papel e tinta, neo-brutalista, bordas grossas e sombra dura |
| Palco | alto contraste preto e branco com um acento (também tema de acessibilidade) |
| Cassete | tons de plástico e fita, laranja e creme |

Qualquer tema novo só entra com teste automático de contraste AA (C4 do plano).

## 8. Como me passar as referências visuais

Por não conseguir abrir as galerias, o caminho que funciona: **prints no chat** (3 a 8 por estilo, com uma frase do que você gosta em cada) ou arquivos em `docs/identidade/referencias/`. Links só valem se forem de texto/paleta (Coolors, Color Hunt, Realtime Colors com as cores na URL). Não precisa instalar nada. Figma só se você já usa e tem arquivo.

## 9. Decisões que preciso de você

1. A direção "cyberpunk analógico de periferia" (seção 4) é o que você imagina? Se não, diga o que está fora.
2. Trocar só a fonte de título e manter Inter e JetBrains Mono (recomendado)?
3. Quais dos temas da seção 7 você quer primeiro?
4. Logo: manter a palheta e refazer o traço no estilo novo, ou desenhar outro símbolo? (Hoje o logo tem gradiente e hex fixo; vira token na C2.)

## Fontes consultadas

- [Cyberpunk, referências de estilo (designprompts)](https://designprompts.pages.dev/cyberpunk) e [cybercore-css](https://cdn.jsdelivr.net/npm/cybercore-css@0.3.0/README.md)
- [Neon aesthetics in web design (DEV)](https://dev.to/raxxostudios/neon-aesthetics-in-web-design-beyond-the-trend-2ako)
- [Neobrutalism, Nielsen Norman Group](https://www.nngroup.com/articles/neobrutalism/)
- [Neubrutalism e acessibilidade (OpenReplay)](https://blog.openreplay.com/how-neubrutalism-benefits-users-with-disabilities/)
- [Interfaces "suaves" e acessibilidade (BOIA)](https://www.boia.org/blog/how-soft-user-interface-designs-impact-accessibility)
- [Case de app de música (Rhythm)](https://medium.com/@rohansavant/case-study-rhythm-the-music-masterclass-e11aaca1f16e)
- [Gamificação em prática musical (edtechbooks)](https://edtechbooks.org/jaid_13_2/designing_and_developing_a_gamified_app_for_enhancing_independent_practice_in_k12_music_education)
- [Realtime Colors](https://www.realtimecolors.com)
- [Radix Colors, escala de 12 passos](https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale)
