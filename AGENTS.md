# AGENTS.md — Guia de Colaboração para Codex, Claude, IBM Bob e Qualquer Agente AI

> **Este arquivo é o ponto de entrada universal para qualquer agente de IA que trabalhe neste repositório.**
> Leia integralmente antes de fazer qualquer alteração.

---

## Resumo do Projeto

**PRGB** = Play Real Guitar in Browser

Um app web (React + TypeScript + Vite) de prática de guitarra gratuito:
- Captura áudio da guitarra real via interface USB (Web Audio API, 48kHz, sem processamento do OS)
- Processa o som em tempo real com o motor **PRGB Amp** (amplificador + gabinete + reverb + noise gate)
- Oferece exercícios, trilha de evolução, repertório próprio e sessões de prática; a busca em um acervo externo de tablaturas é um extra experimental
- Renderiza um jogo de prática estilo "rails" em Canvas 2D com detecção de pitch e scoring

**Sem servidor próprio.** O jogo roda 100% no navegador, sem conta e até offline. Ranking e salas online (opcionais, 18+, com consentimento) usam **Supabase** gerenciado na região São Paulo (Auth anônimo, RPC security definer, Edge Function, Realtime).

Site em produção: **https://prgb.vercel.app**

---

## Setup Rápido

```bash
npm install        # Instalar dependências
npm run dev        # Dev server → http://localhost:5173
npm run build      # Build produção (tsc + vite build)
npm run lint       # Linter (oxlint, NÃO eslint)
npm test           # Testes (Vitest) dos services
```

**Requisitos:** Node 22+, navegador moderno com Web Audio API.

---

## Mapa de Arquivos

```
PRGB/
├── index.html                       # HTML shell: título, meta/Open Graph, fontes locais (public/fonts)
├── vite.config.ts                   # Vite config + proxies de tablaturas (dev) + plugin que gera o sw.js
├── vercel.json                      # Deploy: rewrites de tablaturas (proxy sem backend), SPA, cache
├── package.json                     # Dependencies & scripts
├── tsconfig.app.json                # TypeScript config (strict, ES2023, bundler mode)
├── tsconfig.e2e.json                # TypeScript do e2e (e2e/ e playwright.config.ts), só conferência de tipos
├── playwright.config.ts             # e2e (Playwright): build própria em dist-e2e/, vite preview, microfone falso; `npm run e2e`
├── e2e/                             # Testes de ponta a ponta (*.e2e.ts, não *.spec.ts: o Vitest coleta todo .spec.ts): landing, jogo, Aparência, layout e Voltar
├── e2e/supabase/                    # E2E contra o Supabase LOCAL (Docker): ranking, conta e dupla online; `localStack.ts` (guarda de URL local, leitura da stack em memória, SQL local), `fixtures.ts` (CSP com o host local, requisições fora do preview e da API local abortadas), `global-setup.ts` (confere o bundle, a stack, a semente e a função; apaga as contas da execução), `helpers.ts` (microfone que toca as notas do exercício)
├── playwright.supabase.config.ts    # Config do `npm run e2e:supabase`: build própria em dist-e2e-local/ com a URL e a chave publicável locais no ambiente do processo, preview na porta 4174
├── .oxlintrc.json                   # oxlint config (react + typescript plugins)
│
├── src/
│   ├── main.tsx                     # React entry point
│   ├── App.tsx                      # Root component: landing de produto + troca para o jogo
│   ├── index.css                    # Tailwind 4 + tokens de design PRGB (@theme) + reset global
│   ├── vite-env.d.ts                # Tipos de import.meta.env (VITE_SUPPORT_URL, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
│   │
│   ├── content/
│   │   ├── legal.ts                 # Cópia legal (LGPD): Política de Privacidade, Termos de Uso, LEGAL_VERSION, ConsentCopy
│   │   └── songs/                   # Repertório próprio (domínio público): catálogo em index.ts (catalog-classic, catalog-folk, catalog-originals) e uma peça por arquivo (ode-a-alegria, greensleeves, minueto-em-sol, estrelinha, riffs e progressões originais), em chunk lazy
│   │
│   ├── appearance/                  # Aparência: tipos e padrões (types, defaults), validação e persistência (validate, useAppearance), temas e presets, aplicação no <html> (apply) e script de boot (bootScript); também `useGamePalette` (paleta do canvas a partir da aparência) e `testHelpers` (armazenamento em memória para os testes) Também `guidePresets` (predefinições da sombra-guia) e `persistence.test` (grava e recarrega todos os campos).
│   │
│   ├── vendor/nam-engine/           # Motor neural de terceiros, sem alterações: módulo, worklet e wasm (não editar)
│   │
│   ├── context/
│   │   ├── AudioSessionContext.tsx  # AudioEngine, PRGB Amp, device/canal, erros de áudio; pitch em store próprio (useLatestPitch)
│   │   ├── sessionSettings.ts       # Velocidade (0,25× a 2×), zoom da pista, metrônomo, sintetizador e treino de uma sessão (em memória, por fila) e a flag da legenda da 1ª partida (prgb:legend:v1)
│   │   ├── gameSession.ts           # Tipos de sessão de jogo: GamePart, SoloSession, DuoSession, RunSummary, RankedSubmission
│   │   ├── historyLayers.ts         # Uma entrada no histórico por camada aberta (tela e modais): o Voltar fecha a de cima
│   │   ├── legalRoute.ts            # Roteamento por hash (#privacidade / #termos) sem biblioteca de router
│   │   ├── localData.ts             # Exportar/apagar dados locais (records, prefs, progresso e aparência); flag de sessão de ranking
│   │   ├── ModalsContext.tsx        # Estado aberto/fechado dos modais
│   │   ├── progressStore.ts         # Camada fina entre o jogo e services/progress.ts: carrega, aplica e salva (só neste navegador; só partida solo conta)
│   │   ├── useTheme.ts              # Reexporta useGamePalette (PracticeGame e FreePlay mantêm esse caminho)
│   │   ├── preferences.ts           # localStorage versionado (prgb:prefs:v1): device, canal, PRGB Amp, última música
│   │   ├── rankedRun.ts             # RankedRunController: máquina de estados de um run ranqueado (sem React)
│   │   ├── ranking.ts               # RankingContext, RankingApi type, RankingValue; RankingProvider está em RankingProvider.tsx
│   │   ├── RankingProvider.tsx      # Provider do contexto de ranking (isConfigured, hasAccount, perfil, fluxos de conta)
│   │   ├── room.ts                  # Estado puro da sala online e RoomController (sem React)
│   │   ├── RoomProvider.tsx         # Provider da sala online
│   │   ├── uiErrors.ts              # Mensagens de erro pt-BR + carga/validação de música e tab
│   │   ├── useRankedRun.ts          # Hook React que instancia e assina RankedRunController
│   │   └── useRoom.ts               # Contexto e hook da sala online
│   │
│   ├── components/
│   │   ├── AudioSettingsModal.tsx   # Modal: device selector, afinador, VU meter
│   │   ├── FeedbackModal.tsx        # Caixa "Reportar problema": relato sem identificação, com o e-mail de contato se falhar
│   │   ├── AudioRoutePanel.tsx      # Painel de rota: dispositivos por aparelho, buffer, compensação, caminho do som
│   │   ├── NeuralAmpSection.tsx     # Carrega modelo .nam e IR .wav do jogador
│   │   ├── StorageNotice.tsx        # Aviso da primeira visita (informa, não pede consentimento)
│   │   ├── AudioRouting.tsx         # Medidor de entrada em dB e avisos de rota (microfone do PC, retorno da saída)
│   │   ├── BrandMark.tsx            # Logo PRGB (palheta) + wordmark
│   │   ├── ErrorBoundary.tsx        # Tela de recuperação quando uma tela quebra (em vez de página branca)
│   │   ├── NotFound.tsx             # Página não encontrada para qualquer caminho fora da raiz
│   │   ├── CaptchaField.tsx         # Verificação contra robôs na entrada do ranking, só depois das caixas de consentimento
│   │   ├── ChallengeCard.tsx        # Card de desafio (melhor score pessoal de um amigo)
│   │   ├── ChallengeSharePanel.tsx  # Painel para compartilhar/aceitar desafio via link
│   │   ├── DeleteAccountConfirm.tsx # Confirmação de exclusão de conta de ranking
│   │   ├── DuoSetupModal.tsx        # Modal de configuração da sessão duo (duas guitarras)
│   │   ├── ErrorNotice.tsx          # Aviso de erro dispensável com ação (role="alert")
│   │   ├── ExerciseLibrary.tsx      # Tela de exercícios: categorias, tom, jeito de tocar e cartões
│   │   ├── FreePlay.tsx             # Play Free: só escuta a guitarra e mostra as notas, sem música nem pontos
│   │   ├── GameHud.tsx              # HUD do jogo: score, combo, accuracy, indicadores de run ranqueado
│   │   ├── hudGlow.ts               # Estilo do brilho do COMBO no HUD (função pura, só com o efeito ligado)
│   │   ├── gameEffects.ts           # Efeitos opcionais do canvas (pulso, faíscas, brilho do combo, fundo reativo), com pools fixos
│   │   ├── SessionScreen.tsx        # Sessão de prática (lazy): monta a lista por etapa, por tempo ou à mão, com tons e jeitos de tocar
│   │   ├── SessionStrip.tsx         # Resumo final da sessão (exercícios, tempo, estrelas, precisão média) sobre o resultado do último exercício; os anteriores vão direto para o próximo, com contagem de 3 s
│   │   ├── TrailScreen.tsx          # Trilha de evolução (lazy): etapas, passos com estrelas, "Continue daqui"; só lê o progresso local
│   │   ├── RepertoireLibrary.tsx    # Tela do repertório próprio: porta de entrada das músicas; o acervo externo fica dentro, como extra experimental
│   │   ├── AppearanceScreen.tsx     # Tela Aparência (lazy): categorias, preview ao vivo, presets; controles em components/appearance/
│   │   ├── ProgressSummary.tsx      # Estrelas, palhetas, ensaio da semana e nível, no resultado e no repertório
│   │   ├── GameMoreSheet.tsx        # Folha "Mais" do jogo no celular; em telas largas só repassa os controles
│   │   ├── LatencyTest.tsx          # Teste de latência: pista, medição ao vivo, resultado e ajuste salvo
│   │   ├── LeaderboardModal.tsx     # Modal do placar online (semanal + all-time)
│   │   ├── LegalPage.tsx            # Renderizador das páginas legais (Privacidade / Termos)
│   │   ├── LocalDataControls.tsx    # Controles de exportar/apagar dados locais e sessão de ranking
│   │   ├── LocalRecords.tsx         # Histórico de recordes locais do jogador
│   │   ├── ModalFrame.tsx           # Wrapper genérico de modal (foco, fechar com Esc ou Voltar, overlay)
│   │   ├── OnlineHud.tsx            # Faixa do parceiro e da equipe durante a dupla online
│   │   ├── OnlinePracticeGame.tsx   # PracticeGame da dupla online: contagem, progresso e resultado
│   │   ├── OnlineResultPanel.tsx    # Resultado da dupla: pontos, equipe, vitória ou empate
│   │   ├── RoomModal.tsx            # Modal da dupla online: criar/entrar, lobby, faixa, pronto e início
│   │   ├── PracticeGame.tsx         # Canvas game: rails (camada estática em cache, DPR), notas, scoring, metrônomo
│   │   ├── RankingAccountModal.tsx  # Modal de gerenciamento de conta do ranking (apelido, dados, excluir)
│   │   ├── RankingEntryModal.tsx    # Modal de entrada no ranking (consentimento 18+, criar/atualizar perfil)
│   │   ├── RankingModals.tsx        # Orquestrador dos modais de ranking (entry, account, leaderboard)
│   │   ├── ResultPanel.tsx          # Painel de resultado após o fim de uma música
│   │   ├── SiteNav.tsx              # Menu superior, estado do áudio e barra de abas do celular
│   │   ├── SongSearchModal.tsx      # Modal: busca no acervo + seleção de faixa
│   │   ├── AmpRack.tsx      # Modal: rack completo do amp modeler
│   │   ├── OnDemand.tsx             # LazyScreen (mensagem de carregamento e "Tentar de novo" numa tela lazy) e OnDemand (monta um modal só depois da primeira abertura)
│   │   ├── lazyLoad.ts              # lazyWithRetry e o reload único em vite:preloadError (protegido por sessionStorage)
│   │   ├── sessionFormat.ts         # Formatação do tempo da sessão (lógica pura)
│   │   ├── progress/starRules.ts    # Texto fixo do critério das estrelas e da precisão, lido de progress.ts
│   │   ├── ProgressScreen.tsx       # Tela Meu progresso (lazy): nível, ensaio da semana, palhetas e conteúdo tocado
│   │   ├── progress/viewModel.ts    # O que mostrar em Meu progresso, a partir do progresso salvo (lógica pura)
│   │   ├── appearance/              # Peças da tela Aparência: GameplayPreviewCanvas, PreviewPanel, controls, options, sections, GuideSection (sombra-guia) e guideSummaries, useReducedMotion
│   │   ├── practiceLanes.ts         # Ajudantes do canvas do jogo: geometria das pistas e `hitLineX(width)` (a linha de acerto, ~28% da largura), camada estática em cache, notas e efeitos de acerto
│   │   ├── guideShadow.ts           # Sombra-guia: qual nota tocar agora (lógica pura, sem alocar por quadro), o salto no relógio da música e o desenho (estilos shadow/hologram; opções em appearance.guide)
│   │   ├── countIn.ts               # Contagem do começo: 5 s de pista vazia, número no centro com fade (constantes e funções puras)
│   │   ├── clockView.ts             # O que a tela mostra do relógio da música (segundo, contagem, fade): o React só renderiza quando isso muda; positionRef não é estado
│   │   ├── noteSpacing.ts           # Espaçamento das notas ao longo da pista: `basePixelsPerMs` (janela fixa de `LOOKAHEAD_MS` de música, igual em qualquer tela) e `trackPixelsPerMs` (a escala em que a pista é de fato desenhada: nunca menos que `readablePixelsPerMs`, o piso em que uma nota do tamanho dela ainda tem o lugar de `READABLE_GAP_MS` de música), mapa de escala por seção segundo a densidade da música (rápido diminui até 0,7, lento aumenta até 1,5, zona morta em 1; rampas de 1,5 s; `buildScaleMap`, `S(t)` = `xOf`), encolhimento das notas curtas, `worstOverlap` e o rótulo "Auto ×0,8" (lógica pura, só lê a tab)
│   │   ├── techniques.ts            # Técnicas na pista (lógica pura): blocos de notas ligadas (hammer-on, pull-off, slide), slides que só entram ou saem, trechos de palm mute e o tamanho do bend; lê os campos do parser sem mudá-lo
│   │   ├── appearance/TechniqueLegend.tsx / appearance/techniqueKey.ts # Legenda dos símbolos das técnicas (lista na tela Aparência, uma linha na primeira partida) e a tabela de símbolos
│   │   ├── laneDraw.ts              # Desenho das notas e dos blocos de técnicas de uma pista (`drawNoteInLane`, `drawBlockInLane`) fora do componente: um `LaneDrawEnv` preenchido a cada quadro, sem closures nem alocação
│   │   ├── synthSchedule.ts         # Quais notas do som de guia estão para chegar: notas ordenadas uma vez, busca binária e "já entregue" por número (`dueNotes`, `unmarkAfter`), sem varrer a música a cada quadro
│   │   ├── gameScaleKit.ts          # `formatScale` (texto de velocidade e espaçamento), fora do arquivo de componente
│   │   ├── resumeCountdown.ts       # Contagem de 3 s ao fechar a Aparência rápida no meio da música
│   │   ├── GameToolbar.tsx          # Peças da barra do jogo: ToolButton (estado ligado, atalho, 44 px) e ToolGroup
│   │   ├── gameToolbarKit.ts        # Atalhos do jogo (Espaço, M, N, A, setas), passos de velocidade e a classe dos botões (lógica pura)
│   │   ├── GameScaleControls.tsx    # Cartões de Velocidade e Zoom do rodapé, com barra de segmentos e aviso rápido sobre a pista
│   │   ├── QuickAppearancePanel.tsx # "Aparência rápida": gaveta (folha no celular) aberta durante a música; pausa e volta com contagem; leva à tela cheia sem perder a partida
│   │   ├── noteStyles.ts            # Estilos de nota do canvas (`classic` é o original; os outros só mudam forma, cor e contorno)
│   │   ├── gameplayLook.ts          # O que o canvas desenha, resolvido a partir do tema e da aparência (uma vez por mudança, nunca por quadro)
│   │   ├── gameplayPalette.ts       # Cores do canvas que dependem da aparência: esquemas de cordas, intensidade e contraste (funções puras)
│   │   ├── gameplayPreview.ts       # Imagem estática do jogo para a tela Aparência, desenhada com as mesmas funções do jogo
│   │   ├── useGameplayLook.ts       # Hook que junta aparência, paleta e estilo de nota para o canvas
│   │   ├── rankingStyles.ts         # Classes Tailwind compartilhadas dos botões e modais do ranking
│   │   ├── devScenes.ts / devRanking.ts  # Só em DEV (`?tela=...`): atalhos para telas difíceis de alcançar e um ranking fictício; fora do build de produção
│   │   └── testCanvas.ts            # Ajudante de teste: contexto 2D que grava cada chamada, para comparar um desenho instrução por instrução
│   │
│   ├── services/                    # Cada service tem um *.test.ts (Vitest) ao lado
│   │   ├── songs.ts / songIds.ts    # Motor do repertório (notação compacta, carga lazy) e ids das peças (a partir de -200000, nunca renumerar)
│   │   ├── progress.ts              # Progresso local: estrelas, palhetas e ensaio da semana (localStorage, entra na exportação e na exclusão)
│   │   ├── rankable.ts              # Único ponto que decide o que vale para o ranking (isRankableSongId)
│   │   ├── acervoFlag.ts            # VITE_ACERVO_ENABLED=false esconde todo caminho para o acervo externo
│   │   ├── audioEngine.ts           # Captura, channel routing, pitch (NSDF), corda/casa estimadas, fila start/stop com fade
│   │   ├── fixedCadence.ts          # Cadência da análise do pitch: ~60 análises por segundo no relógio do áudio (`FixedCadence`, `ANALYSIS_HZ`), seja qual for a taxa de atualização da tela; o laço do `audioEngine` acorda a cada quadro, mas só analisa nesse ritmo
│   │   ├── audioOutput.ts           # Saída: AudioContext.setSinkId (Chromium) ou <audio> com setSinkId (Firefox)
│   │   ├── latencyTest.ts           # Lógica do teste de latência: notas, ataques, mediana, veredito e ajuste (pura)
│   │   ├── neuralAmp.ts             # Validação e nível dos modelos .nam (o motor vem de src/vendor, sob demanda)
│   │   ├── audioDevices.ts          # Escolha da entrada, nível, saída e teste de retorno (lógica pura)
│   │   ├── challenge.ts             # Geração e validação de links de desafio (score pessoal codificado em URL)
│   │   ├── demoSong.ts              # Exercício original offline (pentatônica de Lá menor), sem direitos de terceiros; é o único que vale para o ranking
│   │   ├── exerciseIds.ts           # Ids dos exercícios (negativos, nunca renumerar: recordes e desafios guardam esses ids)
│   │   ├── exercises.ts             # Catálogo de exercícios: gerado por regras, vira tablatura e passa pelo mesmo parser
│   │   ├── practiceSession.ts       # Sessão de prática (lógica pura): itens, expansão por tons e jeitos, três montagens, fila e resumo
│   │   ├── trail.ts                 # Trilha de evolução: 16 etapas e 154 passos (exercício + tom + jeito de tocar), em ordem de dificuldade, e o resumo do progresso
│   │   ├── musicTheory.ts           # Escalas, posições no braço e formas de acorde (lógica pura)
│   │   ├── achievements.ts          # Palhetas (conquistas): dados e regras puras, ids estáveis salvos no navegador (nunca renomear)
│   │   ├── textSafety.ts            # Filtro de texto de outro jogador (caracteres de controle e bidi, links, termos bloqueados); usado pelas mensagens da sala
│   │   ├── nickname.ts              # Validação, normalização e filtro de apelidos (look-alikes, blocklist, NFKD)
│   │   ├── noteTrail.ts             # Histórico das notas tocadas no Play Free (lógica pura)
│   │   ├── records.ts               # Recordes pessoais locais: armazenamento, consulta e exportação (localStorage)
│   │   ├── scoring.ts               # Motor de scoring: judgeNote, acumulação de estado, multiplier, accuracy; notas ligadas (hammer-on, pull-off, slide): `classifyAttackRequirement`, `buildJudgeContexts` e `LEGATO_*`
│   │   ├── tabsApi.ts               # API client + normalizer (cordas 0-indexed no JSON bruto, ties, grace, técnicas, beatGrid)
│   │   ├── vercelRewrites.test.ts   # Confere que os caminhos do acervo casam com os rewrites do vercel.json e os de fora não
│   │   ├── turnstile.ts             # CAPTCHA da Cloudflare: carrega o script sob demanda e só com consentimento (lógica testável)
│   │   ├── synthAudio.ts            # SFX + MetronomeScheduler (cliques agendados no relógio do AudioContext)
│   │   ├── ampEngine.ts           # DSP chain: preamp→waveshaper→EQ→cab→reverb→output
│   │   └── backend/
│   │       ├── feedbackApi.ts       # Relatos da caixa "Reportar problema" (RPC com a chave pública)
│   │       ├── rankingApi.ts        # RPCs do ranking: createProfile, submitScore, getLeaderboard, registerPart, etc.
│   │       ├── roomChannel.ts       # Salas online via Supabase Realtime (Broadcast + Presence, host/guest)
│   │       └── supabaseClient.ts    # Cliente Supabase (lazy, on-demand); lê VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
│
├── supabase/
│   ├── config.toml                  # Configuração do CLI Supabase (projeto local)
│   ├── migrations/                  # Migrations SQL (aplicadas em ordem)
│   │   ├── 20261028200000_ranking.sql        # Tabelas de ranking, RPCs, RLS, purge
│   │   ├── 20261028200100_retention.sql      # Política de retenção de dados (purge diário, LGPD)
│   │   ├── 20261029120000_reaccept_terms.sql # RPC de reaceitação de termos versionados
│   │   ├── 20261029120100_room_realtime.sql  # Tabelas e policies para salas online (Realtime)
│   │   ├── 20261030120000_room_data_export.sql # Exportação de dados de sala (LGPD)
│   │   ├── 20261030150000_feedback.sql       # Relatos da caixa "Reportar problema" (RPC, limite, retenção de 180 dias)
│   │   └── 20261110120000_abuse_limits.sql   # Limites por hora (create_profile 5, update_nickname 10, join_room 30, export_my_data 10), texto repetido nos relatos, limpeza do histórico do pg_cron
│   ├── functions/
│   │   ├── _shared/
│   │   │   ├── scoreLimits.ts       # countScorableNotes / maxPossibleScore (shared entre Edge Function e app)
│   │   │   └── tabNormalizer.ts     # Parser de tab (reutilizado no register-part)
│   │   └── register-part/
│   │       ├── handler.ts           # Lógica pura da Edge Function register-part: só devolve faixa já guardada no banco, sem consultar fonte externa (testável em Vitest)
│   │       └── index.ts             # Entry point Deno: wires Supabase, rede e ALLOWED_ORIGINS
│   └── db-tests/
│       ├── harness.ts               # Utilitários de setup para testes de banco (roles, JWT, dados de seed)
│       ├── ranking.test.ts          # Testes de integração das migrations de ranking
│       ├── retention.test.ts        # Testes do purge de retenção de dados
│       ├── feedback.test.ts         # Testes da caixa de relatos: acesso, limite por hora e retenção
│       └── roomRealtime.test.ts     # Testes de integração das policies e RPCs das salas online
│
├── docs/
│   ├── operacao.md                  # Operação: inventário, plano de incidente, backup, rotação de chaves
│   ├── sessoes.md                   # Sessões de prática: como funciona, os três jeitos de montar e as duas formas de alongar
│   ├── ux-revisao.md                # Revisão de UX das telas fora do jogo: achados priorizados (P0/P1/P2) e o que foi corrigido
│   └── trilha.md                    # Trilha de evolução: pesquisa, critérios, etapas e como estender
├── scripts/
│   ├── backup-db.sh                 # Backup local do banco: 7 dias e sem play_sessions (o plano gratuito não tem backup)
│   ├── check-bundle-size.mjs        # Orçamento do JS: primeira carga (entrada + React), entrada, chunk do Supabase e total
│   ├── check-precache.mjs           # Confere no dist que todo chunk (exceto nam-* e supabase-*) está no precache do sw.js
│   ├── e2e-supabase.mjs            # `npm run e2e:supabase`: confere o Docker, sobe `supabase start` e `functions serve` se preciso, roda os testes e deixa o Docker como está (`--stop`, `--reset`); recusa comandos que tocariam o projeto hospedado
│   └── sw.test.ts                   # Testes do service worker (vm, com cache e rede falsos)
├── .github/                         # CI (lint, build, testes, npm audit) e Dependabot
├── CHANGELOG.md                     # Resumo das rodadas
│
└── public/
    ├── .well-known/security.txt     # Contato de segurança (renovar o Expires antes de 2027-11-10)
    ├── robots.txt, sitemap.xml      # Descoberta
    ├── favicon.svg                  # Logo (palheta laranja com onda de sinal)
    ├── fonts/                       # Fontes locais (Inter, Space Grotesk, JetBrains Mono — woff2)
    ├── icons/                       # Ícones PNG do app (192, 512, maskable)
    ├── nam/                         # Avisos de licença do motor neural (NOTICE.txt, LICENSE)
    ├── og-image.png                 # Imagem de compartilhamento 1200×630
    ├── manifest.webmanifest         # PWA
    └── sw.js                        # Template do service worker (o build injeta versão e arquivos)
```

---

## Tecnologias

- **React 19** + **TypeScript 6** + **Vite 8**
- **Tailwind CSS 4** (via `@tailwindcss/vite`, sem config file)
- **lucide-react** (ícones)
- **oxlint** (linter — NÃO usa ESLint)
- **Web Audio API** (captura, DSP, e output — tudo nativo)
- **API de tablaturas** (não oficial, proxied via Vite dev server e rewrites da Vercel)
- **Supabase** (`@supabase/supabase-js`, carregado sob demanda — só ao abrir o ranking ou a sala online)

---

## Deploy (Vercel)

1. Importar o repositório no Vercel (framework Vite; `vercel.json` já define build, saída `dist` e rewrites).
2. Variáveis de ambiente obrigatórias para ranking e salas online (deixar em branco para desativar):
   - `VITE_SUPABASE_URL` — URL pública do projeto Supabase (prefixo `VITE_` é seguro; nunca expor a `service_role key`)
   - `VITE_SUPABASE_ANON_KEY` — chave pública `anon` do Supabase (prefixo `VITE_` é seguro; nunca a `service_role key`)
3. Opcional: `VITE_SUPPORT_URL` com o link de apoio (Ko-fi, Pix, GitHub Sponsors...).
   - Opcional: `VITE_TURNSTILE_SITE_KEY`, a chave pública do CAPTCHA da Cloudflare na entrada do ranking. Sem ela, a conta é criada sem verificação. Só ligue o CAPTCHA no Supabase (Authentication › Attack Protection, com a chave secreta) depois que o deploy publicado tiver essa variável; antes disso, toda criação de conta falha.
4. Na Edge Function `register-part`, configurar `ALLOWED_ORIGINS` para incluir a URL de produção (`https://prgb.vercel.app`) e os ambientes de preview/local.
5. `/api/tabs/*`, `/cdn/tabs/*` e `/cdn2/tabs/*` são reescritos para o provedor de tablaturas pela própria plataforma Vercel (sem backend nosso). Funciona em produção. O CDN reserva não tem todas as tablaturas e responde 403 para as que faltam; o app só o tenta se o principal falhar.
6. **Cabeçalhos de segurança e entrega estática (`vercel.json`).** Todas as rotas saem com CSP, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin` e `Permissions-Policy` (só `microphone=(self)`). A CSP não tem `unsafe-inline` nem `unsafe-eval` em script; `'wasm-unsafe-eval'` é do motor neural e `style-src-attr 'unsafe-inline'` é só para os `style=""` calculados. Terceiros liberados: `https://challenges.cloudflare.com` (Turnstile) e o host exato do Supabase (`https://` e `wss://`). Novo serviço externo, fonte, worker, `blob:` ou script inline exige mudar a CSP **e** provar no navegador (servir o `dist` com esses cabeçalhos; zero violações no console e nos eventos `securitypolicyviolation`: landing, jogo com microfone, painel de áudio, motor neural, entrada do ranking com Turnstile). Os rewrites do acervo casam só com os caminhos que o `tabsApi` monta (`songs`, `meta/<id>`, `<songId>/<revisionId>/<image>/<partId>.json`): mudou o caminho no `tabsApi`? Atualize o `vercel.json` junto. A instalação usa `npm ci` e `engines.node >= 22`. Operação, incidente e backup: `docs/operacao.md`.
7. **Para conferir produção, compare o conteúdo ou o hash do bundle com o log do build.** O último rewrite devolve a página do app com status 200 para quase qualquer caminho, então o status sozinho não prova nada.

---

## Cadeia de Processamento de Áudio

```
Guitarra → USB Interface → getUserMedia(48kHz, raw, sem noise suppress)
                                │
                        ChannelSplitter (L/R/Mono)
                                │
                ┌───────────────┼───────────────┐
                ▼                               ▼
         AnalyserNode                     PRGB Amp Engine
         (pitch detect)                        │
                │                    Gate → PreGain → WaveShaper
                ▼                              │
        Jogo (PracticeGame)         EQ (Bass→Mid→Treble→Presence)
        (note matching)                        │
                                     CabSim (HP→Reso→Scoop→LP×2)
                                               │
                                         Reverb (Wet/Dry)
                                               │
                                          Master Volume
                                               │
                                          🔊 Speakers
```

---

## Convenções

### Código
- Classes para services (`AudioEngine`, `AmpEngine`, `TabsApi`)
- `React.FC<Props>` para componentes
- `export interface` para tipos (não `type` para objetos complexos)
- Variáveis/funções em **inglês**, UI em **Português Brasileiro (pt-BR)**

### Styling
- Tailwind CSS 4 exclusivo — sem CSS-in-JS, sem CSS Modules, sem styled-components
- Use **só os tokens PRGB** de `src/index.css` (nada de `slate`/`cyan`/`rose` crus):
  - superfícies `ink-950…ink-100`; primária `amp-*` (laranja (ação principal)); secundária `signal-*` (ciano: notas, afinação)
  - feedback `hit` (Perfeito), `near` (Bom), `miss` (Errou); sombras `shadow-glow-amp`, `shadow-glow-signal`, `shadow-panel`
  - fontes `font-display` (Space Grotesk, títulos), `font-sans` (Inter), `font-mono` (JetBrains Mono, números/HUD)

### Marca
- Nome: **PRGB**. Não usar nomes de produtos de terceiros em UI, código ou comentários.
- O conteúdo vem de um provedor externo de tablaturas: o rodapé precisa manter o aviso de não afiliação, e a Política precisa continuar dizendo que ele existe e o que recebe.
- Sem nomes de artistas, músicas ou marcas em chamadas, exemplos, presets e textos do site: nomes de terceiros só aparecem nos resultados que o jogador buscar. Exceção, liberada pelo dono: o nome do autor de uma peça de domínio público do repertório (`src/content/songs/`), como crédito de autoria na própria peça.
- Alegações só com prova: nada de números de acervo, "baixa latência", "válvulas" ou "emulação". O PRGB Amp é um simulador.
- Licenças de terceiros não são uso de marca: `public/nam/`, `src/vendor/nam-engine/` e `/fonts` mantêm os avisos originais, como a licença exige. O código em `src/vendor/` não se edita.
- O nome desse provedor só aparece onde é funcional: hosts em `vercel.json`, `vite.config.ts` e `handler.ts`, o código de erro devolvido pela função já publicada e as migrations congeladas.
- Projeto gratuito; o único "monetizar" é o link "Apoie o projeto" (`VITE_SUPPORT_URL`, com fallback para estrela no GitHub).

### Linting
- **oxlint** (`.oxlintrc.json`) — NÃO instalar ESLint, prettier, ou similares
- Plugins ativos: react, typescript, oxc

---

## Regras INVIOLÁVEIS

1. **Sem servidor próprio.** O único backend permitido é o **Supabase gerenciado** (Postgres com RLS, Auth anônimo, Edge Functions, Realtime), e só para ranking e salas online. O jogo precisa continuar funcionando sem conta, sem Supabase configurado e offline.
2. **Não instalar ESLint.** O projeto usa oxlint.
3. **Não trocar Tailwind CSS** por outra solução de styling.
4. **Não usar `any`** sem justificativa em comentário adjacente.
5. **Toda UI em Português Brasileiro.** Variáveis em inglês.
6. **Não alterar os proxies Vite** (`/api/tabs`, `/cdn/tabs`, `/cdn2/tabs`) sem entender o CORS routing.
7. **Não usar `setTimeout`/`setInterval`** para timing de áudio — usar `AudioContext.currentTime`.
8. **Não manipular DOM diretamente** — usar React refs.
9. **Não usar CSS inline** (`style={{}}`) exceto para valores dinâmicos calculados.
10. **Não remover ou refatorar o PRGB Amp** sem entender a cadeia DSP completa documentada acima.
11. **LGPD por padrão.** Dados mínimos (só o apelido é dado pessoal); nenhuma conta antes do consentimento (18+ autodeclarado + aceite com `LEGAL_VERSION` versionado); tabelas sem acesso direto (só RPC `security definer` com `search_path=''`); exportar, corrigir e excluir sempre disponíveis; retenção definida nas migrations; qualquer dado novo exige atualizar `src/content/legal.ts`.
12. **`VITE_SUPABASE_ANON_KEY` e `VITE_SUPABASE_URL` são as únicas chaves Supabase com prefixo `VITE_`.** Nunca expor a `service_role key` com prefixo `VITE_` — ela daria acesso total ao banco ao cliente. Leia cada variável pelo nome (`import.meta.env.VITE_X`): ler o objeto inteiro publica todas as variáveis `VITE_` do build.

---

## Colaboração entre Agentes (Claude, Codex e IBM Bob)

Mais de um agente trabalha neste repositório. O humano coordena; os agentes seguem este protocolo.

> Quando o Codex está indisponível, o Claude se divide em **subagentes** (worktrees em `.claude/worktrees/`, ignorados pelo git), cada um com escopo de arquivos exclusivo, e um subagente revisor faz a revisão cruzada no lugar do Codex.

1. **Uma tarefa por agente, atribuída pelo humano.** Antes de começar, confira no backlog abaixo se o item está marcado com o seu nome (`@claude`, `@codex` ou `@bob`). Não pegue item sem dono nem item de outro agente.
2. **Worktree próprio, nunca a pasta principal.** `PRGB/` é reservada para `main` e merges.
   ```bash
   git worktree add ../PRGB-codex  -b codex/<tarefa>  main   # Codex
   git worktree add ../PRGB-claude -b claude/<tarefa> main   # Claude
   git worktree add ../PRGB-bob    -b bob/<tarefa>    main   # IBM Bob
   ```
   Cada worktree precisa do seu próprio `npm install`.
3. **Branch com prefixo do agente** (`codex/…`, `claude/…`, `bob/…`), um problema por branch, commits no padrão `feat:`/`fix:`/`refactor:`/`docs:`/`chore:`.
4. **Sem sobreposição de arquivos.** Dois agentes não editam o mesmo arquivo ao mesmo tempo. `ampEngine.ts`, `audioEngine.ts` e `App.tsx` ficam com um agente por vez.
5. **Revisão cruzada antes do merge.** O outro agente revisa `git diff main...<branch>` e roda `npm run lint && npm run build && npm test`. Merge em `main` pelo humano, ou pelo Claude quando o humano delegar, sempre depois da revisão.
6. **Ao terminar:** atualize o item do backlog (status + branch), deixe o worktree limpo e reporte o que foi verificado e o que ficou pendente.

### Canal direto Claude → Codex

O Claude Code orquestra: aciona o Codex pela CLI, lê a resposta e consolida para o humano. O humano continua atribuindo tarefas e aprovando merges.

```bash
# Tarefa (edita só o worktree do Codex); prompt via stdin, pois o PowerShell 5.1 quebra aspas em argumentos
codex exec -C ../PRGB-codex -s workspace-write - < tarefa.md
# Revisão (somente leitura) de uma branch do Claude
codex exec -C ../PRGB-claude -s read-only - < revisao.md
```

- Toda mensagem do Claude ao Codex começa com `[Claude → Codex]` e diz: tarefa ou pedido de revisão, branch/commit, e o que devolver.
- O Codex responde em texto ao final da execução: o que fez, o que verificou (lint/build/test), o que ficou pendente. Se precisar de algo do Claude, termina com `[Codex → Claude] <pergunta>`.
- O Codex não faz commit (o sandbox não grava no `.git` do repositório principal): o Claude revisa, roda lint/build/test e commita com "Implemented by Codex, reviewed by Claude."
- Arquivos sempre em UTF-8: já houve um "Ú" virando "?" numa gravação do Codex.

### IBM Bob no protocolo

O IBM Bob (agente sem acesso a terminal) participa como **revisor e implementador de tarefas de código/documentação** em worktree próprio. Roda sem terminal, então Bob:
- Lê arquivos, implementa mudanças e reporta o diff ao humano.
- Não faz commit nem roda lint/build: o humano ou o Claude executam a validação antes do merge.
- Toda tarefa entregue pelo Bob deve ser revisada com `npm run lint && npm run build && npm test` antes de fazer merge em `main`.

---

## Problemas Conhecidos (Backlog de Melhoria)

Formato: `- [ ] **Item** — descrição` + `(@agente, rodada, branch, status)`.

### Divisão de áreas
- **@claude:** `src/services/` (áudio, DSP, pitch, parser, scoring, records, nickname, challenge, backend), testes, documentação e orquestração.
- **@codex:** `src/context/`, `src/components/`, `App.tsx` (UI, estado, canvas), PWA.
- **@bob:** tarefas sem terminal em qualquer área, atribuídas pelo humano; o Claude roda lint, build e testes e revisa antes do merge.
- Item que cruza áreas espera o dono da outra área liberar o arquivo.

### Rodada 1 — destravar o build (concluída, merge em `main` 4ba14eb)
- [x] **Build quebrado** — tipos `Float32Array<ArrayBuffer>` em `ampEngine.ts` + imports não usados (@claude, `bb447da`, aprovado por @codex)
- [x] **Canvas não responsivo** — ResizeObserver em `PracticeGame.tsx` (@codex, `77d100c`, aprovado por @claude)
- [x] **Estado monolítico** — `AudioSessionContext` + `ModalsContext` (@codex, `77d100c`, aprovado por @claude)
- [x] **PRGB Amp recriada a cada reconexão** — AudioContext e amp reaproveitados entre `start()` (@codex, `77d100c`, aprovado por @claude; não testado com interface real)

### Rodada 2 — fundação de áudio e parser (concluída, merge em `main` 1a77f10)
- [x] **Pitch detection incompleta** — `stringEstimate`/`fretEstimate` (posição de casa mais baixa, `setTuning`), fade de ganho na reconexão, fila start/stop, fallback de device (@claude, aprovado por @codex)
- [x] **Parser de tabs** — **bug grave corrigido**: cordas do JSON bruto são 0-indexed (todas as notas saíam uma corda acima); ties, grace notes, dead/ghost/tapping/harmonic/bend (@claude, aprovado por @codex)
- [x] **Sem persistência** — `preferences.ts` (@codex, aprovado por @claude)
- [x] **Performance do Canvas** — camada estática em OffscreenCanvas, Path2D, DPR, pitch fora do render do React (@codex, aprovado por @claude)

### Rodada 3 — metrônomo, testes e PWA (concluída, merge em `main` 058b7fc)
- [x] **Integração dos novos campos** — tuning da tab no pitch, device efetivo persistido, dead/grace/ghost sem penalidade, bend aceita base ou alvo (@codex, aprovado por @claude)
- [x] **Sem tratamento de erros na UI** — `ErrorNotice` + `uiErrors.ts` (@codex, aprovado por @claude)
- [x] **Metrônomo impreciso** — `beatGrid` (compasso + mudanças de tempo) e `MetronomeScheduler` no relógio do AudioContext; `initialBpm` corrigido (@claude; a revisão de @codex achou 4 bugs — primeiro clique, contexto suspenso, anacruse, retomada — corrigidos com testes e aprovados)
- [x] **Sem testes** — Vitest nos services; cada correção tem teste que falha no código anterior (@claude)
- [x] **Sem PWA/offline** — manifest + service worker do app shell gerado no build; tablaturas nunca vão para o cache (@codex, aprovado por @claude; testado offline no Edge com o build de produção)

### Rodada 4 — ranking Supabase (concluída, em `main`)
- [x] **Ranking online** — `supabase/migrations/` (ranking, retention, reaccept_terms), `src/services/backend/rankingApi.ts`, `src/services/backend/supabaseClient.ts`, `src/services/scoring.ts`, `src/services/records.ts`, `src/services/nickname.ts`, `src/context/rankedRun.ts`, `src/context/ranking.ts`, `src/context/RankingProvider.tsx`, componentes de ranking (@claude/@codex)
- [x] **Edge Function register-part** — conta notas do lado do servidor para limitar scores; `supabase/functions/register-part/` (@claude). Desde a Rodada 14 (A6) ela só devolve faixa já guardada e não consulta fonte externa: o ranking vale só para conteúdo semeado
- [x] **LGPD** — `src/content/legal.ts`, `src/context/localData.ts`, `src/context/legalRoute.ts`, `src/components/LegalPage.tsx`, `src/components/LocalDataControls.tsx`, `src/components/DeleteAccountConfirm.tsx` (@claude/@codex)
- [x] **Desafios** — `src/services/challenge.ts`, `src/components/ChallengeCard.tsx`, `src/components/ChallengeSharePanel.tsx` (@claude/@codex)

### Rodada 5 — dupla online (concluída, em `main`)
- [x] **Serviço das salas** — `src/services/backend/roomChannel.ts`, migrations `room_realtime` e `room_data_export`; testado no Supabase real por script, com duas contas: vagas, canal privado, presença, mensagens e saída do anfitrião (@codex, @claude)
- [x] **Interface da dupla online** — `RoomModal`, `RoomProvider`, `room.ts` (estado puro, com testes), `OnlinePracticeGame`, `OnlineHud`, `OnlineResultPanel`: lobby, escolha de faixa, início no mesmo relógio, placar da equipe e revanche. Partida online nunca vale para o ranking (@bob, revisada e corrigida por @claude; testada no Supabase real com dois navegadores e microfone sintético)
- [ ] **Alinhar histórico de migrations** — as migrations `room_realtime` e `feedback` foram aplicadas manualmente pelo SQL Editor fora do histórico do CLI Supabase (o remoto tem 4 entradas contra 7 arquivos); precisa reconciliar com `supabase migration repair` antes do próximo `supabase db push` (@claude)

### Rodada 6 — Play Free (concluída, em `main`)
- [x] **Play Free** — modo livre, sem música nem pontuação: mostra nota, frequência, afinação, corda, casa, nível e clareza, e o histórico nas seis cordas; serve também para testar a entrada de áudio (@bob, revisado e corrigido por @claude; testado no navegador com microfone sintético, não com guitarra)

### Rodada 7 — entrada e saída de áudio e relatos (concluída, em `main`)
- [x] **Rota de áudio** — sai sozinho do microfone do PC, saída escolhida com `setSinkId`, medidor em dB. Interfaces USB podem devolver a saída para a própria entrada: antes de abrir o monitor no mesmo aparelho, um tom de -40 dBFS testa o retorno. **Não reproduza esse laço em teste**: ele satura a saída da interface (@claude; validado no hardware real, sem guitarra tocando)
- [x] **Caixa de reportar problemas** — RPC `submit_feedback` com a chave pública, sem conta nem consentimento; guarda categoria, tela e texto, limite de 60 por hora para todos, apagados em 180 dias. Os relatos são lidos na tabela `feedback`, no painel do Supabase (@claude)

### Rodada 8 — áudio no Firefox, conformidade e som neural (concluída, em `main`)
- [x] **Laço de saída** — o teste de retorno só funcionava em silêncio, rodava uma vez e nem existia no Firefox. Agora: rajadas a 7 kHz, vigia por timer que fecha o monitor com a entrada saturada, monitor fechado antes de trocar a saída (@claude; validado com a interface real no Edge e no Firefox)
- [x] **Painel de rota** — dispositivos por aparelho, buffer, reamostragem, baixo consumo, compensação, ganho de entrada e gate, com o caminho do som ao vivo (@claude)
- [x] **Saída no Firefox** — ele não roteia AudioContext: o som vai por um `<audio>` com `setSinkId` e, se preciso, `selectAudioOutput` (@claude; latência maior que no Chromium, não medida)
- [x] **Conformidade** — alegações sem prova, nomes de terceiros, Política, Termos, aviso de armazenamento, licenças, contraste e teclado. Auditorias: axe 0 violações, Tab em todos os controles, site só fala com o próprio domínio (@claude; não é parecer jurídico)
- [x] **Som neural** — modelos .nam e IR do jogador, sem incluir modelos; WaveNet padrão usa ~30% de um núcleo deste PC (@claude; testado com modelos sintéticos, não com um .nam real)
- [x] **Build sem avisos do projeto** — o worklet e o wasm do motor ficam ao lado do módulo, fora do precache, e o React vai num chunk próprio. O aviso `cache-dir` vem do ambiente da Vercel, não do repositório (@claude)

### Rodada 9 — navegação (concluída, em `main`)
- [x] **Menu e abas** — Exercícios, Músicas, Modos, Áudio e Ranking sempre à mão; o estado do áudio é um botão que abre o painel. Abaixo de 1024 px vira barra de abas (@claude; testado em 320, 390, 768, 1024 e 1440 px)
- [x] **Landing** — duas ações no topo, modos e preparo da guitarra logo abaixo, aviso de armazenamento no fluxo da página, sem cobrir botões (@claude)
- [x] **Botão Voltar do navegador** — cada camada aberta (jogo, dupla, sala, Play Free e cada modal) tem entrada própria no histórico, criada ao abrir; Voltar fecha a de cima, uma por vez, em vez de sair do site. Nunca crie entrada sem gesto do usuário, porque o Chromium passa a pular todas as entradas do site: nada de entrada em reação ao Voltar, e os painéis de resultado, que abrem sozinhos, ficam fora do histórico. Título da aba por tela (@claude; testado no Edge e no Firefox, sala online só por leitura do código)
- [x] **Continuar** — quem volta ao site vê a landing com um cartão da última música, em vez de cair direto no jogo. Abrir o site não chama mais o provedor de tablaturas (@claude)
- [x] **Ranking visível** — o menu abre o placar do exercício, sem conta (@claude)
- [x] **Painel de Áudio** — diagnóstico primeiro, duas colunas, ajustes avançados recolhidos (@claude; testado com microfone sintético, não com a interface real)
- [x] **Jogo e Play Free no celular** — sem rolagem lateral, folha "Mais", seta de voltar e pista com pelo menos 45% da tela (@codex, revisado por @claude)
- [x] **Bundle sem metadados do deploy** — a leitura dinâmica de `import.meta.env` publicava todas as variáveis `VITE_` do build, inclusive as da Vercel; um teste barra a volta dela (@claude)

### Rodada 10 — exercícios e contagem (concluída, em `main`)
- [x] **Contagem antes de tocar** — 5 s em tempo real antes de uma partida desde o início, com botão Pular: as primeiras notas esperam na tela, andam nos 2 s finais e o último compasso tem cliques. Retomar não conta de novo. Na dupla online, a contagem que já existia subiu para 5 s (@claude)
- [x] **Biblioteca de exercícios** — nove categorias e 1.891 variantes geradas por regras de teoria, em `musicTheory.ts` e `exercises.ts`. Os testes conferem cada variante: notas na escala, casas válidas, compassos completos, id único. Funciona offline. Recorde pessoal e desafio funcionam; ranking, não: o servidor só conhece a demo e as músicas baixadas (@claude)
- [x] **Acordes pontuados pela tônica** — a detecção é monofônica. Medido com cordas sintetizadas: num acorde batido ela devolve a tônica, em geral uma oitava abaixo, então o jogo julga o acorde uma vez, pela tônica (Perfeito) ou por outra nota dele (Bom), com 80 ms a mais de tolerância. Não separa A de Am, e a tela diz isso. No arpejo, com cordas soando juntas a leitura vira o acorde: outra nota do acorde conta como Bom (@claude; testado tocando com cordas sintetizadas: 100% tocando certo, 15% a 31% tocando errado; não testado com guitarra real)
- [x] **Teste de latência** — a detecção tem atraso e o jogo não compensava: tocando no tempo exato, 0 de 29 notas viravam Perfeito. O teste mede esse atraso e preenche a compensação que já existia nos ajustes avançados: 12 notas em ritmo fixo, com a velocidade e o desenho do jogo, porque o jogador antecipa em vez de reagir; descarta as 2 primeiras, usa a mediana, tira os toques fora do padrão e pede para repetir se a mão variou demais. O resultado sugere o teste quando dá muito Bom e pouco Perfeito (@claude; testado tocando com cordas sintetizadas: de 0 para 22 a 28 Perfeitos em 29 notas, e sem nenhum erro depois do ajuste; não testado com guitarra real)
- [x] **Desafio do exercício** — "Desafiar um amigo" nunca funcionou no exercício: o artista "Exercício PRGB" contém um termo reservado do filtro. Agora é "Exercício original" (@claude)
- [x] **Mais folga para acertar** — a leitura da nota só chega depois da palhetada, então quase toda nota perdida passava do limite do lado do atraso, principalmente sem o teste de latência. As janelas ficaram assimétricas: Perfeito de 70 ms antes a 110 ms depois da linha, Bom de 150 ms antes a 260 ms depois. A nota certa uma oitava fora conta como Bom, e a compensação agora acompanha a velocidade da música (@claude; medido no build de produção com cordas sintetizadas e mãos simuladas: sem o teste e com 60 ms de atraso de interface, a escala foi de 48% a 62% para 90% a 100% de acertos; tocando errado, a escala segue em 34% e os acordes foram de 8% para 15%; não testado com guitarra real)

### Rodada 11 — modo treino (concluída, em `main`)
- [x] **Modo treino** — nos exercícios, um botão repete o exercício sem parar: a volta seguinte começa onde a anterior termina, sem contagem, e já aparece chegando na pista. Os pontos somam; desligar termina no fim da volta. Mais de uma volta não vale recorde nem desafio (@claude; testado com cordas sintetizadas: 3 voltas seguidas, 87 de 87 notas; não testado com guitarra real)

### Rodada 12 — CAPTCHA na entrada do ranking (concluída, em `main`)
- [x] **Verificação contra robôs** — a conta anônima nascia sem nenhuma checagem. Com `VITE_TURNSTILE_SITE_KEY`, a entrada do ranking mostra o CAPTCHA da Cloudflare depois das caixas de 18+ e consentimento, e o token vai junto na criação da conta; reaceite e sessão já salva não pedem. Sem a chave, nada muda. Política e Termos descrevem a Cloudflare; `LEGAL_VERSION` foi para 2026-11-04 e quem já tem conta reaceita (@claude, dividido em dois subagentes; widget `PRGB` criado na conta Cloudflare do humano para prgb.vercel.app e localhost; testado com a chave de teste, sem criar conta; com a chave real, o navegador automatizado recebe "Confirme que é humano", como esperado)

### Rodada 13 — endurecimento, a partir de uma auditoria de checklist (em `claude/endurecimento`)
- [x] **Auditoria** — 456 itens em 28 áreas, divididos entre quatro subagentes e o Codex, só leitura. Segurança de dados, RLS, autorização, SQL e LGPD estão em ordem; as falhas ficavam em operação e defesas de borda (@claude, @codex)
- [x] **Lint da `main`** — o merge do CAPTCHA entrou com erro de lint em `CaptchaField.tsx`, porque só os avisos foram contados e não o código de saída; corrigido, e o CI agora barra isso (@claude)
- [x] **CI e Dependabot** — `.github/workflows/ci.yml` roda lint, build, testes e `npm audit --omit=dev` a cada push na `main` e em cada pull request; Dependabot semanal para npm e mensal para as actions (@claude; do YAML só a estrutura foi conferida, a primeira execução real é no GitHub)
- [x] **Tela de recuperação** — `ErrorBoundary` em vez de página branca; nada sai do navegador (@claude; provado no Edge com um erro forçado)
- [x] **Cabeçalhos de segurança** — CSP, nosniff, anti-framing, Referrer-Policy e Permissions-Policy; rewrites do acervo restritos; `security.txt`, `robots.txt`, `sitemap.xml` e metadados (@claude; CSP provada no Edge com zero violações nos fluxos principais, incluindo um `.nam` sintético e o Turnstile; os rewrites foram conferidos com `@vercel/routing-utils`; não testado: Firefox, `.nam` real e o rewrite real na Vercel)
- [x] **Rede do acervo** — timeouts (12 s busca e meta, 20 s tab), uma retentativa em erro de rede ou 5xx, validação das respostas com mensagem própria para formato inesperado, e erro distinto para salas lotadas do Realtime (@claude; os nomes dos sinais do Realtime vêm da documentação, não de teste no servidor)
- [x] **Limites de abuso no banco** — `rpc_quota` por jogador e hora (`create_profile` 5, `update_nickname` 10, `join_room` 30, `export_my_data` 10), mesmo texto de relato no máximo 3 vezes por hora, histórico do pg_cron apagado em 30 dias. Só chamadas bem-sucedidas contam (@claude; testado em PGlite; **migration ainda não aplicada em produção**)
- [x] **Acessibilidade e 404** — rótulo visível na busca, aviso de carregamento do modelo neural, alvos de 44 px e página não encontrada para caminhos fora da raiz (@codex, revisado por @claude)
- [x] **Operação** — `docs/operacao.md` (inventário, MFA, plano de incidente, backup, rotação de chaves), `scripts/backup-db.sh`, README e CHANGELOG atualizados (@claude; o script de backup não foi testado)
- [x] **Aplicar a migration de limites** — `rpc_quota` e os jobs `prgb-rpc-quota-retention` e `prgb-cron-history-retention` existem em produção (conferido por SQL em 2026-11-19); o histórico do CLI Supabase não lista a migration, como as outras aplicadas pelo SQL Editor (@claude)
- [ ] **Chave pública do Supabase no formato antigo** — o bundle usa a chave `anon` legada (JWT); o fornecedor anunciou o fim das chaves legadas para o fim de 2026 (a confirmar). Migrar para a chave publicável e rever o uso da service role no `register-part` (@claude)
- [ ] **Backup restaurável** — o plano gratuito não tem backup; ensaiar o `scripts/backup-db.sh` e uma restauração num projeto descartável (@claude/humano)
- [ ] **Monitoramento externo** — sem monitor de queda nem alerta; criar um monitor gratuito para o site (humano)
- [ ] **Relatos sem anti-robô** — um robô que varia o texto ainda esgota os 60 relatos por hora; só CAPTCHA validado numa Edge Function ou limite por IP resolve, e ambos mexem na Política (decisão do humano)
- [ ] **Ambientes separados** — previews e `.env.local` usam o projeto Supabase de produção; criar um segundo projeto gratuito (humano)
- [x] **Testes de ponta a ponta no repositório** — `npm run e2e` (Playwright, `e2e/*.e2e.ts`, `playwright.config.ts`): build própria em `dist-e2e/`, `vite preview`, microfone falso, CSP do `vercel.json` aplicada à página e toda requisição para fora do servidor abortada. Cobre: landing sem erro de console nem violação de CSP; "Tocar agora" com a contagem de 5 s no meio e a pista sem mudar de altura; um exercício inteiro até "Prática concluída"; Aparência (clicar em interruptor não rola a página, escolhas persistem ao recarregar); nenhum estouro lateral nem diálogo maior que a janela em 1366x768, 1280x600 e 390x844 (8 telas); Voltar fecha uma camada por vez. Os arquivos terminam em `.e2e.ts` porque o Vitest coleta todo `.spec.ts`. Job `e2e` no CI, separado e com `continue-on-error` até a primeira execução real no GitHub (@claude; passa no Edge no Windows; **não testado**: Chromium do Playwright no Linux, Firefox, WebKit, fluxos com Supabase)
- [x] **E2E contra um Supabase local** — `npm run e2e:supabase` (`e2e/supabase/*.e2e.ts`, `playwright.supabase.config.ts`, `scripts/e2e-supabase.mjs`; seção 12 de `docs/operacao.md`). 8 testes em ~1,5 min contra `supabase start` em Docker: placar sem conta; conta com consentimento; partida ranqueada do exercício original aceita pelo servidor e no placar semanal e geral; exportar e excluir a conta (nada sobra no banco); limite por hora de `update_nickname` (o 11º é recusado); dupla online com dois navegadores (sala, faixa, pronto, início no mesmo relógio, mesmo placar da equipe, sair e voltar, sala cheia, código desconhecido). A `register-part` respondeu 200 com a **chave publicável** + JWT do jogador e `verify_jwt = true` no Supabase local (risco do passo 4 do runbook 7.1 reduzido, não provado na produção). Nada de produção é tocado: guarda de URL local, chaves só em memória, requisições fora da API local abortadas, contas apagadas no fim (@claude; testado só no Edge do Windows com Docker Desktop; **não testado**: o job `e2e-supabase` do CI no GitHub, Chromium do Playwright no Linux, o Turnstile (CAPTCHA desligado no local), `create_profile` a 5 por hora; achado menor do app: ao excluir a conta, o `/auth/v1/logout` responde 403 e o navegador registra um erro no console, sem efeito para o jogador)
- [ ] **Safari e celulares reais** — nunca testados (humano)

### Rodada 14 — repertório próprio, progresso, acervo experimental e aparência (em `main`)
- [x] **Repertório próprio** — peças de domínio público escritas em notação compacta, uma por arquivo em `src/content/songs/`, carregadas sob demanda; a tela `RepertoireLibrary` é a porta de entrada das músicas e o acervo externo ficou dentro dela, como extra experimental. Funciona offline: o chunk da tela e o das peças entram no precache (@claude/@codex; só a "Ode à Alegria" existe e **a revisão humana dela está pendente**; não testado com guitarra real)
- [x] **Progresso local** — estrelas por peça, palhetas e dias de ensaio da semana, mostrados no resultado de uma partida solo; fica só no navegador, entra na exportação e na exclusão dos dados locais (@claude; não testado no navegador com uma sessão longa)
- [x] **Acervo externo experimental** — aviso na tela, cache de 5 minutos, recuo de 60 s quando ele recusa (403/429) e `VITE_ACERVO_ENABLED=false` para esconder todo caminho até ele. O ranking só aceita o que está semeado no banco (por ora, só a demo) (@claude/@codex)
- [x] **Aparência** — seis temas, estilos de nota, personalização de cordas, efeitos opcionais do canvas (desligados por padrão), estilos de componentes, três tipografias e quatro fundos; persistência em `prgb:appearance:v1`, aplicada antes da primeira pintura por `public/appearance-boot.js`. Original com os padrões é idêntico ao visual anterior. Entra na exportação e na exclusão dos dados locais e na Política, sem mudar `LEGAL_VERSION` (nada sai do dispositivo). Brilho do COMBO também no HUD; fontes IBM Plex e as telas próprias entram no precache. Contrato em `docs/aparencia.md` (@claude/@codex; medido só por testes unitários e build; **não testado**: telas no navegador real, Firefox, Safari, celulares, contraste de cada tema com leitor de tela, efeitos com guitarra tocando)
- [x] **Tela de Aparência** — tela cheia lazy (`AppearanceScreen` + `components/appearance/`): seis categorias, preview ao vivo com o mesmo desenho do jogo, presets, restaurar padrões e entrada no cabeçalho com camada própria no histórico. Testada no Edge (1280, 390 e 320 px; seis temas; persistência; Voltar; teclado; jogo com estilo de nota e esquema de cordas); o chunk está no precache. Não testado: Firefox, Safari, celular real, leitor de tela, hover/foco/active reais, offline com o service worker instalado, guitarra real (@claude)
- [x] **Mais peças** — Greensleeves, Minueto em Sol (Petzold), Brilha brilha estrelinha e seis originais (riffs e progressões), cada uma com teste de melodia independente e linha em `docs/repertorio.md`. A UI mostra "Em revisão" até alguém tocar e marcar `reviewed: true` no catálogo; só a Ode foi aprovada. Descartadas por falta de segurança na melodia: Atirei o pau no gato, Ciranda cirandinha, O cravo e a rosa, Para Elisa e Canon em Ré (@claude; ninguém tocou as novas)
- [x] **Tela Meu progresso** — nível, ensaio da semana com meta de 3/5/7 dias, palhetas e conteúdo tocado, lazy e no cache offline (@claude; testada no Edge em 1280/390/320 px; offline provado com o service worker)
- [x] **Orçamento de bundle** — `npm run check:bundle` no CI falha se o JS gzip passar dos limites de `scripts/check-bundle-size.mjs` (@claude)
- [x] **register-part somente leitura (A6)** — publicada no Supabase em 2026-11-17 (versão 3, `verify_jwt` mantido, pelo CLI)
- [x] **Semear a Ode no ranking (B3)** — migration `20261117120000_seed_repertoire.sql` rodada em produção em 2026-11-17 (linha conferida: 62 notas, 53333 ms, 32700 pontos) e `rankable.ts` na `main`. **Não testado**: uma partida ranqueada da Ode no site publicado (precisa de conta e microfone)

### Rodada 15 — trilha de evolução e busca em destaque (em `main`)
- [x] **Busca no acervo em destaque** — botão "Buscar uma música" na primeira tela, item "Buscar" no menu e cartão na seção "O que você quer tocar?"; some com `VITE_ACERVO_ENABLED=false`. Sem o nome do provedor na interface. Aumenta a exposição ao maior risco legal do projeto (ver Pendências) (@claude; já publicado na `main`; não testado: Firefox, Safari, celular real, busca com rede real)
- [x] **Mais exercícios** — 58 exercícios novos: primeira posição, aranha, palhetada em semicolcheias, trinado, slides, pentatônicas emendadas e frases, três notas por corda (posições 2 a 7), acordes abertos e de pestana, progressões, ritmo e funk. Biblioteca: 154 exercícios, 3.339 variantes, todas conferidas pelos testes (@claude)
- [x] **Trilha de evolução** — `trail.ts` e `TrailScreen`: 15 etapas, 148 passos (hoje 16 etapas e 154, ver Rodada 19), do mais fácil ao mais difícil, com estrelas e "Continue daqui"; nada bloqueado e sem texto de perda ou urgência (um teste confere). Pesquisa e critérios em `docs/trilha.md`. Testada no Edge em 1280, 390 e 320 px (abrir pela landing, Voltar, tocar um passo). **Não testado**: a ordem com quem toca, guitarra real, Firefox, Safari, celular físico, leitor de tela (@claude)

### Rodada 16 — sessões de prática (em `main`)
- [x] **Sessão de prática** — fila de exercícios tocados em sequência, sem voltar ao menu: faixa "A seguir" com contagem de 10 s (pausar, pular, encerrar) na versão original, **substituída na Rodada 18**: os exercícios seguem direto, com contagem de 3 s, e o resumo vem só no fim (exercícios, tempo, estrelas, precisão média). Três jeitos de montar (etapa da trilha, por tempo de 10/15/20 min, à mão) e duas formas de alongar (rodar 3/6/12 tons de quarta em quarta; todos os jeitos de tocar). Estrelas, recordes e ensaio da semana contam como em qualquer partida; não vale para o ranking e nada novo é gravado. Detalhes em `docs/sessoes.md` (@claude; testada no Edge em 1280, 390 e 320 px com microfone sintético: montar, tocar duas peças, pausar a contagem, avanço automático, resumo, Voltar. **Não testado**: sessão longa de verdade, guitarra real, Firefox, Safari, celular físico, leitor de tela; a ordem e as fatias do "por tempo" não foram validadas com quem toca)

### Rodada 17 — primeira carga menor e ranking automático (em `main`)
- [x] **Primeira carga** — `App.tsx` carrega o jogo, o Play Free, a dupla online e os modais por `lazy` (`OnDemand` só monta depois da primeira abertura); os chunks entram no precache por caminho em `vite.config.ts`. Entrada 120,6 para 59,8 kB gzip; entrada + React 186 para 126 kB. `check:bundle` limita a primeira carga e a entrada; o total só protege o cache offline. Não feito: separar `PRIVACY_POLICY`/`TERMS_OF_USE` de `legal.ts` (a rota por hash resolve as seções de forma síncrona) (@claude; testado no Edge com o build: jogo, modal de áudio e entrada do ranking abrem; offline com o service worker não retestado)
- [x] **Ranking automático** — com conta, a partida de conteúdo rankeável já nasce valendo (velocidade 1× e sem saltos, como antes); sem conta, botão "Crie uma conta para valer no ranking" abre a entrada, e criar a conta com o jogo aberto liga o ranking. A chave "Valer para o ranking" foi removida; se a checagem falhar, aparece "Tentar o ranking de novo" (@claude; testado em DEV com as cenas `ranking-automatico` e `ranking-sem-conta`; **não testado**: partida ranqueada real com conta e Supabase)

### Rodada 18 — todas as variações de um exercício (em `main`)
- [x] **Tocar todas as variações** — o modo "Todas as variações em sequência", escolhido no topo da biblioteca, monta uma sessão com os 12 tons e todos os jeitos de tocar (`expandItem`), com a contagem e o tempo estimado; escolha de tons (só este, 3, 6 ou 12; padrão 3) e Encerrar sessão a qualquer hora. Não há botão extra em cada cartão. Na sessão, um exercício vai direto para o próximo (terminando 800 ms depois da última nota) e os resultados só aparecem no fim, com a lista de cada exercício (@claude; testado no Edge com o build: 6 variações, passou do 1º para o 2º sozinho em ~17 s sem modal e o 2º começou a tocar; **não testado**: sessão longa inteira, guitarra real)

### Rodada 19 — revisão crítica (em `claude/revisao`, correções em seis branches `claude/fix-*`)
- [x] **Revisão crítica** — seis revisores independentes, só leitura: 89 achados, nenhum de segurança crítico ou alto. Relatório com dono e plano de correção em `docs/revisao-critica.md` (@claude)
- [x] **Segurança e documentação (F6)** — backup local com 7 dias e sem `play_sessions` (SEG-02); `image` do meta validado em `tabsApi.ts` e `tabNormalizer.ts` (SEG-05); textos do anfitrião na sala filtrados por `textSafety.ts` (SEG-06); riscos aceitos e procedimentos (moderação por SQL, cotas, rate limit, origens) em `docs/operacao.md` seção 11 (SEG-01/03/04/08/10); README, mapas do AGENTS.md e do CLAUDE.md, CHANGELOG, metadados do `index.html`, documentos de identidade como histórico e nomes de terceiros fora de comentários e fixtures (ENG-05, CONT-04/07/08/10/11/17/18) (@claude; testado só por testes e build)
- [ ] **Limite por tentativa falha (SEG-03)** — `update_nickname`, `create_profile` e `join_room` só contam chamadas bem-sucedidas; decisão de não entregar migration agora e a alternativa estão em `docs/operacao.md` seção 11.2 (@claude, decisão do humano)
- [x] **Imagem de compartilhamento (CONT-01)** — `public/og-image.png` regerada em 2026-11-19 com "simulador de amplificador" (só o subtítulo mudou; @claude)
- [x] **Rate limit no Vercel Firewall (SEG-08)** — regra `Limite do acervo` publicada em 2026-11-19: 60 requisições por minuto por IP em `/api/tabs`, `/cdn/tabs` e `/cdn2/tabs`, negando o excesso (@claude; não testado com tráfego real)
- [ ] **Texto legal sobre o backup local e o envio automático ao ranking (SEG-02, SEG-07b)** — ações e decisões do humano; `LEGAL_VERSION` não foi alterado
- [x] **Jogo (F1)** — confirmação ao sair, legenda da 1ª partida, ajustes da sessão mantidos (`sessionSettings.ts`), timeout de 10 s no ranking (`RANKING_TIMEOUT_MS`; verificação automática silenciosa com `prepare(true)` e `abandonAutomatic()`), `judgeNotes()` separado do desenho no `PracticeGame` com `createLayer` (em `practiceLanes.ts`) para navegadores sem `OffscreenCanvas`, treino sem nota perdida na virada da volta, `AudioRouteNotice` no jogo (CORE-01, 03, 04, 07, 09, 10, 11; UX-02, 04, 07, 14, 15, 18, 19, 24, 25; SEG-07a) (@claude; testado no Edge com o build e por vitest; **não testado**: rede pendurada de verdade, Safari antigo, celular real, guitarra real)
- [x] **Áudio (F2)** — interface desconectada detectada pelo `ended` da track (`setDisconnectListener`), saída indisponível com aviso, MediaStream liberado se a abertura falha, volume com 4 casas, Play Free com a leitura do pitch isolada, rack do amp sem alegações (CORE-02, 05, 06, 08, 12; CONT-17; UX-13, 24; A11Y-02, 08) (@claude; vitest com os 4 testes novos falhando no código antigo; **não testado**: USB real, Firefox, navegador)
- [x] **Interface (F3)** — `LazyScreen`/`lazyWithRetry`/`LazyErrorBoundary`, "Tocar agora" com áudio, landing em grupos, nomes padronizados, estrelas e precisão explicadas, repertório com "Vale para o ranking", Aparência em português, alvos de 44 px (UX-01, 03, 05, 06, 08, 09, 11, 12, 13, 16, 17, 20, 21, 22, 23; ENG-02, 03, 08, 09; CONT-05; A11Y-01 a 05, 07) (@claude; testado no Edge com o build: landing em 320/390/1280 px, "Tocar agora" pedindo o microfone, falha de chunk com "Tentar de novo"; **não testado**: Firefox, Safari, celular real, leitor de tela)
- [x] **Conteúdo (F4)** — tons pela armadura, níveis 1 e 2 até a casa 20, trilha com 16 etapas e 154 passos, "Brilha, brilha" tradicional, textos em cifra e com "casa", glossário e contagem falada (CONT-02, 03, 06, 12 a 16, 20; UX-09, 10). Quem tinha estrelas nos passos cujo tom mudou (113, 124, 131, 132, 133, 136, 140, 145) deixa de vê-las na trilha; seguem salvas no tom antigo (@claude; **não testado**: ninguém tocou)
- [x] **Engenharia (F5)** — o SW não regrava o index (provado no Edge com dois builds), timeout de 3,5 s, build que falha com chunk lazy fora do precache, `check:precache` no CI, manifest sem `orientation`, patches de dependências, Node 22/24 no CI (ENG-01, 04, 06, 07, 10, 11, 12; CONT-09; SEG-09) (@claude; **não testado**: `skipWaiting`, Firefox, Safari)
- [ ] **Resíduos da revisão** — rótulo de tom na biblioteca mostra a grafia maior (Db) também para exercícios em tom menor (o título diz C#m); pré-carregar chunks no idle/hover (ENG-03); decidir 3 tons (biblioteca) x 1 tom (sessão) (UX-09); 2 avisos `only-export-components` em `AudioSessionContext` e 3 em `ModalsContext`, `useGamePalette` e `GameHud` (ENG-08); `npm:@supabase/supabase-js` em `register-part/index.ts` ainda na versão antiga. Lista completa em `docs/revisao-critica.md`
<!-- rodada 19: outros agentes -->

### Rodada 20 — profundidade, sombra-guia, começo da música, barra do jogo e UX (em `test/yousician-3d-speed`, não commitada)
- [x] **Pista e rolagem** — espaçamento fixo por ms de música (a velocidade só muda a rapidez; antes a pista andava a velocidade²), zoom da pista, `depthAt` (notas até 14% menores com a distância, igual em todas as cordas, nunca desloca X por corda), ponto de acerto proporcional (`hitLineX(width)`, ~28%) e velocidades de 0,25× a 2× (ranking e dupla seguem em 1×) (@claude; testes e Edge sem interface; **não testado**: guitarra real, acertar a 1,5× e 2×, Firefox, Safari)
- [x] **Cadência fixa de 60 Hz na análise do pitch** — o laço de leitura do `audioEngine` roda em `requestAnimationFrame`, então analisava tantas vezes por segundo quanto a tela pinta (143 em 144 Hz, 157 em 165 Hz, 30 numa tela lenta), e o debounce de ataque (3 leituras), a espera do legato (2), a regra da nota estável e o histórico do espelhamento foram calibrados para ~60 leituras por segundo: em tela rápida duravam menos tempo. `FixedCadence` (`fixedCadence.ts`) deixa passar um quadro por passo de 1/60 s do **relógio do áudio** (`AudioContext.currentTime`): soma o tempo decorrido, tira um passo a cada análise (taxa média exata, também com o relógio andando em saltos de 10 ms), tolera 20% de um passo para a tela de 60 Hz não perder quadro por chegar cedo, e depois de uma parada longa (thread ocupada, aba escondida) analisa uma vez, sem rajada para compensar. Num relógio parado (contexto suspenso) volta a analisar todo quadro, para um pitch preso ainda limpar. O medidor de nível e o gate do PRGB Amp continuam em todo quadro (o gate abre tão rápido quanto a tela deixa); só a análise (espelhamento do duo, NSDF, `trackAttack` e o aviso do pitch ao jogo) segue a cadência. O modo de baixo consumo analisa 1 passo em 3. `scoring.ts`, as janelas e o NSDF não mudaram. No navegador (Edge, microfone falso com uma palhetada a cada 0,5 s, taxa da tela emulada), análises por segundo e ataques contados em 6 s (≈ 13 palhetadas): 30 Hz 30 → 30; 60 Hz 60 (13–14 ataques) → 58–60 (13–14); 120 Hz 120 (21–22) → 60 (14); 144 Hz 143 (21) → 60 (16); 165 Hz 157 (24) → 60 (18). Com o motor real e sinais sintéticos (`audioEngine.test.ts`): 16 palhetadas em 165 Hz davam 20 ataques e agora 16, igual a 60 Hz; ligados e casa errada pontuam igual em 60, 120, 144 e 165 Hz (@claude; **não testado**: tela de alta taxa real, guitarra real, Firefox com `privacy.resistFingerprinting` (a precisão do relógio do áudio cai e a cadência pode oscilar); refaça o teste de latência: quem tem tela acima de 60 Hz ganha até ~1 quadro de 60 Hz a mais de atraso na leitura)
- [x] **Julgamento de notas ligadas** — a nota de destino de um hammer-on, de um pull-off ou de um slide (`hp` na nota, ou `slide` na anterior, na mesma corda, sem pausa e em outra altura) não exige palhetada: `buildJudgeContexts` (scoring.ts) classifica cada nota uma vez por tab e o jogo passa o contexto ao `judgeNote`. Ela acerta com a nota exata (nunca o semitom vizinho: é a nota anterior ainda soando), lida por pelo menos 2 leituras seguidas (`LEGATO_HELD_FRAMES`) e depois de uma mudança de nota que nenhum acerto anterior usou (`changeId`, novo em `DetectedPitch`: conta toda mudança de nota estável, mesmo a que o debounce de ataque engole). Janela: +60 ms depois da linha (`LEGATO_EXTRA_LATE_MS`), Perfeito só na janela normal. A origem de um slide aceita como Bom as alturas por onde o slide passa. Pontuação e `scoreLimits.ts` não mudaram. Simulado com o motor real e sinais sintéticos (ver `audioEngine.test.ts`): ligados a 1 casa, de 16 e 20 notas por segundo, 83% e 75% → 92%; tocar uma casa errada, 100% → 0%; segurar a primeira nota, 25% → 0% (@claude; **não testado**: guitarra real, palm mute e notas baixas contra `MIN_PITCH_VOLUME`, slide longo com a leitura passando por notas erradas, ligados a mais de 20 notas por segundo)
- [x] **Sincronia** — som de guia e metrônomo agendados no relógio do AudioContext, descontando `outputLatency` (`startTimeFor`), cancelados ao pausar e ao buscar; `noteTimeDiffMs` no julgamento (@claude; **não testado**: ao ouvido, `outputLatency` no Firefox, Safari e Bluetooth, trocar a velocidade com notas já agendadas)
- [x] **Sombra-guia** — `guideShadow.ts`: salto de corda em corda ancorado no relógio da música, cobre todas as notas de um acorde, estilos Sombra e Holograma, muitas opções e predefinições na Aparência (`appearance.guide`), fora do preset do tema e preservada na troca de tema; **sons de acerto e erro** desligáveis (`appearance.hitSounds`) (@claude; **não testado**: contraste nos seis temas e quatro fundos, duo, virada de volta do treino)
- [x] **Começo da música** — 5 s de pista vazia, contagem no centro (overlay, sem salto de layout), fade até a música começar; a legenda e o aviso de rota viraram overlays (@claude; Edge: altura do canvas constante; **não testado**: dupla online, treino, sessões longas)
- [x] **Barra do jogo e Aparência rápida** — grupos, estados, atalhos (Espaço, M, N, A, setas), gaveta que pausa e volta com contagem de 3 s, tela cheia sem perder a partida (@claude; Edge em 1280×600, 1920×1080 e 390×844; **não testado**: Voltar do navegador fechando a gaveta, dupla, leitor de tela)
- [x] **Relógio fora do React** — `commitClock` e `clockView`: de ~190 para ~4 renders por segundo tocando; `scheduleSynth` roda no `renderFrame` (@claude; medido no Edge; **não testado**: dupla, treino, sessões)
- [x] **Responsividade e UX** — alturas baixas, escala da fonte raiz em telas grandes (`index.css`), revisão em `docs/ux-revisao.md` com as correções P0 e P1 baratas (@claude; só Edge sem interface; decisões de produto abertas listadas no doc)
- [x] **Espaçamento automático das notas** — `noteSpacing.ts`: a escala horizontal base é uma janela de 4000 ms de música de ponta a ponta da pista (`LOOKAHEAD_MS`), não px por ms fixo; **numa tela estreita ela tem um piso de legibilidade** (`trackPixelsPerMs`, `READABLE_GAP_MS` = 250 ms): uma nota de diâmetro `d` pede pelo menos `1,05·d / 250` px por ms, então 360 px mostram ~2 s de música à frente em vez de 4 s (em 1366, 1920 e 2560 px o piso não age e o resultado é idêntico ao anterior, também com notas Grandes em 1366 e 2560). O piso só converte para pixels (depende da tela e do tamanho da nota); o fator por seção continua só da música. O fator segue a densidade da música (intervalos entre ataques numa janela de 2 s, percentil baixo): 1 numa zona morta (240 a 900 ms de intervalo, então peça uniforme = 1× simples), **menor** em trechos rápidos (até 0,7: a pista anda mais devagar em px/s e cabem mais notas) e **maior** em trechos lentos (até 1,5, o teto do conforto), com rampas de 1,5 s que começam antes do trecho rápido; a posição de qualquer coisa na pista é `lineX + S(t) - S(posição)`. Onde as notas ficam mais próximas que o tamanho delas elas encolhem (até 50%, com piso em rem) e se sobrepõem um pouco, sem subir o fator; a mais próxima da linha fica por cima. As notas de um hammer-on, pull-off ou slide podem se tocar (são um bloco). O fator depende só da música, nunca da tela, então os dois jogadores de uma dupla concordam. O cartão Espaçamento mostra "Auto ×0,8" ou "Auto ×1,3". Relógio, julgamento, som e ranking seguem em tempo real (@claude; catálogo inteiro: pior toque entre círculos 0 no notebook, na QHD e agora também no celular de 360 e 390 px (era 0,50 no riff funk e 0,2 a 0,4 em 5 exercícios de semicolcheias, antes do piso); medido no Edge; **não testado**: guitarra real, dupla online com duas telas, Firefox, Safari)
- [ ] **Detecção de pitch em AudioWorklet (avaliada, não aplicada)** — hoje o `audioEngine.ts` lê o `AnalyserNode` a cada `requestAnimationFrame` (janela de 2048 amostras, NSDF na thread principal). Medido no Edge sem interface (sinal sintético; a tela de 60 Hz foi emulada, e o navegador sem interface roda o rAF a ~200 Hz): o NSDF custa 1,43 ms em média (até 2,4 ms) por jogador contra 2,67 ms de uma fatia de áudio (128 amostras), então **não cabe numa só fatia da thread de áudio** (arriscaria falhas no som do monitor); repartido entre fatias, ele atrasaria o resultado em até um quadro. Um worklet só de captura (blocos de `sampleRate/60` amostras, detecção na thread principal ao receber o bloco) deu o mesmo atraso do ataque até o pitch (mediana 8–16 ms e p95 18–27 ms nos dois caminhos, com a thread principal livre e ocupada 6, 10 e 14 ms por tarefa) e **não reduziu o jitter** (desvio do intervalo entre análises 4,7 a 7,5 ms contra 0,8 a 4,9 ms). O que ele muda de verdade: (1) cobertura, 100% das janelas de 16,7 ms analisadas contra ~80 a 86% pelo rAF emulado, porque o rAF perde quadros quando a thread principal engasga (nesse teste, em tela de 60 Hz real, a perda ocioso tende a ser menor); (2) a cadência passa a ser fixa em 60 Hz em vez de seguir a taxa de atualização da tela. Em tela de 144 Hz o rAF analisa ~2,4× mais vezes do que os 60 quadros para os quais `ATTACK_DEBOUNCE_FRAMES` (3), `LEGATO_HELD_FRAMES` (2) e `heldFrames` foram calibrados: trocar para o worklet mudaria o julgamento desses jogadores sem teste com guitarra real. Decisão: não aplicar agora (ganho de atraso nulo, risco no núcleo do julgamento, sem como validar com guitarra). Alternativa barata e sem worklet, se a taxa da tela virar problema: o laço do rAF só analisar quando o relógio do áudio avançou um passo de `sampleRate/60` (cadência fixa de 60 Hz, mesmas funções). Scripts da medição fora do repositório: `%TEMP%\wk\jitter.mjs` e `nsdf-bench.mjs` (@claude; **não testado**: guitarra real, interface USB, Firefox, Safari, tela de 144 Hz real)
- [x] **Resíduos desta rodada** — `depthAt` virou `depthScaleAt`/`depthAlphaAt` (escalares, sem objeto por nota por quadro); `drawNote`/`drawBlock` saíram do componente para `laneDraw.ts` (um `LaneDrawEnv` preenchido a cada quadro: sem closures nem objetos por pista, e os 2 avisos `react(immutability)` do `PracticeGame` sumiram); `scheduleSynth` usa `synthSchedule.ts` (notas ordenadas uma vez, busca binária e uma janela curta por quadro, "já entregue" é um número por nota e volta, nada de chave de texto; equivalente à varredura antiga, provado por teste com 120 notas e 4 taxas de quadros); slider de posição com `aria-valuetext` ("1:05 de 3:20", muda só quando muda o segundo); `formatScale` e `guideSummaries` saíram dos arquivos de componente (menos 2 avisos `only-export-components`); `TechniqueLegend` guarda rótulo e descrição separados; "Mostrar as técnicas" na Aparência rápida e um exemplo de bloco (5 H 7 P 5 e 3 / 5) na prévia, desenhado com as funções do jogo; corpo escuro da sombra mais leve e menor enquanto a nota está longe (`proximity`, `GUIDE_FAR_OPACITY`, `GUIDE_FAR_SIZE`); texto "Perfeito!/Bom/Errou" nasce acima da nota, em diâmetros, sem cobrir o número; comentário do `basePixelsPerMs`; rótulo de tom da biblioteca segue o tipo do exercício (`keyChipLabel`: C#m, não Db, em categoria só de menores) (@claude; **bundle**: lazy não dá folga ao `check:bundle`, porque o total soma todos os chunks (e todo chunk lazy novo de `src/components` precisa entrar no `ownLazyContent` do `vite.config.ts`); o limite do total subiu de 340 para 350 kB (`TOTAL_MAX`, com o motivo no comentário do script) e o total está em 333,1 kB; o limite da primeira carga (140 kB) não mudou; **não testado**: duo, treino na virada de volta, guitarra real)

### Pendências conhecidas (sem dono)
- [ ] **Permissão do provedor de tablaturas** — os termos dele proíbem transmitir, reutilizar e baixar o conteúdo sem autorização escrita. É o maior risco legal do projeto; depende de decisão do humano.
- [ ] **Dupla online com guitarras de verdade** — testada de ponta a ponta no Supabase real com dois navegadores, contas temporárias e microfone sintético (partida, revanche com troca de música, queda e volta, saída do anfitrião, exportação e exclusão de conta) e o ranking com uma partida real aceita pelo servidor, mas nunca por duas pessoas com guitarra. Falta também o caso de sala cheia (`room_full`), que exige uma terceira conta.
- [ ] **Revisões diferentes da mesma faixa na dupla** — o convidado carrega a revisão atual da tab, sem conferir a anunciada pelo anfitrião. Decisão: não corrigir por ora; é raro e a partida não vale para o ranking.
- [ ] **Teste com interface de áudio real** — o humano ouviu a guitarra no Firefox com a rota nova, antes das correções finais. Falta validar a versão publicada, a latência, clicks na troca de device, afinador e scoring tocando de verdade, e um arquivo `.nam` real.
- [x] **`setCurrentTimeMs` a cada frame** — o relógio da música agora só vive em `positionRef`; `commitClock` escreve a barra de posição e o fade da contagem direto nos elementos (por ref) e só chama o React quando muda o que aparece (`clockView.ts`: segundo mostrado, número da contagem, fora/dentro da contagem, início). O synth passou a ser agendado no próprio quadro (`scheduleSynth`) e as cores das linhas de compasso vêm de uma tabela (`beatLineColor`). Medido no Edge com microfone falso: de ~190 commits do React por segundo tocando para ~4 (um por segundo mostrado, mais o placar); contagem 5→1 com fade, pausa, seek e fim da música conferidos (@claude; não testado: dupla online, treino na virada de volta, sessões com várias músicas, Firefox, leitor de tela na barra de posição)
- [ ] **Compensação no ranking** — a compensação do teste de latência vale também nas partidas ranqueadas e é escolhida pelo jogador. Ela só centraliza a janela de tempo: não permite pontuar mais do que acertar todas as notas, e o limite do servidor continua valendo.
- [ ] **Exercícios no ranking** — exigiria semear cada variante no banco. Decisão: por ora, só recorde pessoal e desafio.
- [ ] **Sem router** — SPA sem rotas: só telas de jogo e modais têm entrada no histórico; se crescer, avaliar react-router.

### Concluídos
- [x] **App.css é lixo** — removido
- [x] **Assets legados** — `src/assets/` removido
- [x] **Tablaturas em produção** — proxy funciona via rewrites da Vercel (`/api/tabs/*`, `/cdn/tabs/*`, `/cdn2/tabs/*`); validado em produção.

---

## Fluxo do Usuário

```
Landing Page → Clica "Tocar" ou "Buscar" → getUserMedia() → PRGB Amp Ativo
    │                                                            │
    ▼                                                            ▼
  Busca no acervo → Seleciona Música → Download Tab JSON → Parse para NoteEvent[]
                                                                 │
                                                                 ▼
                                                    Canvas Game (PRGB Rails)
                                                    Pitch Detection ↔ Note Matching
                                                    Score / Combo / Accuracy
                                                                 │
                                              ┌──────────────────┴──────────────────┐
                                              ▼                                     ▼
                                     Solo (ranked ou não)              Dupla online (RoomModal → roomChannel)
                                     ResultPanel → Leaderboard         OnlineHud → OnlineResultPanel
```

---

## Glossário

| Termo | O que é |
|---|---|
| PRGB Amp | Motor DSP de amp modeling (preamp + cab + reverb + gate) |
| NSDF | Normalized Square Difference Function — algoritmo de pitch detection |
| Cab Sim | Cabinet Simulation — filtros que emulam alto-falantes de guitarra |
| Tone Stack | EQ de 4 bandas (Bass 110Hz, Mid 750Hz, Treble 2.8kHz, Presence 4.5kHz) |
| WaveShaper | Web Audio node para distorção não-linear (simulação de clipping não linear) |
| Acervo | Provedor externo de tablaturas (API não oficial) |
| Rails | Linhas horizontais coloridas onde notas scrollam (cada corda = 1 cor) |
| Hit Window | Janela de tolerância para acertar nota: Good de 150 ms antes a 260 ms depois da linha, Perfect de 70 ms antes a 110 ms depois |
| NoteEvent | Estrutura normalizada de uma nota: `{timeMs, string, fret, midiNote, freqHz, ...}` |
| LEGAL_VERSION | String ISO da data do texto legal aceito; salvo com cada consentimento para detectar atualizações |
| RankedRun | Sessão de jogo com pontuação enviada ao servidor (requer conta + consentimento) |
| register-part | Edge Function Supabase que devolve a contagem de notas de uma faixa já guardada no banco (semeada); nunca consulta fonte externa |
| GamePart | Tab + partId + revisionId: o que o jogo precisa para uma música |
| DuoSession | Sessão local: duas guitarras no mesmo computador, dois canais de áudio |
| Sala online | Dupla em computadores diferentes (máximo 2): cada um toca no seu, sem se ouvir, e vê só o progresso e o placar da equipe, via Realtime |

---

## Dica Final para Agentes

Se estiver em dúvida sobre qualquer aspecto do projeto, **leia os services em `src/services/`** — eles são o coração do app e estão bem documentados com comentários inline. O `ampEngine.ts` em particular é o mais complexo e sensível — altere com cuidado. Para a camada de backend, leia `src/services/backend/rankingApi.ts` e as migrations em `supabase/migrations/`.
