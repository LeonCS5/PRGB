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
│   ├── App.css                      # ⚠️ LIXO — CSS do template Vite, não usado, pode deletar
│   │
│   ├── components/
│   │   ├── YousicianGame.tsx        # [730 linhas] Canvas game: rails, notas, scoring, particles
│   │   ├── SongSearchModal.tsx      # [245 linhas] Modal: busca Songsterr + seleção de faixa
│   │   ├── AudioSettingsModal.tsx   # [327 linhas] Modal: device selector, afinador, VU meter
│   │   └── Tone3000AmpRack.tsx      # [393 linhas] Modal: rack completo do amp modeler
│   │
│   ├── services/
│   │   ├── audioEngine.ts           # [296 linhas] Captura mic, channel routing, pitch detection (NSDF)
│   │   ├── tone3000Amp.ts           # [585 linhas] DSP chain: preamp→waveshaper→EQ→cab→reverb→output
│   │   ├── songsterrApi.ts          # [254 linhas] API client: search, meta, tab download, normalizer
│   │   └── synthAudio.ts            # [128 linhas] SFX: note synth, metronome clicks, hit/miss sounds
│   │
│   └── assets/                      # ⚠️ LIXO — hero.png, react.svg, vite.svg (template, não usado)
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

## Problemas Conhecidos (Backlog de Melhoria)

### Prioridade Alta
- [ ] **Canvas não responsivo** — `YousicianGame.tsx` usa `window.innerWidth` hardcoded; precisa de ResizeObserver
- [ ] **Estado monolítico** — tudo em `App.tsx`; extrair para Context ou zustand
- [ ] **TONE3000 recriada a cada reconexão** — `stop()` destrói o engine, `start()` recria; causa clicks

### Prioridade Média
- [ ] **Sem persistência** — preferências não salvas em localStorage (device, canal, preset, última música)
- [ ] **Pitch detection incompleta** — `stringEstimate`/`fretEstimate` existem na interface mas nunca são populados
- [ ] **Sem tratamento de erros na UI** — muitos `console.error` sem feedback visual
- [ ] **Performance do Canvas** — gradients e paths recriados a cada frame

### Prioridade Baixa
- [ ] **App.css é lixo** — 185 linhas de CSS do template Vite, pode deletar
- [ ] **Assets legados** — `src/assets/` tem arquivos do template, pode limpar
- [ ] **Sem testes** — zero unit/integration/e2e tests
- [ ] **Metrônomo impreciso** — scheduling via React state, deveria usar AudioContext
- [ ] **Parser de tabs incompleto** — não suporta bends, harmonics, tapping, ghost notes
- [ ] **Sem PWA/offline** — sem service worker ou manifest

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
