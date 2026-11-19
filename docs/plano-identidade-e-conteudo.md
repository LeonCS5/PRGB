# Plano: acervo experimental, conteúdo original, gamificação e identidade visual

> **Documento histórico, parcialmente aplicado.** Escrito em 2026-11-16 como rascunho: boa parte já foi implementada (acervo experimental, repertório próprio, progresso, trilha, aparência). O estado atual está no backlog do `AGENTS.md`, não aqui.

Rascunho original para aprovação. Cada item termina em uma tarefa que um agente pode pegar sozinho, com arquivos próprios e critério de pronto.

## 1. Decisões que já estão tomadas

- **Acervo externo = experimental.** O provedor externo respondeu que não pode autorizar a exibição das tablaturas (as editoras é que podem) e que o acesso automatizado pode ser barrado. O ranking com músicas baixadas fica fora do plano: não vamos tentar driblar o bloqueio.
- **Ranking só com conteúdo nosso**, validado pelo servidor como hoje (partes semeadas por migration).
- **Conteúdo novo = domínio público + arranjo nosso.** Nunca a edição moderna de alguém.

## 2. Decisões (respondidas em 2026-11-16)

| # | Decisão | Resposta | Consequência |
|---|---|---|---|
| G1 | Identidade visual | **Cyberpunk**, e as outras identidades viram **temas desbloqueáveis** (começam todos liberados) | O padrão é um cyberpunk "analógico" (ver seção 6); temas = tarefas C4 e D5 |
| G2 | Nomes de autores de domínio público | **Liberados.** Autoria é direito moral que não expira, então o crédito faz parte da obra (não é parecer jurídico) | Cada peça mostra autor e arranjador; artistas vivos e marcas continuam proibidos; muda a regra "Marca" do AGENTS.md |
| G3 | Lista da fase 1 | **Aprovada** | B2 pode começar depois de B1 |
| G4 | Foco da gamificação | **Conteúdo nosso.** O acervo é extra | Estrelas, trilhas e palhetas só valem em exercícios e repertório próprios; música do acervo conta apenas para o tempo do "ensaio da semana" e para o recorde pessoal. Segue 100% local |

## 3. Regras para toda tarefa (não vão contra o `checklist-software.md`)

**Portões globais** (qualquer tarefa só termina se todos passarem):
- `npm run lint` com saída 0 (olhar o código de saída, não só os avisos), `npm run build` e `npm test` verdes; o CI do GitHub verde.
- Sem `any`, sem CSS inline fora de valores calculados, só tokens PRGB, UI em português do Brasil, comentários curtos em inglês.
- **Acessibilidade (checklist 3):** contraste AA, alvo de toque de 44 px, nada que dependa só de cor, `prefers-reduced-motion` respeitado, zero violações no axe nas telas tocadas.
- **Segurança e CSP (checklist 1 e 10):** fontes e imagens só do próprio domínio; nenhum script de terceiro novo; qualquer mudança na CSP vem com a prova no navegador descrita no AGENTS.md.
- **Privacidade (checklist 14):** nenhum dado novo sai do navegador. Se uma tarefa precisar disso, ela para e pede decisão (muda `legal.ts` e a versão).
- **Desempenho (checklist 2):** código novo carregado sob demanda; orçamento de +40 KB gzip no bundle inicial por frente; o canvas do jogo mantém 60 fps.
- **Testes (checklist 5 e 20):** lógica pura com teste que falha sem a mudança; nada de lógica nova só em componente.
- **Operação e documentação (checklist 27 e 28):** AGENTS.md (mapa e backlog), CHANGELOG e `docs/operacao.md` atualizados; uma branch e um worktree por problema; commits convencionais; revisão cruzada antes do merge; ninguém publica sem o "pode publicar".
- **Sem medição por analytics** (decisão de privacidade). O feedback vem da caixa "Reportar problema" e de testes com pessoas reais, que o checklist 20 pede.

## 4. Frente A: acervo experimental (pequena)

Objetivo: dizer a verdade ao jogador, parar de tentar o que é bloqueado e poder desligar o acervo rápido.

| ID | Tarefa | Arquivos (exclusivos) | Pronto quando |
|---|---|---|---|
| A1 | Aviso "acervo experimental" na busca, na tela do jogo e no resultado | `SongSearchModal.tsx`, `ResultPanel.tsx`, `App.tsx` (só o trecho do aviso) | Texto honesto em pt-BR, sem nome do provedor na UI, axe limpo, celular de 320 px sem rolagem lateral |
| A2 | Ranking só para partes semeadas: esconder "Valer para o ranking" em música baixada, com a razão em uma linha | `useRankedRun.ts`, `rankedRun.ts`, `PracticeGame.tsx` (só o gate), `uiErrors.ts` | Teste do gate; a mensagem `songsterr_unavailable` deixa de prometer "tente de novo" |
| A3 | Cliente educado: debounce na busca, cache curto na memória, parada limpa em 403/429, sem retentativa em loop | `tabsApi.ts` | Testes com mocks; nenhum aumento de requisições por busca |
| A4 | Interruptor: `VITE_ACERVO_ENABLED` (público). Desligado, o acervo some e o resto do site segue | `App.tsx`, `SiteNav.tsx`, `vite-env.d.ts`, `.env.example` | Procedimento de retirada de conteúdo (takedown) escrito em `docs/operacao.md`, com prazo e responsável |
| A5 | Política e Termos: o acervo é de terceiros, sem licença do PRGB, pode ficar indisponível, e como pedir retirada | `legal.ts`, `legal.test.ts` | `LEGAL_VERSION` só muda se houver dado novo (não há); texto revisado pelo humano |
| A6 | A função `register-part` deixa de buscar no provedor; só devolve partes semeadas | `supabase/functions/register-part/*` | Menos superfície de ataque; deploy manual documentado; versão antiga guardada para reversão |

Dependências: A2 antes de A6. O resto é paralelo.

## 5. Frente B: repertório original com ranking

**Procedência (regra de ouro):** só entra peça cuja composição é de domínio público (no Brasil, autor morto há mais de 70 anos: Lei 9.610, art. 41) **e** cujo arranjo é feito por nós a partir de uma edição também de domínio público (por exemplo, partituras do IMSLP). Cada peça ganha uma linha em `docs/repertorio.md`: obra, autor, ano da morte, fonte da melodia, quem arranjou, quem revisou, data. Isto não é parecer jurídico.

**Sugestão da fase 1 (12 peças, 2 arranjos cada, de 3 níveis):**
- Folclore e tradicional: "Greensleeves", "Ciranda, cirandinha", "O cravo e a rosa", "Atirei o pau no gato".
- Clássico para violão: Carcassi, Carulli, Giuliani, Sor, Tárrega ("Lágrima" e "Adelita"), Bach ("Minueto em Sol", atribuído).
- Brasil, início do século XX: Ernesto Nazareth e Chiquinha Gonzaga (autores mortos há mais de 70 anos).
- **Originais do PRGB:** 4 riffs e 2 progressões compostos por nós, que são 100% nossos.
Evitar obras com autor vivo ou morto há menos de 70 anos, e qualquer coisa "no estilo de" artistas atuais.

| ID | Tarefa | Arquivos (exclusivos) | Pronto quando |
|---|---|---|---|
| B1 | Motor de repertório: formato compacto para escrever peças (compasso, nota, corda, casa), faixa de ids nova (`songIds.ts`), carregamento sob demanda | `src/services/songs.ts`, `songIds.ts` + testes | Testes por peça como os dos exercícios: notas dentro da tonalidade, casas de 0 a 22, compassos completos, id único, ids nunca renumerados |
| B2 | Conteúdo: transcrever as peças (vários agentes, 3 a 4 peças cada, em arquivos separados) | `src/content/songs/<peca>.ts`, `docs/repertorio.md` | A peça passa nos testes de B1; ouvida e conferida por uma pessoa (o teste automático não pega erro de música) |
| B3 | Semear no ranking: script que gera o SQL das partes usando o **mesmo normalizador** do servidor, migration e testes de banco | `scripts/gen-seed.mjs`, `supabase/migrations/<data>_seed_repertorio.sql`, `supabase/db-tests/` | Contagem e pontuação máxima do script batem com as do normalizador; migration aplicada pelo SQL Editor (o conector recusa) |
| B4 | Tela do repertório (reaproveita a biblioteca de exercícios): filtro por nível e por tipo, recorde pessoal, ranking | `RepertoireLibrary.tsx`, `SiteNav.tsx` | axe limpo; funciona offline; sem dados pessoais novos |

Dependências: B1 → B2 e B3 → B4. O ranking dos exercícios (hoje só a demo) entra na mesma migration de B3, se você quiser.

## 6. Frente C: identidade visual (sair do "cara de IA")

**Diagnóstico do que denuncia IA hoje:** fundo quase preto frio com **glow** laranja e ciano, títulos com destaque em degradê, cartões arredondados idênticos em grade, ícones genéricos da lucide para tudo, o trio Inter + Space Grotesk + JetBrains Mono, selo de "novidade" no topo, textos de vitrine ("Direto no navegador"). Nada disso é feio: é só o que todo gerador de site faz.

**Princípios:**
- Cada elemento visual vem do mundo da guitarra, não do kit de dashboard.
- Pouca cor, com intenção; sem glow decorativo; sem vidro fosco; sem degradê no texto.
- Voz de guitarrista brasileiro nos textos ("cifra", "ensaio", "palhetada"), sem promessa sem prova.
- O canvas do jogo continua escuro (leitura e contraste); a moldura é que muda.

**Três direções (a escolha é sua, G1):**

| | Ideia | Linguagem | Risco |
|---|---|---|---|
| 1. Caderno de cifras (recomendada) | Papel e tinta: o caderno de cifra do estudante | Papel creme, pauta de seis linhas como grade e divisória, tinta preta, um vermelho de carimbo, título em serifada de caráter, anotações à mão, carimbos como selos de conquista | Textura de papel pesada: usar SVG e CSS, nada de imagens grandes |
| 2. Cartaz de show | Lambe-lambe, xerox, punk BR | Tipografia condensada enorme, duas cores chapadas, meio-tom, colagem | Legibilidade e contraste; fácil virar caricatura |
| 3. Bancada do luthier e pedais | Analógico industrial | Knobs, LEDs, metal escovado, madeira | Skeuomorfismo datado; ótimo só para o rack do amp |

Recomendação: **1 como base e 3 só dentro do PRGB Amp**.

| ID | Tarefa | Arquivos (exclusivos) | Pronto quando |
|---|---|---|---|
| C1 | Pesquisa e brief: tom de voz, o que evitar, referências. **Três quadros estáticos em HTML**, um por direção (landing, jogo, resultado) | `docs/identidade/` (fora do build) | Você escolhe uma direção (G1). Cada quadro passa em contraste AA |
| C2 | Sistema: tokens de cor, escala tipográfica, espaçamento, movimento, fontes **auto-hospedadas** (licença livre conferida), ícones próprios para os conceitos-chave (palheta, braço, corda, pedal), logo refinada, favicon, imagem de compartilhamento, `theme-color` | `src/index.css`, `public/fonts/`, `BrandMark.tsx`, `public/*`, `index.html` | Tokens documentados; CSP sem violação; peso das fontes dentro do orçamento; modo calmo respeita `prefers-reduced-motion` |
| C3 | Aplicar por área, cada uma com arquivos exclusivos: (a) landing e navegação, (b) HUD, jogo e resultado, (c) modais (áudio, ranking, busca), (d) rack do amp | `App.tsx` e `SiteNav.tsx`; `PracticeGame.tsx` e `GameHud.tsx` e `ResultPanel.tsx`; modais; `AmpRack.tsx` | Antes e depois em captura de tela; axe limpo; nenhuma regressão de teclado; critique de design feito por um agente revisor |

Dependências: C1 → C2 → C3. C3 (a)–(d) rodam em paralelo.

**Cyberpunk sem "cara de IA".** Cyberpunk feito do jeito comum (neon ciano e magenta, brilho, degradê, vidro) é justamente o que hoje parece de IA. A versão que vamos fazer é **analógica e de periferia**: fósforo de monitor antigo, tipografia de terminal e estêncil, quadros de HUD com cantos cortados, tablatura escrita como texto de terminal, uma única cor ácida por tema, sombras duras e contornos chapados em vez de brilho difuso, glitch raro e só em momentos de destaque, textura de gambiarra (fita, etiqueta, adesivo). Regras: sem degradê no texto, sem `blur` decorativo, sem linha de varredura que atrapalhe a leitura da pista.

**Temas (identidades visuais desbloqueáveis):** os temas são conjuntos de variáveis CSS (`html[data-theme="..."]`) sobre os mesmos tokens. O canvas do jogo já lê `--color-*`, então ele acompanha sozinho. Cada tema é um dado: nome, tokens, fonte opcional, regra de desbloqueio. Itens fixos no código (como as cores da `BrandMark`) passam a usar tokens.

| ID | Tarefa | Arquivos (exclusivos) | Pronto quando |
|---|---|---|---|
| C4 | Motor de temas: tokens por tema, seletor, preferência salva (`prgb:prefs:v1`), troca sem recarregar (o jogo relê a paleta ao montar), `theme-color` por tema, fontes extras só carregam se o tema for escolhido | `src/index.css`, `src/services/themes.ts` + teste, `preferences.ts`, `BrandMark.tsx`, `ThemePicker.tsx` | **Teste automático de contraste:** todo tema precisa de AA nos pares de texto e fundo e nas cores de acerto e erro; tema novo sem passar no teste não entra; peso de cada tema dentro do orçamento |
| C5 | Temas iniciais: cyberpunk analógico (padrão) e, como extras, caderno de cifras, cartaz de show e bancada do luthier | `src/content/themes/*.ts` | Cada um passa em C4; captura de tela da landing, do jogo e do resultado em cada tema |

## 7. Frente D: gamificação

**Metáfora que combina com a identidade:** ensaio, palheta, casa e trilha. Em vez de "nível 5", "XP" e "streak": **trilhas** em forma de braço de guitarra (cada casa é um exercício), **palhetas** colecionáveis (conquistas), **ensaio da semana** (meta semanal) e **nomes de nível** do universo da guitarra ("corda solta", "primeira posição", "pestana", "palco pequeno").

**Mecânicas:**
1. **Estrelas por exercício** (1 a 3, por precisão e combo), calculadas dos recordes locais.
2. **Trilhas** com ordem sugerida, **sem trava**: ninguém fica preso (acessibilidade e autonomia).
3. **Palhetas** (conquistas) por regras, por exemplo: primeira pentatônica, 100% numa escala, 50 acertos seguidos, 10 voltas no modo treino, fez o teste de latência.
4. **Ensaio da semana:** o jogador escolhe 3, 5 ou 7 ensaios e vê um anel de progresso. Sem castigo por falhar, sem "você perdeu a sequência".
5. **Resumo da partida que ensina:** onde errou mais (corda, técnica, trecho), com um próximo passo sugerido.
6. **Ranking, desafios por link e recordes** continuam como são; o ranking só aceita conteúdo validado.
7. **Modo calmo:** desliga celebrações, sons de conquista e a meta semanal.

**Limites éticos (valem como critério de pronto):** nada de aversão à perda, contagem regressiva de urgência, escassez falsa, culpa no texto, ou notificações (não existem). Tudo pode ser desligado.

**Dados:** tudo no navegador, em `prgb:progress:v1` (versionado), integrado a "exportar e apagar dados locais" que já existe. XP e estrelas não entram no ranking (não dá para trapacear o que é só seu).

| ID | Tarefa | Arquivos (exclusivos) | Pronto quando |
|---|---|---|---|
| D1 | Núcleo puro: modelo de progresso, estrelas, regras de palhetas, meta semanal (com relógio injetável), migração de versão | `src/services/progress.ts`, `achievements.ts` + testes | Testes que falham sem a mudança; sem dependência de React; leitura corrompida do localStorage não derruba o app |
| D2 | Ligar ao jogo: registrar a partida ao terminar e integrar a exportar/apagar dados | `PracticeGame.tsx` (só o gancho do fim), `localData.ts`, `preferences.ts` | Apagar dados locais zera o progresso; teste de ida e volta |
| D3 | Telas: perfil de progresso, trilhas, palhetas, meta semanal, resumo da partida, modo calmo | `ProgressScreen.tsx`, `TrailMap.tsx`, `BadgeShelf.tsx`, `ResultPanel.tsx` (trecho novo) | Segue o sistema de C2; axe limpo; teclado completo; reduced-motion |
| D4 | Pequenos efeitos no jogo (marcos de combo), com som opcional | `PracticeGame.tsx` (trecho de efeitos), `synthAudio.ts` | Nenhum custo no 60 fps; desligados no modo calmo |

| D5 | Regras de desbloqueio de tema: cada tema tem `desbloqueadoPor` (palheta, casa de uma trilha, nível). **Começa com tudo liberado** por uma chave `TEMAS_BLOQUEADOS = false` | `themes.ts` (só a regra), `ProgressScreen.tsx` | Ligar a chave bloqueia os temas sem apagar a escolha do jogador; o tema escolhido nunca some por falta de desbloqueio; teste dos dois estados |

Dependências: D1 → D2 → D3. D3 e D4 esperam os tokens de C2 (ou usam os atuais e são reestilizados depois). D5 espera C4 e D1.

**Por que o jogador volta (hipóteses, ainda não medidas):** conteúdo novo toda semana (uma peça ou exercício em destaque), um objetivo curto (o ensaio da semana), coisas para colecionar (palhetas e temas) e algo para mostrar (recorde, desafio por link). Sem isso, o ranking sozinho não segura ninguém.

## 8. Frente E: qualidade (fecha os buracos do checklist)

| ID | Tarefa | Pronto quando |
|---|---|---|
| E1 | e2e dentro do repositório (Playwright) com os fluxos críticos: landing, exercício, repertório, entrada no ranking até o CAPTCHA (sem criar conta), página não encontrada | Roda no CI; falha com a mudança quebrada |
| E2 | axe automático no CI nas telas principais | CI vermelho em violação nova |
| E3 | Orçamento de bundle e teste de desempenho do canvas | CI vermelho se o bundle estourar |
| E4 | Atualizar AGENTS.md (mapa e backlog), CHANGELOG, `docs/operacao.md`, `docs/repertorio.md` | Tudo coerente com o código |
| E5 | Revisão cruzada de cada frente por outro agente e teste com pessoas reais (guitarra de verdade) antes de divulgar | Relatório com o que foi e não foi testado |

## 9. Como dividir entre agentes (e gastar poucos tokens)

**Fases:**
1. **Fase 0** (orquestrador): briefs curtos por tarefa e contratos de dados.
2. **Fase 1, em paralelo:** A1 a A5, B1, D1, C1, E1.
3. **Portão G1** (você escolhe a identidade) e G3 (peças).
4. **Fase 2, em paralelo:** B2 (vários agentes), B3, C2, D2, A6.
5. **Fase 3:** C3 (a a d), B4, D3, D4, E2 a E5.
6. **Fase 4:** revisão cruzada, regressão, "pode publicar".

**Para economizar:**
- Cada agente recebe **um brief de uma página** (escopo, arquivos, critério de pronto, as regras invioláveis em 10 linhas), em vez de ler o AGENTS.md inteiro. O AGENTS.md é grande.
- Arquivos exclusivos por agente, um worktree por tarefa, um commit por mudança lógica.
- Tarefas de dados e de texto (B2, E4) usam o modelo mais barato que dê conta, com validação automática por testes.
- O revisor roda lint, build e teste antes de ler o diff.
- Contexto estável no começo do pedido, parte variável no fim, para o cache de prompt ajudar.

**Modelo de brief (copie e preencha):**
```
Tarefa: <ID e nome>. Branch: claude/<tarefa>. Worktree: ../PRGB-<tarefa>.
Leia: AGENTS.md (regras invioláveis) e só estes arquivos: <lista>.
Edite só: <arquivos exclusivos>. Não faça commit nem push.
Pronto quando: <critério>. Rode: lint (conferir o código de saída), build, test.
Entregue em pt-BR: arquivos alterados, o que provou, o que não testou.
```

## 10. Riscos

- **Jurídico:** erro de procedência de uma peça (edição com direito próprio, autor que não é de domínio público). Mitigação: tabela de procedência e revisão humana por peça.
- **Música errada:** o teste automático não ouve. Mitigação: uma pessoa toca cada peça.
- **Identidade subjetiva:** pode virar vai e volta. Mitigação: portão G1 com quadros prontos, e depois só ajuste.
- **Peso visual:** texturas e fontes. Mitigação: SVG e CSS, fontes subconjunto, orçamento no CI.
- **Gamificação engolir a prática:** metas demais. Mitigação: poucas mecânicas, modo calmo, sem trava.
- **Atrito de migration:** cada semeadura exige colar no SQL Editor. Mitigação: reunir as peças em poucas migrations.
- **Acervo some:** o interruptor A4 e o takedown em `docs/operacao.md` existem justamente para isso.
