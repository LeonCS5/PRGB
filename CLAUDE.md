# CLAUDE.md — Guia de Colaboração do Projeto PRGB

> **Leia este arquivo inteiro antes de fazer qualquer alteração no projeto.**
> Este é o documento raiz de contexto para Claude Code, Claude em IDEs, e qualquer agente baseado em Claude.
>
> **Fonte única de regras, backlog e protocolo de colaboração com o Codex: `AGENTS.md`** (importado abaixo). Em caso de conflito, o `AGENTS.md` vale.

@AGENTS.md

---

## 1. Visão Geral do Projeto

**PRGB** (Play Real Guitar in Browser) é um aplicativo web gratuito de prática de guitarra que permite ao usuário:

1. **Conectar sua guitarra real** via interface de áudio USB
2. **Ouvir o som processado** em tempo real pelo motor DSP **PRGB Amp** (simulador de amplificador, gabinete, noise gate, reverb)
3. **Tocar junto com tablaturas** baixadas de um provedor externo (1M+ músicas), com detecção de pitch e gamificação (score, combo, acertos Perfect/Good/Miss)

**Sem servidor próprio.** O jogo roda 100% no navegador (todo o áudio via Web Audio API, nunca enviado); ranking e salas online, opcionais e só com consentimento 18+, usam Supabase gerenciado (Auth anônimo, RPC security definer, Edge Function, Realtime — região São Paulo). Regras em AGENTS.md › Regras INVIOLÁVEIS 1 e 11.

---

## 2. Stack Tecnológica

| Camada | Tecnologia | Versão |
|---|---|---|
| Framework | React | 19.x |
| Linguagem | TypeScript | 6.x |
| Bundler | Vite | 8.x |
| Styling | Tailwind CSS | 4.x (via `@tailwindcss/vite`) |
| Ícones | lucide-react | 1.x |
| Linter | oxlint | 1.x |
| Áudio | Web Audio API (nativo do browser) | — |
| Dados | API de tablaturas (não oficial, via proxy Vite) | — |

### Comandos do projeto

```bash
npm run dev      # Inicia dev server (Vite, porta 5173)
npm run build    # Build de produção (tsc + vite build)
npm run lint     # oxlint (sem eslint)
npm test         # Vitest (testes dos services)
npm run preview  # Preview da build de produção
```

---

## 3. Estrutura do Código-Fonte

```
src/
├── main.tsx                         # Entry point React (StrictMode)
├── App.tsx                          # Componente raiz: landing de produto + troca para o jogo
├── index.css                        # Tailwind + tokens de design PRGB (@theme) + reset global
├── vite-env.d.ts                    # Tipos de import.meta.env (VITE_SUPPORT_URL, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
│
├── content/
│   └── legal.ts                     # Cópia legal (LGPD): Política de Privacidade, Termos, LEGAL_VERSION
│
├── context/
│   ├── AudioSessionContext.tsx      # AudioEngine, PRGB Amp, device/canal, erros; pitch via useLatestPitch
│   ├── gameSession.ts               # Tipos de sessão de jogo (GamePart, SoloSession, DuoSession, RunSummary)
│   ├── historyLayers.ts             # Uma entrada no histórico por camada aberta: o Voltar fecha a de cima
│   ├── legalRoute.ts                # Roteamento por hash (#privacidade / #termos) sem router library
│   ├── localData.ts                 # Exportar/apagar dados locais; flag de sessão de ranking
│   ├── ModalsContext.tsx            # Estado aberto/fechado dos modais
│   ├── preferences.ts               # Persistência em localStorage (prgb:prefs:v1)
│   ├── rankedRun.ts                 # RankedRunController: máquina de estados de um run ranqueado
│   ├── ranking.ts                   # RankingContext, RankingApi type, RankingValue
│   ├── RankingProvider.tsx          # Provider do contexto de ranking
│   ├── room.ts                      # Estado puro da sala online e RoomController (sem React)
│   ├── RoomProvider.tsx             # Provider da sala online
│   ├── uiErrors.ts                  # Mensagens de erro pt-BR + carga/validação de tabs
│   ├── useRankedRun.ts              # Hook React para RankedRunController
│   └── useRoom.ts                   # Contexto e hook da sala online
│
├── components/
│   ├── PracticeGame.tsx             # ⭐ Canvas game principal (rails de notas, scoring, metrônomo)
│   ├── AudioSettingsModal.tsx       # Modal de configuração de interface de áudio + afinador
│   ├── BrandMark.tsx                # Logo PRGB
│   ├── CaptchaField.tsx             # Verificação contra robôs na entrada do ranking
│   ├── ChallengeCard.tsx / ChallengeSharePanel.tsx  # Desafios entre jogadores
│   ├── DeleteAccountConfirm.tsx     # Confirmação de exclusão de conta
│   ├── DuoSetupModal.tsx            # Configuração de sessão duo (duas guitarras)
│   ├── ErrorNotice.tsx              # Aviso de erro dispensável com ação
│   ├── ExerciseLibrary.tsx          # Tela de exercícios: categorias, tom, jeito de tocar e cartões
│   ├── FreePlay.tsx                 # Play Free: só escuta a guitarra e mostra as notas
│   ├── GameHud.tsx                  # HUD do jogo: score, combo, accuracy, run ranqueado
│   ├── GameMoreSheet.tsx            # Folha "Mais" do jogo no celular
│   ├── LatencyTest.tsx              # Teste de latência: mede o atraso e salva o ajuste da pontuação
│   ├── LeaderboardModal.tsx         # Placar online (semanal + all-time)
│   ├── LegalPage.tsx                # Páginas legais (Privacidade / Termos)
│   ├── LocalDataControls.tsx / LocalRecords.tsx  # Dados locais e histórico de recordes
│   ├── ModalFrame.tsx               # Wrapper genérico de modal
│   ├── OnlineHud.tsx                # Faixa do parceiro e da equipe durante a dupla online
│   ├── OnlinePracticeGame.tsx       # PracticeGame da dupla online
│   ├── OnlineResultPanel.tsx        # Resultado da dupla
│   ├── RoomModal.tsx                # Modal da dupla online: criar/entrar, lobby e início
│   ├── RankingAccountModal.tsx / RankingEntryModal.tsx / RankingModals.tsx  # Modais de ranking
│   ├── ResultPanel.tsx              # Painel de resultado após a música
│   ├── SiteNav.tsx                  # Menu superior, estado do áudio e barra de abas do celular
│   ├── SongSearchModal.tsx          # Modal de busca de músicas no acervo
│   └── AmpRack.tsx          # Modal do rack completo do amp modeler PRGB Amp
│
├── services/
│   ├── audioOutput.ts               # Saída de áudio: direta no Chromium, por <audio> no Firefox
│   ├── audioEngine.ts               # ⭐ Engine de captura de áudio + detecção de pitch (NSDF/MPM)
│   ├── challenge.ts                 # Links de desafio (score pessoal codificado em URL)
│   ├── demoSong.ts                  # Exercício original offline (sem rede, sem direitos de terceiros)
│   ├── exerciseIds.ts               # Ids dos exercícios (nunca renumerar)
│   ├── exercises.ts                 # Catálogo de exercícios gerado por regras de teoria
│   ├── musicTheory.ts               # Escalas, posições no braço e formas de acorde
│   ├── latencyTest.ts               # Lógica do teste de latência (pura)
│   ├── nickname.ts                  # Validação, normalização e filtro de apelidos
│   ├── noteTrail.ts                 # Histórico das notas tocadas no Play Free (lógica pura)
│   ├── records.ts                   # Recordes pessoais locais (localStorage)
│   ├── scoring.ts                   # Motor de scoring: judgeNote, multiplier, accuracy
│   ├── tabsApi.ts                   # Client da API de tablaturas: busca, meta, download de tabs, normalização
│   ├── turnstile.ts                 # CAPTCHA da Cloudflare, carregado sob demanda
│   ├── synthAudio.ts                # Sintetizador de notas, MetronomeScheduler e efeitos sonoros do jogo
│   ├── ampEngine.ts               # ⭐ DSP engine: preamp, waveshaper, tone stack, cab sim, reverb
│   ├── *.test.ts                    # Testes Vitest de cada service
│   └── backend/
│       ├── rankingApi.ts            # RPCs do ranking (createProfile, submitScore, getLeaderboard, etc.)
│       ├── roomChannel.ts           # Salas online via Supabase Realtime
│       └── supabaseClient.ts        # Cliente Supabase lazy; lê VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
│
supabase/
├── migrations/                      # Migrations SQL (ranking, retention, reaccept_terms, room_realtime, room_data_export, feedback)
├── functions/register-part/         # Edge Function: conta notas do lado do servidor
├── functions/_shared/               # scoreLimits.ts, tabNormalizer.ts (shared com o app)
└── db-tests/                        # Testes de integração das migrations (Vitest)

public/
├── favicon.svg                      # Logo PRGB
├── fonts/                           # Fontes locais (Inter, Space Grotesk, JetBrains Mono — woff2)
├── nam/                             # Avisos de licença do motor neural (o motor fica em src/vendor/nam-engine)
├── icons/, og-image.png             # Ícones do app e imagem de compartilhamento
├── manifest.webmanifest, sw.js      # PWA
vercel.json                          # Deploy com rewrites de tablaturas (ver AGENTS.md › Deploy)
```

### Proxies Vite (vite.config.ts)

O Vite faz proxy reverso para acessar a API de tablaturas sem CORS:

- `/api/tabs/*` → API do provedor
- `/cdn/tabs/*` → CDN de tablaturas JSON
- `/cdn2/tabs/*` → CDN alternativo

Em produção esses mesmos caminhos são reescritos pelo `vercel.json`.

---

## 4. Arquitetura de Áudio (Cadeia DSP)

```
Guitarra → Interface USB → getUserMedia(48kHz RAW) → ChannelSplitter
    │                                                      │
    │                                              ┌── Canal 1 (L)
    │                                              ├── Canal 2 (R)
    │                                              └── Ambos (Mono Mix)
    │                                                      │
    ▼                                                      ▼
AnalyserNode ← Merger ← (Channel selecionado)      PRGB Amp Input
    │                                                      │
    ▼                                               ┌──────┴──────┐
 Pitch Detection (NSDF)                        Noise Gate    PreGain
    │                                               │          │
    ▼                                               ▼          ▼
 PracticeGame (hit matching)                 WaveShaper (Tube Saturation)
                                                    │
                                          Tone Stack (Bass→Mid→Treble→Presence)
                                                    │
                                           ┌────────┴────────┐
                                        Cab Sim Chain      Cab Bypass
                                      (HP→Resonance→         │
                                       MidScoop→LP×2)        │
                                           │                  │
                                           └────────┬────────┘
                                                    │
                                              Reverb (Wet/Dry)
                                                    │
                                               Master Gain
                                                    │
                                           ctx.destination (Speakers/Headphones)
```

---

## 5. Convenções de Código

### TypeScript
- **Strict mode** habilitado (noUnusedLocals, noUnusedParameters, erasableSyntaxOnly)
- Interfaces sempre com `export interface` (não `type` para objetos com métodos)
- Classes para services (AudioEngine, AmpEngine, TabsApi)
- Componentes React: `React.FC<Props>` com arrow functions exportadas como `export const`

### Styling
- **Tailwind CSS 4.x** via plugin Vite (sem `tailwind.config.js`, sem PostCSS)
- Import global: `@import "tailwindcss"` em `index.css`
- Tokens PRGB em `index.css` (`ink-*`, `amp-*`, `signal-*`, `hit`/`near`/`miss`, `font-display`/`font-mono`); detalhes em AGENTS.md › Convenções
- Nunca usar CSS-in-JS, styled-components, ou CSS modules

### Nomenclatura
- Componentes: PascalCase (ex: `PracticeGame.tsx`)
- Services: camelCase (ex: `audioEngine.ts`)
- Interfaces: PascalCase com prefixo descritivo (ex: `DetectedPitch`, `NormalizedSongTab`)
- IDs de notas: formato `note-{counter}` (sequencial)

### Linguagem da UI
- Toda a interface é em **Português Brasileiro** (pt-BR)
- Comentários no código podem ser em inglês ou português
- Nomes de variáveis e funções sempre em **inglês**

---

## 6. Problemas Conhecidos e Prioridades de Melhoria

O backlog fica **só** no `AGENTS.md` (seção "Problemas Conhecidos"), com dono e status de cada item. Não duplique aqui; atualize lá.

---

## 7. Regras para Agentes

### OBRIGATÓRIO
- **Nunca alterar a cadeia DSP do PRGB Amp** sem entender o signal routing completo (seção 4)
- **Nunca instalar ESLint** — o projeto usa oxlint exclusivamente
- **Nunca migrar de Tailwind CSS** para outra solução de styling
- **Nunca adicionar servidor próprio** — só Supabase gerenciado, para ranking/salas, e o jogo funciona sem ele
- **Manter toda a UI em Português Brasileiro**
- **Preservar a API de proxy do Vite** (`/api/tabs`, `/cdn/tabs`, `/cdn2/tabs`)

### RECOMENDADO
- Ao criar novos componentes, seguir o padrão `React.FC<Props>` existente
- Ao mexer no áudio, testar com uma interface de áudio real, no Chrome/Edge e no Firefox
- Ao adicionar dependências, preferir bibliotecas leves e sem dependências transitivas pesadas
- Commits devem ser atômicos e focados (1 feature ou 1 fix por commit)

### PROIBIDO
- `any` sem justificativa explícita em comentário
- `eslint-disable` ou equivalentes
- CSS inline (`style={{}}`) exceto para valores dinâmicos calculados (ex: width percentual do VU meter)
- `document.getElementById` ou manipulação direta do DOM (usar refs React)
- `setTimeout`/`setInterval` para scheduling de áudio (usar `AudioContext.currentTime`)

---

## 8. Como Rodar

```bash
# Instalar dependências (já feito se node_modules existe)
npm install

# Dev server com HMR
npm run dev
# → http://localhost:5173

# Build de produção
npm run build

# Lint
npm run lint
```

### Requisitos
- Node.js 20+
- Navegador com suporte a Web Audio API (Chrome/Edge/Firefox)
- Interface de áudio USB (para funcionalidade completa de guitarra)

---

## 9. Fluxo do Usuário

1. **Landing Page** → Usuário vê tela inicial com opções "Tocar agora" ou "Buscar música"
2. **Conectar Áudio** → Ao clicar em qualquer botão, `getUserMedia` é chamado (permissão de mic)
3. **PRGB Amp Ativo** → Som da guitarra começa a sair pelos fones/caixas em tempo real
4. **Carregar Música** → Tab é baixada do CDN do acervo e parseada em `NoteEvent[]`
5. **Jogo (PracticeGame)** → Canvas mostra rails coloridos com notas scrollando. Pitch detection compara nota tocada com nota da tab
6. **Scoring** → Perfect (de 70 ms antes a 110 ms depois da linha + MIDI exato), Good (de 150 ms antes a 260 ms depois + até um semitom ou uma oitava), Miss (passou da janela)
7. **Modais** → Usuário pode ajustar interface de áudio, trocar preset do PRGB Amp, buscar outra música

---

## 10. Glossário Rápido

| Termo | Significado |
|---|---|
| PRGB Amp | Motor DSP de emulação de amplificador de guitarra (criado neste projeto) |
| NSDF/MPM | Normalized Square Difference Function — algoritmo de detecção de pitch |
| Cab Sim | Cabinet Simulation — emulação de gabinete de alto-falante de guitarra |
| Tone Stack | Equalizador de 4 bandas (Bass, Mid, Treble, Presence) |
| WaveShaper | Nó Web Audio que aplica distorção não-linear (emulação de válvula) |
| Acervo | Provedor externo de tablaturas (API não oficial) |
| Rails | As linhas horizontais coloridas do jogo onde as notas passam |
| Hit Window | Janela de tolerância temporal para acertar uma nota (de 150 ms antes a 260 ms depois da linha) |
