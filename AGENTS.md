# AGENTS.md — Guia de Colaboração para Codex, Claude, IBM Bob e Qualquer Agente AI

> **Este arquivo é o ponto de entrada universal para qualquer agente de IA que trabalhe neste repositório.**
> Leia integralmente antes de fazer qualquer alteração.

---

## Resumo do Projeto

**PRGB** = Play Real Guitar in Browser

Um app web (React + TypeScript + Vite) de prática de guitarra open-source e gratuito:
- Captura áudio da guitarra real via interface USB (Web Audio API, 48kHz, sem processamento do OS)
- Processa o som em tempo real com o motor **TONE3000** (amplificador + gabinete + reverb + noise gate)
- Carrega tablaturas de 1M+ músicas da API do Songsterr
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

**Requisitos:** Node 20+, navegador moderno com Web Audio API.

---

## Mapa de Arquivos

```
PRGB/
├── index.html                       # HTML shell: título, meta/Open Graph, fontes locais (public/fonts)
├── vite.config.ts                   # Vite config + proxies Songsterr (dev) + plugin que gera o sw.js
├── vercel.json                      # Deploy: rewrites do Songsterr (proxy sem backend), SPA, cache
├── package.json                     # Dependencies & scripts
├── tsconfig.app.json                # TypeScript config (strict, ES2023, bundler mode)
├── .oxlintrc.json                   # oxlint config (react + typescript plugins)
│
├── src/
│   ├── main.tsx                     # React entry point
│   ├── App.tsx                      # Root component: landing de produto + troca para o jogo
│   ├── index.css                    # Tailwind 4 + tokens de design PRGB (@theme) + reset global
│   ├── vite-env.d.ts                # Tipos de import.meta.env (VITE_SUPPORT_URL, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
│   │
│   ├── content/
│   │   └── legal.ts                 # Cópia legal (LGPD): Política de Privacidade, Termos de Uso, LEGAL_VERSION, ConsentCopy
│   │
│   ├── context/
│   │   ├── AudioSessionContext.tsx  # AudioEngine, TONE3000, device/canal, erros de áudio; pitch em store próprio (useLatestPitch)
│   │   ├── gameSession.ts           # Tipos de sessão de jogo: GamePart, SoloSession, DuoSession, RunSummary, RankedSubmission
│   │   ├── legalRoute.ts            # Roteamento por hash (#privacidade / #termos) sem biblioteca de router
│   │   ├── localData.ts             # Exportar/apagar dados locais (records + prefs); flag de sessão de ranking
│   │   ├── ModalsContext.tsx        # Estado aberto/fechado dos modais
│   │   ├── preferences.ts           # localStorage versionado (prgb:prefs:v1): device, canal, TONE3000, última música
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
│   │   ├── BrandMark.tsx            # Logo PRGB (palheta) + wordmark
│   │   ├── ChallengeCard.tsx        # Card de desafio (melhor score pessoal de um amigo)
│   │   ├── ChallengeSharePanel.tsx  # Painel para compartilhar/aceitar desafio via link
│   │   ├── DeleteAccountConfirm.tsx # Confirmação de exclusão de conta de ranking
│   │   ├── DuoSetupModal.tsx        # Modal de configuração da sessão duo (duas guitarras)
│   │   ├── ErrorNotice.tsx          # Aviso de erro dispensável com ação (role="alert")
│   │   ├── GameHud.tsx              # HUD do jogo: score, combo, accuracy, indicadores de run ranqueado
│   │   ├── LeaderboardModal.tsx     # Modal do placar online (semanal + all-time)
│   │   ├── LegalPage.tsx            # Renderizador das páginas legais (Privacidade / Termos)
│   │   ├── LocalDataControls.tsx    # Controles de exportar/apagar dados locais e sessão de ranking
│   │   ├── LocalRecords.tsx         # Histórico de recordes locais do jogador
│   │   ├── ModalFrame.tsx           # Wrapper genérico de modal (foco, fechar com Esc, overlay)
│   │   ├── OnlineHud.tsx            # Faixa do parceiro e da equipe durante a dupla online
│   │   ├── OnlinePracticeGame.tsx   # PracticeGame da dupla online: contagem, progresso e resultado
│   │   ├── OnlineResultPanel.tsx    # Resultado da dupla: pontos, equipe, vitória ou empate
│   │   ├── RoomModal.tsx            # Modal da dupla online: criar/entrar, lobby, faixa, pronto e início
│   │   ├── PracticeGame.tsx         # Canvas game: rails (camada estática em cache, DPR), notas, scoring, metrônomo
│   │   ├── RankingAccountModal.tsx  # Modal de gerenciamento de conta do ranking (apelido, dados, excluir)
│   │   ├── RankingEntryModal.tsx    # Modal de entrada no ranking (consentimento 18+, criar/atualizar perfil)
│   │   ├── RankingModals.tsx        # Orquestrador dos modais de ranking (entry, account, leaderboard)
│   │   ├── ResultPanel.tsx          # Painel de resultado após o fim de uma música
│   │   ├── SongSearchModal.tsx      # Modal: busca Songsterr + seleção de faixa
│   │   └── Tone3000AmpRack.tsx      # Modal: rack completo do amp modeler
│   │
│   ├── services/                    # Cada service tem um *.test.ts (Vitest) ao lado
│   │   ├── audioEngine.ts           # Captura, channel routing, pitch (NSDF), corda/casa estimadas, fila start/stop com fade
│   │   ├── challenge.ts             # Geração e validação de links de desafio (score pessoal codificado em URL)
│   │   ├── demoSong.ts              # Exercício original offline (pentatônica de Lá menor), sem direitos de terceiros
│   │   ├── nickname.ts              # Validação, normalização e filtro de apelidos (look-alikes, blocklist, NFKD)
│   │   ├── records.ts               # Recordes pessoais locais: armazenamento, consulta e exportação (localStorage)
│   │   ├── scoring.ts               # Motor de scoring: judgeNote, acumulação de estado, multiplier, accuracy
│   │   ├── songsterrApi.ts          # API client + normalizer (cordas 0-indexed no JSON bruto, ties, grace, técnicas, beatGrid)
│   │   ├── synthAudio.ts            # SFX + MetronomeScheduler (cliques agendados no relógio do AudioContext)
│   │   ├── tone3000Amp.ts           # DSP chain: preamp→waveshaper→EQ→cab→reverb→output
│   │   └── backend/
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
│   │   └── 20261030120000_room_data_export.sql # Exportação de dados de sala (LGPD)
│   ├── functions/
│   │   ├── _shared/
│   │   │   ├── scoreLimits.ts       # countScorableNotes / maxPossibleScore (shared entre Edge Function e app)
│   │   │   └── tabNormalizer.ts     # Parser de tab do Songsterr (reutilizado no register-part)
│   │   └── register-part/
│   │       ├── handler.ts           # Lógica pura da Edge Function register-part (testável em Vitest)
│   │       └── index.ts             # Entry point Deno: wires Supabase, rede e ALLOWED_ORIGINS
│   └── db-tests/
│       ├── harness.ts               # Utilitários de setup para testes de banco (roles, JWT, dados de seed)
│       ├── ranking.test.ts          # Testes de integração das migrations de ranking
│       ├── retention.test.ts        # Testes do purge de retenção de dados
│       └── roomRealtime.test.ts     # Testes de integração das policies e RPCs das salas online
│
└── public/
    ├── favicon.svg                  # Logo (palheta laranja com onda de sinal)
    ├── fonts/                       # Fontes locais (Inter, Space Grotesk, JetBrains Mono — woff2)
    ├── icons/                       # Ícones PNG do app (192, 512, maskable)
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
- **Songsterr API** (reverse-engineered, proxied via Vite dev server e rewrites da Vercel)
- **Supabase** (`@supabase/supabase-js`, carregado sob demanda — só ao abrir o ranking ou a sala online)

---

## Deploy (Vercel)

1. Importar o repositório no Vercel (framework Vite; `vercel.json` já define build, saída `dist` e rewrites).
2. Variáveis de ambiente obrigatórias para ranking e salas online (deixar em branco para desativar):
   - `VITE_SUPABASE_URL` — URL pública do projeto Supabase (prefixo `VITE_` é seguro; nunca expor a `service_role key`)
   - `VITE_SUPABASE_ANON_KEY` — chave pública `anon` do Supabase (prefixo `VITE_` é seguro; nunca a `service_role key`)
3. Opcional: `VITE_SUPPORT_URL` com o link de apoio (Ko-fi, Pix, GitHub Sponsors...).
4. Na Edge Function `register-part`, configurar `ALLOWED_ORIGINS` para incluir a URL de produção (`https://prgb.vercel.app`) e os ambientes de preview/local.
5. `/api/songsterr/*`, `/cdn/songsterr/*` e `/cdn2/songsterr/*` são reescritos para o Songsterr pela própria plataforma Vercel (sem backend nosso). Funciona em produção.

---

## Cadeia de Processamento de Áudio

```
Guitarra → USB Interface → getUserMedia(48kHz, raw, sem noise suppress)
                                │
                        ChannelSplitter (L/R/Mono)
                                │
                ┌───────────────┼───────────────┐
                ▼                               ▼
         AnalyserNode                     TONE3000 Engine
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
- Classes para services (`AudioEngine`, `Tone3000AmpEngine`, `SongsterrApi`)
- `React.FC<Props>` para componentes
- `export interface` para tipos (não `type` para objetos complexos)
- Variáveis/funções em **inglês**, UI em **Português Brasileiro (pt-BR)**

### Styling
- Tailwind CSS 4 exclusivo — sem CSS-in-JS, sem CSS Modules, sem styled-components
- Use **só os tokens PRGB** de `src/index.css` (nada de `slate`/`cyan`/`rose` crus):
  - superfícies `ink-950…ink-100`; primária `amp-*` (laranja "válvula"); secundária `signal-*` (ciano: notas, afinação)
  - feedback `hit` (Perfeito), `near` (Bom), `miss` (Errou); sombras `shadow-glow-amp`, `shadow-glow-signal`, `shadow-panel`
  - fontes `font-display` (Space Grotesk, títulos), `font-sans` (Inter), `font-mono` (JetBrains Mono, números/HUD)

### Marca
- Nome: **PRGB**. Não usar nomes de produtos de terceiros (ex.: Yousician) em UI, código ou comentários.
- O conteúdo vem do Songsterr: o rodapé precisa manter o aviso de não afiliação.
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
6. **Não alterar os proxies Vite** (`/api/songsterr`, `/cdn/songsterr`, `/cdn2/songsterr`) sem entender o CORS routing.
7. **Não usar `setTimeout`/`setInterval`** para timing de áudio — usar `AudioContext.currentTime`.
8. **Não manipular DOM diretamente** — usar React refs.
9. **Não usar CSS inline** (`style={{}}`) exceto para valores dinâmicos calculados.
10. **Não remover ou refatorar o TONE3000** sem entender a cadeia DSP completa documentada acima.
11. **LGPD por padrão.** Dados mínimos (só o apelido é dado pessoal); nenhuma conta antes do consentimento (18+ autodeclarado + aceite com `LEGAL_VERSION` versionado); tabelas sem acesso direto (só RPC `security definer` com `search_path=''`); exportar, corrigir e excluir sempre disponíveis; retenção definida nas migrations; qualquer dado novo exige atualizar `src/content/legal.ts`.
12. **`VITE_SUPABASE_ANON_KEY` e `VITE_SUPABASE_URL` são as únicas chaves Supabase com prefixo `VITE_`.** Nunca expor a `service_role key` com prefixo `VITE_` — ela daria acesso total ao banco ao cliente.

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
4. **Sem sobreposição de arquivos.** Dois agentes não editam o mesmo arquivo ao mesmo tempo. `tone3000Amp.ts`, `audioEngine.ts` e `App.tsx` ficam com um agente por vez.
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
- [x] **Build quebrado** — tipos `Float32Array<ArrayBuffer>` em `tone3000Amp.ts` + imports não usados (@claude, `bb447da`, aprovado por @codex)
- [x] **Canvas não responsivo** — ResizeObserver em `YousicianGame.tsx`, hoje `PracticeGame.tsx` (@codex, `77d100c`, aprovado por @claude)
- [x] **Estado monolítico** — `AudioSessionContext` + `ModalsContext` (@codex, `77d100c`, aprovado por @claude)
- [x] **TONE3000 recriada a cada reconexão** — AudioContext e amp reaproveitados entre `start()` (@codex, `77d100c`, aprovado por @claude; não testado com interface real)

### Rodada 2 — fundação de áudio e parser (concluída, merge em `main` 1a77f10)
- [x] **Pitch detection incompleta** — `stringEstimate`/`fretEstimate` (posição de casa mais baixa, `setTuning`), fade de ganho na reconexão, fila start/stop, fallback de device (@claude, aprovado por @codex)
- [x] **Parser de tabs** — **bug grave corrigido**: cordas do JSON bruto do Songsterr são 0-indexed (todas as notas saíam uma corda acima); ties, grace notes, dead/ghost/tapping/harmonic/bend (@claude, aprovado por @codex)
- [x] **Sem persistência** — `preferences.ts` (@codex, aprovado por @claude)
- [x] **Performance do Canvas** — camada estática em OffscreenCanvas, Path2D, DPR, pitch fora do render do React (@codex, aprovado por @claude)

### Rodada 3 — metrônomo, testes e PWA (concluída, merge em `main` 058b7fc)
- [x] **Integração dos novos campos** — tuning da tab no pitch, device efetivo persistido, dead/grace/ghost sem penalidade, bend aceita base ou alvo (@codex, aprovado por @claude)
- [x] **Sem tratamento de erros na UI** — `ErrorNotice` + `uiErrors.ts` (@codex, aprovado por @claude)
- [x] **Metrônomo impreciso** — `beatGrid` (compasso + mudanças de tempo) e `MetronomeScheduler` no relógio do AudioContext; `initialBpm` corrigido (@claude; a revisão de @codex achou 4 bugs — primeiro clique, contexto suspenso, anacruse, retomada — corrigidos com testes e aprovados)
- [x] **Sem testes** — Vitest nos services; cada correção tem teste que falha no código anterior (@claude)
- [x] **Sem PWA/offline** — manifest + service worker do app shell gerado no build; Songsterr nunca vai para o cache (@codex, aprovado por @claude; não testado offline num navegador real)

### Rodada 4 — ranking Supabase (concluída em `claude/fase2-base`, sem merge em `main`)
- [x] **Ranking online** — `supabase/migrations/` (ranking, retention, reaccept_terms), `src/services/backend/rankingApi.ts`, `src/services/backend/supabaseClient.ts`, `src/services/scoring.ts`, `src/services/records.ts`, `src/services/nickname.ts`, `src/context/rankedRun.ts`, `src/context/ranking.ts`, `src/context/RankingProvider.tsx`, componentes de ranking (@claude/@codex)
- [x] **Edge Function register-part** — conta notas do lado do servidor para limitar scores; `supabase/functions/register-part/` (@claude)
- [x] **LGPD** — `src/content/legal.ts`, `src/context/localData.ts`, `src/context/legalRoute.ts`, `src/components/LegalPage.tsx`, `src/components/LocalDataControls.tsx`, `src/components/DeleteAccountConfirm.tsx` (@claude/@codex)
- [x] **Desafios** — `src/services/challenge.ts`, `src/components/ChallengeCard.tsx`, `src/components/ChallengeSharePanel.tsx` (@claude/@codex)

### Rodada 5 — dupla online (concluída em `claude/fase2-base`, sem merge em `main`)
- [x] **Serviço das salas** — `src/services/backend/roomChannel.ts`, migrations `room_realtime` e `room_data_export`; testado no Supabase real por script, com duas contas: vagas, canal privado, presença, mensagens e saída do anfitrião (@codex, @claude)
- [x] **Interface da dupla online** — `RoomModal`, `RoomProvider`, `room.ts` (estado puro, com testes), `OnlinePracticeGame`, `OnlineHud`, `OnlineResultPanel`: lobby, escolha de faixa, início no mesmo relógio, placar da equipe e revanche. Partida online nunca vale para o ranking (@bob, revisada e corrigida por @claude; testada no Supabase real com dois navegadores e microfone sintético)
- [ ] **Alinhar histórico de migrations** — a migration `room_realtime` foi aplicada manualmente pelo SQL Editor fora do histórico do CLI Supabase; precisa reconciliar antes do próximo `supabase db push` (@claude)

### Pendências conhecidas (sem dono)
- [ ] **Dupla online com guitarras de verdade** — testada de ponta a ponta no Supabase real com dois navegadores, contas temporárias e microfone sintético (partida, revanche com troca de música, queda e volta, saída do anfitrião, exportação e exclusão de conta) e o ranking com uma partida real aceita pelo servidor, mas nunca por duas pessoas com guitarra. Falta também o caso de sala cheia (`room_full`), que exige uma terceira conta.
- [ ] **Revisões diferentes da mesma faixa na dupla** — o convidado carrega a revisão atual da tab, sem conferir a anunciada pelo anfitrião. Decisão: não corrigir por ora; é raro e a partida não vale para o ranking.
- [ ] **Teste com interface de áudio real e no navegador** — nada disso foi validado por humano: latência, clicks na troca de device, afinador, scoring tocando de verdade.
- [ ] **`setCurrentTimeMs` a cada frame** — o `PracticeGame` ainda re-renderiza ~60×/s enquanto toca (posição da música em state). Mover para ref exige mexer no scoring; deixado de fora para não alterar comportamento.
- [ ] **Sem router** — SPA sem rotas; se crescer, avaliar react-router.

### Concluídos
- [x] **App.css é lixo** — removido
- [x] **Assets legados** — `src/assets/` removido
- [x] **Songsterr em produção** — proxy funciona via rewrites da Vercel (`/api/songsterr/*`, `/cdn/songsterr/*`, `/cdn2/songsterr/*`); validado em produção.

---

## Fluxo do Usuário

```
Landing Page → Clica "Tocar" ou "Buscar" → getUserMedia() → TONE3000 Ativo
    │                                                            │
    ▼                                                            ▼
  Songsterr Search → Seleciona Música → Download Tab JSON → Parse para NoteEvent[]
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
| TONE3000 | Motor DSP custom de amp modeling (preamp + cab + reverb + gate) |
| NSDF | Normalized Square Difference Function — algoritmo de pitch detection |
| Cab Sim | Cabinet Simulation — filtros que emulam alto-falantes de guitarra |
| Tone Stack | EQ de 4 bandas (Bass 110Hz, Mid 750Hz, Treble 2.8kHz, Presence 4.5kHz) |
| WaveShaper | Web Audio node para distorção não-linear (emulação de clipping de válvula) |
| Songsterr | Plataforma de tablaturas online (API usada via reverse engineering) |
| Rails | Linhas horizontais coloridas onde notas scrollam (cada corda = 1 cor) |
| Hit Window | Janela de tolerância para acertar nota: ±130ms Good, ±55ms Perfect |
| NoteEvent | Estrutura normalizada de uma nota: `{timeMs, string, fret, midiNote, freqHz, ...}` |
| LEGAL_VERSION | String ISO da data do texto legal aceito; salvo com cada consentimento para detectar atualizações |
| RankedRun | Sessão de jogo com pontuação enviada ao servidor (requer conta + consentimento) |
| register-part | Edge Function Supabase que conta notas do lado do servidor para validar scores |
| GamePart | Tab + partId + revisionId: o que o jogo precisa para uma música |
| DuoSession | Sessão local: duas guitarras no mesmo computador, dois canais de áudio |
| Sala online | Dupla em computadores diferentes (máximo 2): cada um toca no seu, sem se ouvir, e vê só o progresso e o placar da equipe, via Realtime |

---

## Dica Final para Agentes

Se estiver em dúvida sobre qualquer aspecto do projeto, **leia os services em `src/services/`** — eles são o coração do app e estão bem documentados com comentários inline. O `tone3000Amp.ts` em particular é o mais complexo e sensível — altere com cuidado. Para a camada de backend, leia `src/services/backend/rankingApi.ts` e as migrations em `supabase/migrations/`.
