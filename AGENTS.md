# AGENTS.md — Guia de Colaboração para Codex, Claude, IBM Bob e Qualquer Agente AI

> **Este arquivo é o ponto de entrada universal para qualquer agente de IA que trabalhe neste repositório.**
> Leia integralmente antes de fazer qualquer alteração.

---

## Resumo do Projeto

**PRGB** = Play Real Guitar in Browser

Um app web (React + TypeScript + Vite) de prática de guitarra gratuito:
- Captura áudio da guitarra real via interface USB (Web Audio API, 48kHz, sem processamento do OS)
- Processa o som em tempo real com o motor **PRGB Amp** (amplificador + gabinete + reverb + noise gate)
- Carrega tablaturas de 1M+ músicas de um provedor externo
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
├── vite.config.ts                   # Vite config + proxies de tablaturas (dev) + plugin que gera o sw.js
├── vercel.json                      # Deploy: rewrites de tablaturas (proxy sem backend), SPA, cache
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
│   ├── vendor/nam-engine/           # Motor neural de terceiros, sem alterações: módulo, worklet e wasm (não editar)
│   │
│   ├── context/
│   │   ├── AudioSessionContext.tsx  # AudioEngine, PRGB Amp, device/canal, erros de áudio; pitch em store próprio (useLatestPitch)
│   │   ├── gameSession.ts           # Tipos de sessão de jogo: GamePart, SoloSession, DuoSession, RunSummary, RankedSubmission
│   │   ├── historyLayers.ts         # Uma entrada no histórico por camada aberta (tela e modais): o Voltar fecha a de cima
│   │   ├── legalRoute.ts            # Roteamento por hash (#privacidade / #termos) sem biblioteca de router
│   │   ├── localData.ts             # Exportar/apagar dados locais (records + prefs); flag de sessão de ranking
│   │   ├── ModalsContext.tsx        # Estado aberto/fechado dos modais
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
│   │   ├── ChallengeCard.tsx        # Card de desafio (melhor score pessoal de um amigo)
│   │   ├── ChallengeSharePanel.tsx  # Painel para compartilhar/aceitar desafio via link
│   │   ├── DeleteAccountConfirm.tsx # Confirmação de exclusão de conta de ranking
│   │   ├── DuoSetupModal.tsx        # Modal de configuração da sessão duo (duas guitarras)
│   │   ├── ErrorNotice.tsx          # Aviso de erro dispensável com ação (role="alert")
│   │   ├── FreePlay.tsx             # Play Free: só escuta a guitarra e mostra as notas, sem música nem pontos
│   │   ├── GameHud.tsx              # HUD do jogo: score, combo, accuracy, indicadores de run ranqueado
│   │   ├── GameMoreSheet.tsx        # Folha "Mais" do jogo no celular; em telas largas só repassa os controles
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
│   │   └── AmpRack.tsx      # Modal: rack completo do amp modeler
│   │
│   ├── services/                    # Cada service tem um *.test.ts (Vitest) ao lado
│   │   ├── audioEngine.ts           # Captura, channel routing, pitch (NSDF), corda/casa estimadas, fila start/stop com fade
│   │   ├── audioOutput.ts           # Saída: AudioContext.setSinkId (Chromium) ou <audio> com setSinkId (Firefox)
│   │   ├── neuralAmp.ts             # Validação e nível dos modelos .nam (o motor vem de src/vendor, sob demanda)
│   │   ├── audioDevices.ts          # Escolha da entrada, nível, saída e teste de retorno (lógica pura)
│   │   ├── challenge.ts             # Geração e validação de links de desafio (score pessoal codificado em URL)
│   │   ├── demoSong.ts              # Exercício original offline (pentatônica de Lá menor), sem direitos de terceiros
│   │   ├── nickname.ts              # Validação, normalização e filtro de apelidos (look-alikes, blocklist, NFKD)
│   │   ├── noteTrail.ts             # Histórico das notas tocadas no Play Free (lógica pura)
│   │   ├── records.ts               # Recordes pessoais locais: armazenamento, consulta e exportação (localStorage)
│   │   ├── scoring.ts               # Motor de scoring: judgeNote, acumulação de estado, multiplier, accuracy
│   │   ├── tabsApi.ts               # API client + normalizer (cordas 0-indexed no JSON bruto, ties, grace, técnicas, beatGrid)
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
│   │   └── 20261030150000_feedback.sql       # Relatos da caixa "Reportar problema" (RPC, limite, retenção de 180 dias)
│   ├── functions/
│   │   ├── _shared/
│   │   │   ├── scoreLimits.ts       # countScorableNotes / maxPossibleScore (shared entre Edge Function e app)
│   │   │   └── tabNormalizer.ts     # Parser de tab (reutilizado no register-part)
│   │   └── register-part/
│   │       ├── handler.ts           # Lógica pura da Edge Function register-part (testável em Vitest)
│   │       └── index.ts             # Entry point Deno: wires Supabase, rede e ALLOWED_ORIGINS
│   └── db-tests/
│       ├── harness.ts               # Utilitários de setup para testes de banco (roles, JWT, dados de seed)
│       ├── ranking.test.ts          # Testes de integração das migrations de ranking
│       ├── retention.test.ts        # Testes do purge de retenção de dados
│       ├── feedback.test.ts         # Testes da caixa de relatos: acesso, limite por hora e retenção
│       └── roomRealtime.test.ts     # Testes de integração das policies e RPCs das salas online
│
└── public/
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
4. Na Edge Function `register-part`, configurar `ALLOWED_ORIGINS` para incluir a URL de produção (`https://prgb.vercel.app`) e os ambientes de preview/local.
5. `/api/tabs/*`, `/cdn/tabs/*` e `/cdn2/tabs/*` são reescritos para o provedor de tablaturas pela própria plataforma Vercel (sem backend nosso). Funciona em produção. O CDN reserva não tem todas as tablaturas e responde 403 para as que faltam; o app só o tenta se o principal falhar.
6. **Para conferir produção, compare o conteúdo ou o hash do bundle com o log do build.** O último rewrite devolve a página do app com status 200 para quase qualquer caminho, então o status sozinho não prova nada.

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
  - superfícies `ink-950…ink-100`; primária `amp-*` (laranja "válvula"); secundária `signal-*` (ciano: notas, afinação)
  - feedback `hit` (Perfeito), `near` (Bom), `miss` (Errou); sombras `shadow-glow-amp`, `shadow-glow-signal`, `shadow-panel`
  - fontes `font-display` (Space Grotesk, títulos), `font-sans` (Inter), `font-mono` (JetBrains Mono, números/HUD)

### Marca
- Nome: **PRGB**. Não usar nomes de produtos de terceiros em UI, código ou comentários.
- O conteúdo vem de um provedor externo de tablaturas: o rodapé precisa manter o aviso de não afiliação, e a Política precisa continuar dizendo que ele existe e o que recebe.
- Sem nomes de artistas, músicas ou marcas em chamadas, exemplos, presets e textos do site: nomes de terceiros só aparecem nos resultados que o jogador buscar.
- Alegações só com prova: nada de números de acervo, "baixa latência" ou "válvulas". O PRGB Amp é um simulador.
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
- [x] **Edge Function register-part** — conta notas do lado do servidor para limitar scores; `supabase/functions/register-part/` (@claude)
- [x] **LGPD** — `src/content/legal.ts`, `src/context/localData.ts`, `src/context/legalRoute.ts`, `src/components/LegalPage.tsx`, `src/components/LocalDataControls.tsx`, `src/components/DeleteAccountConfirm.tsx` (@claude/@codex)
- [x] **Desafios** — `src/services/challenge.ts`, `src/components/ChallengeCard.tsx`, `src/components/ChallengeSharePanel.tsx` (@claude/@codex)

### Rodada 5 — dupla online (concluída, em `main`)
- [x] **Serviço das salas** — `src/services/backend/roomChannel.ts`, migrations `room_realtime` e `room_data_export`; testado no Supabase real por script, com duas contas: vagas, canal privado, presença, mensagens e saída do anfitrião (@codex, @claude)
- [x] **Interface da dupla online** — `RoomModal`, `RoomProvider`, `room.ts` (estado puro, com testes), `OnlinePracticeGame`, `OnlineHud`, `OnlineResultPanel`: lobby, escolha de faixa, início no mesmo relógio, placar da equipe e revanche. Partida online nunca vale para o ranking (@bob, revisada e corrigida por @claude; testada no Supabase real com dois navegadores e microfone sintético)
- [ ] **Alinhar histórico de migrations** — a migration `room_realtime` foi aplicada manualmente pelo SQL Editor fora do histórico do CLI Supabase; precisa reconciliar antes do próximo `supabase db push` (@claude)

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
- [x] **Menu e abas** — Tocar, Músicas, Modos, Áudio e Ranking sempre à mão; o estado do áudio é um botão que abre o painel. Abaixo de 1024 px vira barra de abas (@claude; testado em 320, 390, 768, 1024 e 1440 px)
- [x] **Landing** — duas ações no topo, modos e preparo da guitarra logo abaixo, aviso de armazenamento no fluxo da página, sem cobrir botões (@claude)
- [x] **Botão Voltar do navegador** — cada camada aberta (jogo, dupla, sala, Play Free e cada modal) tem entrada própria no histórico, criada ao abrir; Voltar fecha a de cima, uma por vez, em vez de sair do site. Nunca crie entrada em reação ao Voltar: o Chromium pula entradas sem gesto do usuário. Título da aba por tela (@claude; testado no Edge e no Firefox, sala online só por leitura do código)
- [x] **Continuar** — quem volta ao site vê a landing com um cartão da última música, em vez de cair direto no jogo. Abrir o site não chama mais o provedor de tablaturas (@claude)
- [x] **Ranking visível** — o menu abre o placar do exercício, sem conta (@claude)
- [x] **Painel de Áudio** — diagnóstico primeiro, duas colunas, ajustes avançados recolhidos (@claude; testado com microfone sintético, não com a interface real)
- [x] **Jogo e Play Free no celular** — sem rolagem lateral, folha "Mais", seta de voltar e pista com pelo menos 45% da tela (@codex, revisado por @claude)
- [x] **Bundle sem metadados do deploy** — a leitura dinâmica de `import.meta.env` publicava todas as variáveis `VITE_` do build, inclusive as da Vercel; um teste barra a volta dela (@claude)

### Pendências conhecidas (sem dono)
- [ ] **Permissão do provedor de tablaturas** — os termos dele proíbem transmitir, reutilizar e baixar o conteúdo sem autorização escrita. É o maior risco legal do projeto; depende de decisão do humano.
- [ ] **Dupla online com guitarras de verdade** — testada de ponta a ponta no Supabase real com dois navegadores, contas temporárias e microfone sintético (partida, revanche com troca de música, queda e volta, saída do anfitrião, exportação e exclusão de conta) e o ranking com uma partida real aceita pelo servidor, mas nunca por duas pessoas com guitarra. Falta também o caso de sala cheia (`room_full`), que exige uma terceira conta.
- [ ] **Revisões diferentes da mesma faixa na dupla** — o convidado carrega a revisão atual da tab, sem conferir a anunciada pelo anfitrião. Decisão: não corrigir por ora; é raro e a partida não vale para o ranking.
- [ ] **Teste com interface de áudio real** — o humano ouviu a guitarra no Firefox com a rota nova, antes das correções finais. Falta validar a versão publicada, a latência, clicks na troca de device, afinador e scoring tocando de verdade, e um arquivo `.nam` real.
- [ ] **`setCurrentTimeMs` a cada frame** — o `PracticeGame` ainda re-renderiza ~60×/s enquanto toca (posição da música em state). Mover para ref exige mexer no scoring; deixado de fora para não alterar comportamento.
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
| WaveShaper | Web Audio node para distorção não-linear (emulação de clipping de válvula) |
| Acervo | Provedor externo de tablaturas (API não oficial) |
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

Se estiver em dúvida sobre qualquer aspecto do projeto, **leia os services em `src/services/`** — eles são o coração do app e estão bem documentados com comentários inline. O `ampEngine.ts` em particular é o mais complexo e sensível — altere com cuidado. Para a camada de backend, leia `src/services/backend/rankingApi.ts` e as migrations em `supabase/migrations/`.
