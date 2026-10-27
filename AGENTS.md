# AGENTS.md — Guia de Colaboração para Codex, Claude, e Qualquer Agente AI

> **Este arquivo é o ponto de entrada universal para qualquer agente de IA que trabalhe neste repositório.**
> Leia integralmente antes de fazer qualquer alteração.

---

## Resumo do Projeto

**PRGB** = Play Real Guitar in Browser

Um app web (React + TypeScript + Vite) que funciona como um "Yousician open-source":
- Captura áudio da guitarra real via interface USB (Web Audio API, 48kHz, sem processamento do OS)
- Processa o som em tempo real com o motor **TONE3000** (amplificador + gabinete + reverb + noise gate)
- Carrega tablaturas de 1M+ músicas da API do Songsterr
- Renderiza um jogo estilo Guitar Hero/Yousician em Canvas 2D com detecção de pitch e scoring

**Zero backend. Zero login. 100% client-side.**

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
├── index.html                       # HTML shell (mount point #root)
├── vite.config.ts                   # Vite config + proxy Songsterr API
├── package.json                     # Dependencies & scripts
├── tsconfig.app.json                # TypeScript config (strict, ES2023, bundler mode)
├── .oxlintrc.json                   # oxlint config (react + typescript plugins)
│
├── src/
│   ├── main.tsx                     # React entry point
│   ├── App.tsx                      # Root component (estado global, landing page)
│   ├── index.css                    # Tailwind CSS 4 import + global reset
│   │
│   ├── context/
│   │   ├── AudioSessionContext.tsx  # AudioEngine, TONE3000, device/canal, erros de áudio; pitch em store próprio (useLatestPitch)
│   │   ├── ModalsContext.tsx        # Estado aberto/fechado dos modais
│   │   ├── preferences.ts           # localStorage versionado (prgb:prefs:v1): device, canal, TONE3000, última música
│   │   └── uiErrors.ts              # Mensagens de erro pt-BR + carga/validação de música e tab
│   │
│   ├── components/
│   │   ├── YousicianGame.tsx        # Canvas game: rails (camada estática em cache, DPR), notas, scoring, metrônomo
│   │   ├── SongSearchModal.tsx      # Modal: busca Songsterr + seleção de faixa
│   │   ├── AudioSettingsModal.tsx   # Modal: device selector, afinador, VU meter
│   │   ├── Tone3000AmpRack.tsx      # Modal: rack completo do amp modeler
│   │   └── ErrorNotice.tsx          # Aviso de erro dispensável com ação (role="alert")
│   │
│   ├── services/                    # Cada service tem um *.test.ts (Vitest) ao lado
│   │   ├── audioEngine.ts           # Captura, channel routing, pitch (NSDF), corda/casa estimadas, fila start/stop com fade
│   │   ├── tone3000Amp.ts           # DSP chain: preamp→waveshaper→EQ→cab→reverb→output
│   │   ├── songsterrApi.ts          # API client + normalizer (cordas 0-indexed no JSON bruto, ties, grace, técnicas, beatGrid)
│   │   └── synthAudio.ts            # SFX + MetronomeScheduler (cliques agendados no relógio do AudioContext)
│
└── public/
    ├── favicon.svg
    └── icons.svg
```

---

## Tecnologias

- **React 19** + **TypeScript 6** + **Vite 8**
- **Tailwind CSS 4** (via `@tailwindcss/vite`, sem config file)
- **lucide-react** (ícones)
- **oxlint** (linter — NÃO usa ESLint)
- **Web Audio API** (captura, DSP, e output — tudo nativo)
- **Songsterr API** (reverse-engineered, proxied via Vite dev server)

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
        Yousician Game              EQ (Bass→Mid→Treble→Presence)
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
- Paleta: `slate-950` (bg), `cyan` (primário), `rose` (secundário), `emerald` (sucesso), `amber` (warning)

### Linting
- **oxlint** (`.oxlintrc.json`) — NÃO instalar ESLint, prettier, ou similares
- Plugins ativos: react, typescript, oxc

---

## Regras INVIOLÁVEIS

1. **Não adicionar backend/servidor.** O app é 100% client-side.
2. **Não instalar ESLint.** O projeto usa oxlint.
3. **Não trocar Tailwind CSS** por outra solução de styling.
4. **Não usar `any`** sem justificativa em comentário adjacente.
5. **Toda UI em Português Brasileiro.** Variáveis em inglês.
6. **Não alterar o proxy Vite** (`/api/songsterr`, `/cdn/songsterr`) sem entender o CORS routing.
7. **Não usar `setTimeout`/`setInterval`** para timing de áudio — usar `AudioContext.currentTime`.
8. **Não manipular DOM diretamente** — usar React refs.
9. **Não usar CSS inline** (`style={{}}`) exceto para valores dinâmicos calculados.
10. **Não remover ou refatorar o TONE3000** sem entender a cadeia DSP completa documentada acima.

---

## Colaboração entre Agentes (Claude + Codex)

Mais de um agente trabalha neste repositório. O humano coordena; os agentes seguem este protocolo.

1. **Uma tarefa por agente, atribuída pelo humano.** Antes de começar, confira no backlog abaixo se o item está marcado com o seu nome (`@claude` ou `@codex`). Não pegue item sem dono nem item de outro agente.
2. **Worktree próprio, nunca a pasta principal.** `PRGB/` é reservada para `main` e merges.
   ```bash
   git worktree add ../PRGB-codex  -b codex/<tarefa>  main   # Codex
   git worktree add ../PRGB-claude -b claude/<tarefa> main   # Claude
   ```
   Cada worktree precisa do seu próprio `npm install`.
3. **Branch com prefixo do agente** (`codex/…`, `claude/…`), um problema por branch, commits no padrão `feat:`/`fix:`/`refactor:`/`docs:`/`chore:`.
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

---

## Problemas Conhecidos (Backlog de Melhoria)

Formato: `- [ ] **Item** — descrição` + `(@agente, rodada, branch, status)`.

### Divisão de áreas
- **@claude:** `src/services/` (áudio, DSP, pitch, parser), testes, documentação e orquestração.
- **@codex:** `src/context/`, `src/components/`, `App.tsx` (UI, estado, canvas), PWA.
- Item que cruza áreas espera o dono da outra área liberar o arquivo.

### Rodada 1 — destravar o build (concluída, merge em `main` 4ba14eb)
- [x] **Build quebrado** — tipos `Float32Array<ArrayBuffer>` em `tone3000Amp.ts` + imports não usados (@claude, `bb447da`, aprovado por @codex)
- [x] **Canvas não responsivo** — ResizeObserver em `YousicianGame.tsx` (@codex, `77d100c`, aprovado por @claude)
- [x] **Estado monolítico** — `AudioSessionContext` + `ModalsContext` (@codex, `77d100c`, aprovado por @claude)
- [x] **TONE3000 recriada a cada reconexão** — AudioContext e amp reaproveitados entre `start()` (@codex, `77d100c`, aprovado por @claude; não testado com interface real)

### Rodada 2 (concluída, merge em `main` 1a77f10)
- [x] **Pitch detection incompleta** — `stringEstimate`/`fretEstimate` (posição de casa mais baixa, `setTuning`), fade de ganho na reconexão, fila start/stop, fallback de device (@claude, aprovado por @codex)
- [x] **Parser de tabs** — **bug grave corrigido**: cordas do JSON bruto do Songsterr são 0-indexed (todas as notas saíam uma corda acima); ties, grace notes, dead/ghost/tapping/harmonic/bend (@claude, aprovado por @codex)
- [x] **Sem persistência** — `preferences.ts` (@codex, aprovado por @claude)
- [x] **Performance do Canvas** — camada estática em OffscreenCanvas, Path2D, DPR, pitch fora do render do React (@codex, aprovado por @claude)

### Rodada 3 (merge em `main` d3b7450)
- [x] **Integração dos novos campos** — tuning da tab no pitch, device efetivo persistido, dead/grace/ghost sem penalidade, bend aceita base ou alvo (@codex, aprovado por @claude)
- [x] **Sem tratamento de erros na UI** — `ErrorNotice` + `uiErrors.ts` (@codex, aprovado por @claude)
- [x] **Metrônomo impreciso** — `beatGrid` (compasso + mudanças de tempo) e `MetronomeScheduler` no relógio do AudioContext; `initialBpm` corrigido (@claude)
- [x] **Sem testes** — Vitest, 26 testes nos services; 12 deles falham no código anterior às correções (@claude)
- [ ] **Sem PWA/offline** — manifest + service worker (@codex, em andamento)

### Pendências conhecidas (sem dono)
- [ ] **Teste com interface de áudio real e no navegador** — nada disso foi validado por humano: latência, clicks na troca de device, afinador, scoring tocando de verdade.
- [ ] **`setCurrentTimeMs` a cada frame** — o `YousicianGame` ainda re-renderiza ~60×/s enquanto toca (posição da música em state). Mover para ref exige mexer no scoring; deixado de fora para não alterar comportamento.
- [ ] **Songsterr em produção (não verificado)** — o proxy `/api/songsterr` e `/cdn/songsterr` só existe no dev server/preview do Vite; num deploy estático o app cai no fallback direto, que pode ser bloqueado por CORS.
- [ ] **Sem router** — SPA sem rotas; se crescer, avaliar react-router

### Concluídos
- [x] **App.css é lixo** — removido
- [x] **Assets legados** — `src/assets/` removido

---

## Fluxo do Usuário

```
Landing Page → Clica "Tocar" ou "Buscar" → getUserMedia() → TONE3000 Ativo
    │                                                            │
    ▼                                                            ▼
  Songsterr Search → Seleciona Música → Download Tab JSON → Parse para NoteEvent[]
                                                                 │
                                                                 ▼
                                                    Canvas Game (Yousician Rails)
                                                    Pitch Detection ↔ Note Matching
                                                    Score / Combo / Accuracy
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

---

## Dica Final para Agentes

Se estiver em dúvida sobre qualquer aspecto do projeto, **leia os 4 services em `src/services/`** — eles são o coração do app e estão bem documentados com comentários inline. O `tone3000Amp.ts` em particular é o mais complexo e sensível — altere com cuidado.
