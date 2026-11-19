# 🎸 PRGB — Play Real Guitar in Browser

<p align="center">
  <img src="public/favicon.svg" alt="PRGB Logo" width="80" height="80" />
</p>

<p align="center">
  <strong>Toque guitarra real direto no navegador: exercícios, trilha de evolução, repertório próprio e sessões de prática, com detecção de pitch, pontuação e um simulador de amplificador.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19.x-blue?style=flat-square&logo=react" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-6.x-3178c6?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-8.x-646CFF?style=flat-square&logo=vite" alt="Vite" />
  <img src="https://img.shields.io/badge/TailwindCSS-4.x-38B2AC?style=flat-square&logo=tailwindcss" alt="Tailwind CSS 4" />
  <img src="https://img.shields.io/badge/Web_Audio_API-Native-orange?style=flat-square" alt="Web Audio API" />
  <img src="https://img.shields.io/badge/Tests-Vitest-brightgreen?style=flat-square&logo=vitest" alt="Testes com Vitest" />
  <img src="https://img.shields.io/badge/PWA-Ready-purple?style=flat-square" alt="PWA Ready" />
  <img src="https://img.shields.io/badge/Backend-Supabase-success?style=flat-square" alt="Backend gerenciado Supabase" />
  <img src="https://img.shields.io/badge/Linter-oxlint-cyan?style=flat-square" alt="Oxlint" />
</p>

---

## 📖 Visão Geral

O **PRGB** (*Play Real Guitar in Browser*) é uma aplicação web gratuita para praticar guitarra com a guitarra de verdade, sem instalar nada. O jogo toca no navegador e lê a nota que você toca pela interface de áudio USB:

1. **Exercícios:** uma biblioteca de exercícios gerados por regras de teoria (escalas, arpejos, acordes, ritmo, técnica), em qualquer tom e de vários jeitos de tocar, que funciona offline.
2. **Trilha de evolução:** etapas em ordem de dificuldade, com estrelas por passo e "Continue daqui". Nada fica bloqueado.
3. **Repertório próprio:** peças de domínio público e originais, escritas em notação compacta e carregadas sob demanda.
4. **Sessões de prática:** uma fila de exercícios tocados em sequência, montada por etapa da trilha, por tempo ou à mão.
5. **Progresso e aparência:** estrelas, palhetas e ensaio da semana guardados só no seu navegador, e temas, estilos de nota e tipografias para personalizar.
6. **Jogo em Canvas 2D:** trilhos coloridos por corda, detecção de pitch em tempo real (NSDF/MPM), julgamento *Perfect / Good / Miss*, combo e pontuação, com suporte a telas de alta densidade.
7. **PRGB Amp:** um simulador de amplificador feito em software (noise gate, saturação, tone stack de 4 bandas, simulação de gabinete e reverb) para ouvir a guitarra enquanto toca.
8. **Sem conta para tocar & PWA:** o áudio é processado no navegador e nunca é enviado. Ranking e dupla online são opcionais e usam o Supabase. O app pode ser instalado e guarda o essencial em cache para uso offline.
9. **Extra experimental:** a busca em um acervo externo de tablaturas, de terceiros, sem afiliação com o PRGB. Pode ser desligada por configuração (`VITE_ACERVO_ENABLED=false`) e não vale para o ranking.

---

## ⚡ Recursos Principais

### 🔊 Rack de Modelagem de Amplificador — PRGB Amp
Motor DSP construído com a Web Audio API, um simulador que não reproduz com exatidão nenhum equipamento real:
- **Noise Gate:** Threshold e release ajustáveis com atenuação suave para reduzir o ruído de fundo.
- **Preamp & WaveShaper:** Curva de transferência não-linear que aplica saturação suave (*soft clipping*).
- **Tone Stack (EQ de 4 Bandas):**
  - *Bass:* 110 Hz (Low-shelf)
  - *Mid:* 750 Hz (Peaking)
  - *Treble:* 2.8 kHz (High-shelf)
  - *Presence:* 4.5 kHz (Peaking)
- **Cabinet Simulator (Cab Sim):** Filtro multi-estágio passa-altas, passa-baixas e ressonância que aproxima a resposta de um gabinete de guitarra (simulação, não uma réplica de equipamento real).
- **Reverb Convolucional Sintético:** Controle Wet/Dry para profundidade e espacialização sonora natural.
- **Presets Integrados:** seis presets prontos, escolhidos no rack do PRGB Amp.

### 🎯 Detecção de Pitch & Afinador Cromático
- **Algoritmo NSDF (Normalized Square Difference Function):** Implementação baseada no McLeod Pitch Method (MPM) para identificar a nota fundamental. É monofônico: num acorde batido, devolve em geral só a tônica.
- **Afinador Integrado:** Medição de frequência em Hertz e desvio em cents (-50 a +50 cents) com indicação visual para afinar antes de tocar.
- **Suporte a Afinações Alternativas:** Standard (E A D G B E), Drop D, D Standard, Half Step Down e afinações personalizadas detectadas diretamente da tablatura.
- **Estimativa de Posição:** Rastreamento inteligente de corda e traste estimado (`stringEstimate` / `fretEstimate`).

### 🎮 Jogo de Prática (Canvas Game Engine)
- Trilhos horizontais coloridos representando cada corda da guitarra.
- Notas em cascata com indicador de traste (*fret*) e duração.
- Camada estática de rails em cache via `OffscreenCanvas` / `Path2D` para reduzir o custo de desenho.
- Renderização adaptada à densidade de pixels da tela (`devicePixelRatio`).
- **Janela de Tolerância de Acerto:**
  - **Perfect:** de 70 ms antes a 110 ms depois da linha.
  - **Good:** de 150 ms antes a 260 ms depois da linha.
  - **Miss:** Fora da janela temporal ou nota incorreta.
- **Suporte a Técnicas Musicais:**
  - *Bends:* Aceita tanto a nota base quanto a nota alvo do bend.
  - *Dead & Ghost Notes:* Notas percussivas ou abafadas sem penalidade injusta de pontuação.
  - *Ties & Grace Notes:* Ligaduras e notas de ornamento preservadas e sincronizadas.
- **Prática:** Ajuste de velocidade (0,5×, 0,75× e 1×), metrônomo sonoro e modo treino, que repete o exercício sem parar.

### ⏱️ Metrônomo com Agendamento no AudioContext
- Evita o atraso e a imprecisão temporal do loop de eventos do JavaScript (`setTimeout`/`setInterval`).
- Agendamento antecipado de cliques de áudio via relógio nativo do `AudioContext`.
- Sistema `beatGrid` inteligente que processa mudanças de andamento (BPM), compassos complexos e compassos de anacruse (*pickup bars*).

### 🎛️ Roteamento de Entrada e Persistência Versionada
- Suporte a interfaces USB com múltiplos canais: escolha entre **Canal 1 (L)**, **Canal 2 (R)** ou **Mono Mix** (ideal para guitarras plugadas em entradas de linha/instrumento dedicadas).
- VU Meter estéreo em tempo real.
- **Persistência Inteligente (`preferences.ts`):** Salva no `localStorage` sob o schema `prgb:prefs:v1`:
  - Dispositivo de áudio selecionado e canal efetivo;
  - Parâmetros e preset atual do PRGB Amp;
  - Última música e faixa selecionadas (restauração automática ao reabrir o app).

### 📱 Progressive Web App (PWA)
- Instalável no desktop (Chrome/Edge) ou dispositivos móveis como aplicativo nativo.
- Service Worker (`sw.js`) com cache do app shell para abrir a interface sem rede. Tablaturas do acervo externo nunca vão para o cache.

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
        AnalyserNode                     PRGB Amp Engine
     (Pitch Detection NSDF)                    │
               │                          Noise Gate
               ▼                               │
       PRGB Game Engine             Preamp + WaveShaper
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
- **Node.js:** versão 22 ou superior (a Vercel publica com a 24).
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

3. (Opcional) Configure o ranking e a dupla online. Sem isto o jogo funciona normalmente, sem conta e sem ranking:
```bash
cp .env.example .env.local   # preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
```

4. Inicie o servidor de desenvolvimento:
```bash
npm run dev
```

5. Acesse no navegador: [http://localhost:5173](http://localhost:5173)

---

## 🛠️ Scripts Disponíveis

| Comando | Descrição |
|---|---|
| `npm run dev` | Inicia o servidor Vite local com proxies da API de tablaturas |
| `npm run build` | Valida a tipagem TypeScript (`tsc -b`) e gera o bundle de produção em `dist/` |
| `npm run lint` | Executa o linter ultrarrápido [oxlint](https://oxc.rs) |
| `npm run test` | Executa os testes com [Vitest](https://vitest.dev): serviços, estado das telas e as migrations do banco, rodadas num Postgres isolado (PGlite) |
| `npm run preview` | Executa um servidor local para inspecionar a build de produção |

---

## ⚙️ Configuração e Deploy

- **Variáveis de ambiente** (o `.env.example` explica cada uma): `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` ligam o ranking e a dupla online; `VITE_TURNSTILE_SITE_KEY` ativa a verificação contra robôs na criação de conta; `VITE_SUPPORT_URL` define o link de apoio. Só variáveis `VITE_` chegam ao navegador: nunca coloque uma chave secreta com esse prefixo.
- **Deploy:** o push na `main` publica na [Vercel](https://vercel.com). O CI do GitHub roda lint, build, testes e `npm audit` a cada push na `main` e em cada pull request.
- **Banco:** as migrations ficam em `supabase/migrations/` e os testes delas em `supabase/db-tests/`.
- **Operação** (inventário de serviços, plano de incidente, backup, rotação de chaves): [docs/operacao.md](docs/operacao.md).
- **Histórico de mudanças:** [CHANGELOG.md](CHANGELOG.md).

---

## 📂 Estrutura do Projeto

O mapa completo, arquivo por arquivo, fica em [AGENTS.md](AGENTS.md). Em resumo:

```
PRGB/
├── src/
│   ├── components/   # Telas e componentes (jogo em canvas, modais, ranking, exercícios)
│   ├── context/      # Estado global: áudio, modais, ranking, salas, preferências
│   ├── services/     # Áudio, pitch, pontuação, exercícios, acervo, backend (cada um com seu teste)
│   └── content/      # Política de Privacidade e Termos (LGPD)
├── supabase/         # Migrations, Edge Function e testes de banco
├── docs/             # Operação: incidentes, backup, chaves
├── scripts/          # Rotinas locais (backup do banco)
└── public/           # Fontes, ícones, manifesto PWA e service worker
```

---

## 🎸 Dicas para a Melhor Experiência

1. **Use Fones de Ouvido:** Como o microfone/interface fica ativo para captura contínua, usar fones evita retorno e interferência no detector de pitch.
2. **Selecione o Canal Correto:** Se a sua guitarra estiver conectada na entrada 2 da interface USB, abra o menu **Áudio**, selecione **Canal 2 (R)** e verifique se o VU meter responde ao tocar uma corda.
3. **Afine Antes de Tocar:** Use o afinador integrado para garantir que as cordas estejam afinadas de acordo com a tablatura carregada.
4. **Buffer & Latência:** O navegador usa os drivers do Windows, não ASIO, então a latência é maior que a de programas nativos. Ajuste o buffer e a compensação em **Áudio** e feche programas que usam ASIO, que podem prender a interface.

---

## 🔒 Privacidade & Segurança

- **100% Local:** Seu áudio é processado inteiramente na memória do seu navegador.
- **Sem Gravação:** Nenhum áudio é gravado ou transmitido para a rede.
- **Sem Rastreamento:** Sem anúncios, sem cookies e sem cadastro para tocar.
- **Ranking opcional:** só para maiores de 18 anos, com consentimento, conta anônima (sem e-mail nem senha) e uma verificação contra robôs da Cloudflare antes de criar a conta. Detalhes na Política de Privacidade do site.

---

## 📄 Licença

O código-fonte está público para consulta, mas ainda não tem licença de uso: todos os direitos reservados a Leonam Candido, exceto as bibliotecas e fontes de terceiros, que seguem as próprias licenças (veja `/licencas-terceiros.md` no site). Tablaturas e metadados musicais vêm de um provedor externo, sem afiliação com o PRGB.
