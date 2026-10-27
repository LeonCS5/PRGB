# 🎸 PRGB — Play Real Guitar in Browser

<p align="center">
  <img src="public/favicon.svg" alt="PRGB Logo" width="80" height="80" />
</p>

<p align="center">
  <strong>Toque guitarra real direto no navegador com processamento DSP em tempo real, detecção de pitch e gamificação interativa estilo Yousician / Rocksmith.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19.x-blue?style=flat-square&logo=react" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-6.x-3178c6?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-8.x-646CFF?style=flat-square&logo=vite" alt="Vite" />
  <img src="https://img.shields.io/badge/TailwindCSS-4.x-38B2AC?style=flat-square&logo=tailwindcss" alt="Tailwind CSS 4" />
  <img src="https://img.shields.io/badge/Web_Audio_API-Native-orange?style=flat-square" alt="Web Audio API" />
  <img src="https://img.shields.io/badge/Tests-30%20passed%20(Vitest)-brightgreen?style=flat-square&logo=vitest" alt="Vitest 30 tests" />
  <img src="https://img.shields.io/badge/PWA-Ready-purple?style=flat-square" alt="PWA Ready" />
  <img src="https://img.shields.io/badge/Backend-Zero-success?style=flat-square" alt="Zero Backend" />
  <img src="https://img.shields.io/badge/Linter-oxlint-cyan?style=flat-square" alt="Oxlint" />
</p>

---

## 📖 Visão Geral

O **PRGB** (*Play Real Guitar in Browser*) é uma aplicação web completa e open-source que transforma o navegador em uma plataforma de treino e jogo interativo para guitarra:

1. **Conexão Direta:** Conecte sua guitarra elétrica através de qualquer interface de áudio USB (Focusrite Scarlett, Behringer U-Phoria, etc.).
2. **Amplificador Virtual TONE3000:** Ouça seu instrumento com emulação de amplificador valvulado, saturação dinâmica não-linear, tone stack de 4 bandas, simulação de gabinete (Cab Sim), noise gate e reverb espacial.
3. **1 Milhão+ de Músicas:** Carregue tablaturas do Songsterr com suporte a faixas individuais (Guitarra Solo, Base, Baixo) e técnicas avançadas (bends, ligaduras, grace notes, tapping, harmônicos).
4. **Game Engine em Canvas 2D:** Trilhos (*rails*) coloridos por corda, notas temporizadas, detecção de pitch em tempo real (NSDF/MPM), julgamento de precisão (*Perfect / Good / Miss*), contadores de combo e efeitos visuais a 60 FPS com suporte a High-DPI.
5. **Metrônomo de Alta Precisão:** Cliques agendados diretamente no relógio de hardware da Web Audio API (`AudioContext.currentTime`), com suporte a compassos compostos, anacruse e mudanças de andamento via `beatGrid`.
6. **100% Client-Side & PWA:** Sem servidores, sem banco de dados, sem login. Inclui suporte a PWA (Progressive Web App) com instalação local e cache offline do app shell.

---

## ⚡ Recursos Principais

### 🔊 Rack de Modelagem de Amplificador — TONE3000
Motor DSP nativo construído exclusivamente com Web Audio API, recriando a dinâmica e a resposta de frequência de amplificadores clássicos:
- **Noise Gate:** Threshold e release ajustáveis com atenuação suave para eliminar ruídos de captadores single-coil.
- **Preamp & WaveShaper:** Curva de transferência não-linear que emula o ponto de saturação suave (*soft clipping*) e harmônicos quentes de válvulas 12AX7.
- **Tone Stack (EQ de 4 Bandas):**
  - *Bass:* 110 Hz (Low-shelf)
  - *Mid:* 750 Hz (Peaking)
  - *Treble:* 2.8 kHz (High-shelf)
  - *Presence:* 4.5 kHz (Peaking)
- **Cabinet Simulator (Cab Sim):** Filtro multi-estágio passa-altas, passa-baixas e ressonância que replica a curva acústica de alto-falantes de 12" de guitarra.
- **Reverb Convolucional Sintético:** Controle Wet/Dry para profundidade e espacialização sonora natural.
- **Presets Integrados:** *Clean*, *Crunch*, *Lead*, *Metal* e *Acoustic*.

### 🎯 Detecção de Pitch & Afinador Cromático
- **Algoritmo NSDF (Normalized Square Difference Function):** Implementação baseada no McLeod Pitch Method (MPM) para identificação rápida e precisa da nota fundamental, imune a transientes e ruídos harmônicos.
- **Afinador Integrado:** Medição precisa de frequência em Hertz e desvio em cents (-50 a +50 cents) com indicação visual para afinar antes de tocar.
- **Suporte a Afinações Alternativas:** Standard (E A D G B E), Drop D, D Standard, Half Step Down e afinações personalizadas detectadas diretamente da tablatura.
- **Estimativa de Posição:** Rastreamento inteligente de corda e traste estimado (`stringEstimate` / `fretEstimate`).

### 🎮 Jogo Estilo Yousician (Canvas Game Engine)
- Trilhos horizontais coloridos representando cada corda da guitarra.
- Notas em cascata com indicador de traste (*fret*) e duração.
- Camada estática de rails em cache via `OffscreenCanvas` / `Path2D` para máxima performance a 60 FPS.
- Renderização adaptada à densidade de pixels da tela (`devicePixelRatio`).
- **Janela de Tolerância de Acerto:**
  - **Perfect:** ±55ms de tolerância temporal.
  - **Good:** ±130ms de tolerância temporal.
  - **Miss:** Fora da janela temporal ou nota incorreta.
- **Suporte a Técnicas Musicais:**
  - *Bends:* Aceita tanto a nota base quanto a nota alvo do bend.
  - *Dead & Ghost Notes:* Notas percussivas ou abafadas sem penalidade injusta de pontuação.
  - *Ties & Grace Notes:* Ligaduras e notas de ornamento preservadas e sincronizadas.
- **Prática:** Ajuste de velocidade (0.25x até 1.5x), metrônomo visual/sonoro e repetição em loop.

### ⏱️ Metrônomo com Agendamento no AudioContext
- Elimina o atraso e a imprecisão temporal do loop de eventos do JavaScript (`setTimeout`/`setInterval`).
- Agendamento antecipado de cliques de áudio via relógio nativo do `AudioContext`.
- Sistema `beatGrid` inteligente que processa mudanças de andamento (BPM), compassos complexos e compassos de anacruse (*pickup bars*).

### 🎛️ Roteamento de Entrada e Persistência Versionada
- Suporte a interfaces USB com múltiplos canais: escolha entre **Canal 1 (L)**, **Canal 2 (R)** ou **Mono Mix** (ideal para guitarras plugadas em entradas de linha/instrumento dedicadas).
- VU Meter estéreo em tempo real.
- **Persistência Inteligente (`preferences.ts`):** Salva no `localStorage` sob o schema `prgb:prefs:v1`:
  - Dispositivo de áudio selecionado e canal efetivo;
  - Parâmetros e preset atual do TONE3000;
  - Última música e faixa selecionadas (restauração automática ao reabrir o app).

### 📱 Progressive Web App (PWA)
- Instalável no desktop (Chrome/Edge) ou dispositivos móveis como aplicativo nativo.
- Service Worker (`sw.js`) com cache do app shell para inicialização instantânea e operação offline da interface.

### 🔔 Tratamento de Erros Amigável (`ErrorNotice`)
- Avisos de erro acessíveis (`role="alert"`) com mensagens claras em Português Brasileiro (pt-BR).
- Botões de ação integrados (ex: reconectar áudio, tentar novamente) sem travamentos silenciosos.

---

## 🏗️ Cadeia de Áudio (DSP Pipeline)

```
Guitarra → Interface USB → getUserMedia (RAW 48kHz, sem filtros do SO)
                               │
                       ChannelSplitter (L/R)
                               │
               ┌───────────────┴───────────────┐
               ▼                               ▼
        AnalyserNode                     TONE3000 Engine
     (Pitch Detection NSDF)                    │
               │                          Noise Gate
               ▼                               │
       Yousician Engine              Preamp + WaveShaper
     (Matching & Scoring)                      │
                                        Tone Stack (EQ)
                                               │
                                       Cabinet Simulator
                                               │
                                            Reverb
                                               │
                                         Master Volume
                                               │
                                      🔊 Alto-falantes / Fone
```

---

## 🚀 Começando

### Pré-requisitos
- **Node.js:** versão 20 ou superior.
- **Interface de Áudio USB:** Conectada ao computador com a guitarra plugada na entrada de instrumento (*Hi-Z / Inst*).
- **Navegador Moderno:** Chrome, Edge, Brave, Opera ou Firefox com suporte nativo à Web Audio API.
- **Fones de Ouvido:** Recomendado para evitar feedback sonoro (*microfonia*).

### Instalação

1. Clone o repositório:
```bash
git clone https://github.com/LeonCS5/PRGB.git
cd PRGB
```

2. Instale as dependências:
```bash
npm install
```

3. Inicie o servidor de desenvolvimento:
```bash
npm run dev
```

4. Acesse no navegador: [http://localhost:5173](http://localhost:5173)

---

## 🛠️ Scripts Disponíveis

| Comando | Descrição |
|---|---|
| `npm run dev` | Inicia o servidor Vite local com proxies da API Songsterr |
| `npm run build` | Valida a tipagem TypeScript (`tsc -b`) e gera o bundle de produção em `dist/` |
| `npm run lint` | Executa o linter ultrarrápido [oxlint](https://oxc.rs) |
| `npm run test` | Executa a suíte de 30 testes unitários automatizados com [Vitest](https://vitest.dev) |
| `npm run preview` | Executa um servidor local para inspecionar a build de produção |

---

## 📂 Estrutura do Projeto

```
PRGB/
├── index.html                       # Shell HTML da aplicação com PWA links
├── vite.config.ts                   # Configuração do Vite e proxy reverso da API Songsterr
├── package.json                     # Scripts e dependências
├── tsconfig.app.json                # Configuração TypeScript (Strict mode)
├── .oxlintrc.json                   # Configuração do linter oxlint
│
├── src/
│   ├── main.tsx                     # Ponto de entrada React (StrictMode)
│   ├── App.tsx                      # Componente raiz, landing page e coordenação global
│   ├── index.css                    # Tailwind CSS 4 + reset global
│   │
│   ├── context/
│   │   ├── AudioSessionContext.tsx  # Estado global de áudio, TONE3000 e store isolado de pitch
│   │   ├── ModalsContext.tsx        # Controle de visibilidade dos modais
│   │   ├── preferences.ts           # Persistência versionada no localStorage (prgb:prefs:v1)
│   │   └── uiErrors.ts              # Catálogo de mensagens de erro pt-BR e helpers
│   │
│   ├── components/
│   │   ├── YousicianGame.tsx        # Canvas 2D: rails em cache, notas, animação 60FPS e scoring
│   │   ├── SongSearchModal.tsx      # Modal de pesquisa de músicas e seleção de faixas Songsterr
│   │   ├── AudioSettingsModal.tsx   # Modal de escolha de interface, canal, VU meter e afinador
│   │   ├── Tone3000AmpRack.tsx      # Interface gráfica do amplificador TONE3000 e presets
│   │   └── ErrorNotice.tsx          # Alerta de erro acessível (role="alert") com ações
│   │
│   └── services/
│       ├── audioEngine.ts           # Captura USB raw, roteamento de canal e pitch NSDF/MPM
│       ├── audioEngine.test.ts      # Testes unitários do AudioEngine
│       ├── tone3000Amp.ts           # Cadeia DSP completa do amplificador valvulado e cab sim
│       ├── songsterrApi.ts          # Cliente da API Songsterr e normalizador de tablaturas
│       ├── songsterrApi.test.ts     # Testes unitários do parser de tablaturas
│       ├── synthAudio.ts            # MetronomeScheduler no relógio Web Audio, SFX e synth
│       └── synthAudio.test.ts       # Testes unitários do agendamento de metrônomo
│
└── public/
    ├── favicon.svg                  # Ícone vetorial da aplicação
    ├── icons.svg                    # Sprites vetoriais
    ├── manifest.webmanifest         # Manifesto PWA
    └── sw.js                        # Service Worker para cache offline do app shell
```

---

## 🎸 Dicas para a Melhor Experiência

1. **Use Fones de Ouvido:** Como o microfone/interface fica ativo para captura contínua, usar fones evita retorno e interferência no detector de pitch.
2. **Selecione o Canal Correto:** Se a sua guitarra estiver conectada na entrada 2 da interface USB, abra o menu **Áudio**, selecione **Canal 2 (R)** e verifique se o VU meter responde ao tocar uma corda.
3. **Afine Antes de Tocar:** Use o afinador integrado para garantir que as cordas estejam afinadas de acordo com a tablatura carregada.
4. **Buffer & Latência:** Para obter a menor latência no Windows, configure sua interface para 48.000 Hz (48 kHz) com buffers pequenos (64 a 128 samples) nas configurações do driver da sua interface de áudio.

---

## 🔒 Privacidade & Segurança

- **100% Local:** Seu áudio é processado inteiramente na memória do seu navegador.
- **Sem Gravação:** Nenhum áudio é gravado ou transmitido para a rede.
- **Sem Rastreamento:** Sem anúncios, cookies de terceiros ou necessidade de cadastro.

---

## 📄 Licença

Este projeto é desenvolvido para fins educacionais e de código aberto. Tablaturas e metadados musicais são providos via API do Songsterr.
