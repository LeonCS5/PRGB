# CLAUDE.md — Guia de Colaboração do Projeto PRGB

> **Leia este arquivo inteiro antes de fazer qualquer alteração no projeto.**
> Este é o documento raiz de contexto para Claude Code, Claude em IDEs, e qualquer agente baseado em Claude.
>
> **Fonte única de regras, backlog e protocolo de colaboração com o Codex: `AGENTS.md`** (importado abaixo). Em caso de conflito, o `AGENTS.md` vale.

@AGENTS.md

---

## 1. Visão Geral do Projeto

**PRGB** (Play Real Guitar in Browser) é um aplicativo web gratuito de prática de guitarra que permite ao usuário:

1. **Conectar sua guitarra real** via interface de áudio USB (Focusrite, Behringer, Realtek, etc.)
2. **Ouvir o som processado** em tempo real pelo motor DSP **TONE3000** (emulação de amplificador valvulado, gabinete, noise gate, reverb)
3. **Tocar junto com tablaturas** baixadas da API do Songsterr (1M+ músicas), com detecção de pitch e gamificação (score, combo, acertos Perfect/Good/Miss)

**Sem servidor próprio.** O jogo roda 100% no navegador (todo o áudio via Web Audio API, nunca enviado); ranking e salas online, opcionais e só com consentimento 18+, usam Supabase gerenciado (região São Paulo). Regras em AGENTS.md › Regras INVIOLÁVEIS 1 e 11.

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
| Dados | Songsterr API (reverse-engineered, via proxy Vite) | — |

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
├── vite-env.d.ts                    # Tipos de import.meta.env (VITE_SUPPORT_URL)
│
├── context/
│   ├── AudioSessionContext.tsx      # AudioEngine, TONE3000, device/canal, erros; pitch via useLatestPitch
│   ├── ModalsContext.tsx            # Estado aberto/fechado dos modais
│   ├── preferences.ts               # Persistência em localStorage (prgb:prefs:v1)
│   └── uiErrors.ts                  # Mensagens de erro pt-BR + carga/validação de tabs
│
├── components/
│   ├── PracticeGame.tsx             # ⭐ Canvas game principal (rails de notas, scoring, particles, metrônomo)
│   ├── BrandMark.tsx                # Logo PRGB
│   ├── SongSearchModal.tsx          # Modal de busca de músicas no Songsterr
│   ├── AudioSettingsModal.tsx       # Modal de configuração de interface de áudio + afinador
│   ├── Tone3000AmpRack.tsx          # Modal do rack completo do amp modeler TONE3000
│   └── ErrorNotice.tsx              # Aviso de erro dispensável com ação
│
├── services/
│   ├── audioEngine.ts               # ⭐ Engine de captura de áudio + detecção de pitch (NSDF/MPM)
│   ├── tone3000Amp.ts               # ⭐ DSP engine: preamp, waveshaper, tone stack, cab sim, reverb
│   ├── songsterrApi.ts              # Client da API Songsterr: busca, meta, download de tabs, normalização
│   ├── synthAudio.ts                # Sintetizador de notas, MetronomeScheduler e efeitos sonoros do jogo
│   ├── demoSong.ts                  # Exercício original offline (sem rede, sem direitos de terceiros)
│   └── *.test.ts                    # Testes Vitest de cada service
│
public/
├── favicon.svg                      # Logo PRGB
├── icons/, og-image.png             # Ícones do app e imagem de compartilhamento
├── manifest.webmanifest, sw.js      # PWA
vercel.json                          # Deploy com rewrites do Songsterr (ver AGENTS.md › Deploy)
```

### Proxies Vite (vite.config.ts)

O Vite faz proxy reverso para acessar a API do Songsterr sem CORS:

- `/api/songsterr/*` → `https://www.songsterr.com/api/*`
- `/cdn/songsterr/*` → `https://dqsljvtekg760.cloudfront.net/*` (CDN de tablaturas JSON)

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
AnalyserNode ← Merger ← (Channel selecionado)      TONE3000 Input
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
- Classes para services (AudioEngine, Tone3000AmpEngine, SongsterrApi)
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
- **Nunca alterar a cadeia DSP do TONE3000** sem entender o signal routing completo (seção 4)
- **Nunca instalar ESLint** — o projeto usa oxlint exclusivamente
- **Nunca migrar de Tailwind CSS** para outra solução de styling
- **Nunca adicionar servidor próprio** — só Supabase gerenciado, para ranking/salas, e o jogo funciona sem ele
- **Manter toda a UI em Português Brasileiro**
- **Preservar a API de proxy do Vite** (`/api/songsterr`, `/cdn/songsterr`)

### RECOMENDADO
- Ao criar novos componentes, seguir o padrão `React.FC<Props>` existente
- Ao mexer no áudio, testar com uma interface de áudio real (Focusrite, Behringer)
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

1. **Landing Page** → Usuário vê tela inicial com opções "Tocar Metallica" ou "Buscar Música"
2. **Conectar Áudio** → Ao clicar em qualquer botão, `getUserMedia` é chamado (permissão de mic)
3. **TONE3000 Ativo** → Som da guitarra começa a sair pelos fones/caixas em tempo real
4. **Carregar Música** → Tab é baixada do Songsterr CDN e parseada em `NoteEvent[]`
5. **Jogo (PracticeGame)** → Canvas mostra rails coloridos com notas scrollando. Pitch detection compara nota tocada com nota da tab
6. **Scoring** → Perfect (±55ms + MIDI match), Good (±130ms + MIDI match), Miss (passou da hit line)
7. **Modais** → Usuário pode ajustar interface de áudio, trocar preset do TONE3000, buscar outra música

---

## 10. Glossário Rápido

| Termo | Significado |
|---|---|
| TONE3000 | Motor DSP de emulação de amplificador de guitarra (criado neste projeto) |
| NSDF/MPM | Normalized Square Difference Function — algoritmo de detecção de pitch |
| Cab Sim | Cabinet Simulation — emulação de gabinete de alto-falante de guitarra |
| Tone Stack | Equalizador de 4 bandas (Bass, Mid, Treble, Presence) |
| WaveShaper | Nó Web Audio que aplica distorção não-linear (emulação de válvula) |
| Songsterr | Serviço de tablaturas online (API reverse-engineered) |
| Rails | As linhas horizontais coloridas do jogo onde as notas descem (estilo Guitar Hero) |
| Hit Window | Janela de tolerância temporal para acertar uma nota (±130ms) |
