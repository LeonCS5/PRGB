# 🎸 PRGB — Play Real Guitar in Browser

<p align="center">
  <img src="public/favicon.svg" alt="PRGB Logo" width="80" height="80" />
</p>

<p align="center">
  <strong>Toque guitarra real direto no navegador: exercícios, trilha de evolução, repertório próprio e sessões de prática, com detecção de pitch, pontuação e um simulador de amplificador.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/vers%C3%A3o-1.0.0-orange?style=flat-square" alt="Versão 1.0.0" />
  <img src="https://img.shields.io/badge/React-19.x-blue?style=flat-square&logo=react" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-6.x-3178c6?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-8.x-646CFF?style=flat-square&logo=vite" alt="Vite" />
  <img src="https://img.shields.io/badge/TailwindCSS-4.x-38B2AC?style=flat-square&logo=tailwindcss" alt="Tailwind CSS 4" />
  <img src="https://img.shields.io/badge/Web_Audio_API-Native-orange?style=flat-square" alt="Web Audio API" />
  <img src="https://img.shields.io/badge/Tests-Vitest-brightgreen?style=flat-square&logo=vitest" alt="Testes com Vitest" />
  <img src="https://img.shields.io/badge/E2E-Playwright-45ba4b?style=flat-square" alt="Testes de ponta a ponta com Playwright" />
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
6. **Jogo em Canvas 2D:** trilhos coloridos por corda, detecção de pitch em tempo real (NSDF/MPM), julgamento *Perfect / Good / Miss*, combo e pontuação, com suporte a telas de alta densidade. A pista mostra as técnicas (hammer-on, pull-off, slide, palm mute, vibrato e bend), uma **sombra-guia** que salta para a próxima nota a tocar e notas com tamanho e espaçamento que se ajustam à tela e à música.
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
- **Cadência fixa:** a análise roda cerca de 60 vezes por segundo, medidas no relógio do áudio, seja qual for a taxa de atualização da tela.

### 🎮 Jogo de Prática (Canvas Game Engine)
- Trilhos horizontais coloridos representando cada corda da guitarra, com a linha de acerto a cerca de 28% da largura da tela.
- Notas em cascata com o número da casa. O tamanho da nota acompanha a distância entre as cordas e pode ser mudado em **Aparência › Notas e cordas** (Pequeno, Normal, Grande e Enorme).
- Camada estática de rails em cache via `OffscreenCanvas` / `Path2D` para reduzir o custo de desenho, adaptada à densidade de pixels da tela (`devicePixelRatio`).
- **Começo da música:** 5 s de pista vazia com a contagem no centro da tela, que vai ficando mais discreta até a música começar, sem mudar o tamanho da pista.
- **Janela de Tolerância de Acerto:**
  - **Perfect:** de 70 ms antes a 110 ms depois da linha.
  - **Good:** de 150 ms antes a 260 ms depois da linha.
  - **Miss:** Fora da janela temporal ou nota incorreta.

#### Técnicas na pista
- **Hammer-on, pull-off e slide:** as notas ligadas na mesma corda formam um **bloco único** com um segmento por nota. A primeira (palhetada) tem o tom cheio e as seguintes, que só a mão esquerda faz, ficam mais claras, com um selo **H** (sobe), **P** (desce) ou um traço de slide na divisão. Para a nota ligada, o jogo exige a nota exata e uma mudança de nota, e não uma nova palhetada.
- **Palm mute:** um colchete tracejado com o rótulo **PM** sobre o trecho todo.
- **Vibrato:** uma onda sob a nota. **Bend:** o tamanho em tons (`↑¼`, `↑½`, `↑1`, `↑1½`); o jogo aceita a nota base ou a nota alvo.
- *Dead & Ghost Notes* e *Ties & Grace Notes* seguem sem penalidade injusta.
- Cada técnica tem forma e letra, e não depende só de cor. Em **Aparência** dá para desligar "Mostrar as técnicas" e ver a legenda dos símbolos.

#### Sombra-guia
- Uma sombra na linha de acerto salta de corda em corda e chega à próxima nota exatamente na hora de tocá-la. Num acorde ela cobre todas as notas que soam juntas.
- Dois estilos (**Sombra** e **Holograma**), três intensidades, cinco predefinições e várias opções de cor, forma, contorno, rastro e movimento, todas em **Aparência › Sombra-guia**. A opção "Preservar a nota" mantém a nota-alvo sempre legível.

#### Espaçamento e velocidade
- O espaçamento horizontal é medido em tempo de música (cerca de 4 s visíveis à frente, igual em qualquer tela), e não em pixels fixos. No modo **Auto**, trechos rápidos aproximam as notas (até 0,7×) e trechos lentos as afastam (até 1,5×), com transições suaves. Em telas estreitas a janela visível encurta para os números continuarem legíveis. Também há valores fixos.
- Velocidade de **0,25× a 2×**. O ranking e a dupla online valem sempre a 1×.
- **Prática:** metrônomo sonoro, "Som das notas" (a nota da tablatura soando junto) e modo treino, que repete o exercício sem parar.

#### Barra do jogo, atalhos e Aparência rápida
- A barra de baixo agrupa transporte, prática (velocidade, espaçamento, treino, metrônomo e som das notas), som (monitor, amp e áudio) e aparência.
- **Atalhos** (só quando o foco não está num campo, botão ou janela): `Espaço` pausa ou toca, `M` liga o metrônomo, `N` o som das notas, `A` abre a Aparência rápida e `↑` / `↓` mudam a velocidade.
- **Aparência rápida:** uma gaveta (folha no celular) que **pausa** a música, deixa mudar tema, sombra-guia, estilo e tamanho das notas, cores das cordas, efeitos e sons ao vivo e retoma com uma contagem de 3 s. "Todas as opções" abre a tela completa sem perder a partida.
- **Sons de acerto e erro** podem ser desligados em **Aparência** (o som das notas e o metrônomo não entram nisso).

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
- **Só para o E2E local (opcional):** Docker Desktop aberto e o Supabase CLI, que vem como dependência de desenvolvimento do projeto (`npx supabase`, depois do `npm install`).

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
| `npm run check:bundle` | Confere o tamanho do JavaScript em gzip depois do build: primeira carga (entrada + React) até 140 kB e todos os chunks juntos até 350 kB (o total só pesa no cache offline). Os limites estão em `scripts/check-bundle-size.mjs` |
| `npm run check:precache` | Confere no `dist` que todo chunk que precisa funcionar offline está no cache do service worker |
| `npm run test` | Executa os testes com [Vitest](https://vitest.dev): serviços, estado das telas e as migrations do banco, rodadas num Postgres isolado (PGlite) |
| `npm run preview` | Executa um servidor local para inspecionar a build de produção |
| `npm run e2e` | Testes de ponta a ponta com [Playwright](https://playwright.dev) (`e2e/`): gera a build em `dist-e2e/`, sobe o `vite preview` e abre um navegador com microfone falso, sem Supabase e sem rede fora do servidor. No Windows usa o Edge já instalado; no CI, o Chromium do Playwright (`npx playwright install chromium`) |
| `npm run e2e:supabase` | Testes de ponta a ponta do ranking, da conta e da dupla online contra um **Supabase local** em Docker (`e2e/supabase/`, `playwright.supabase.config.ts`). Precisa do Docker Desktop aberto; o script sobe `supabase start` e `supabase functions serve` se preciso e **não derruba o Docker no fim** (`-- --stop` para parar, `-- --reset` para recriar o banco). Nunca toca no projeto hospedado: ver [docs/operacao.md](docs/operacao.md), seção 12 |

---

## ⚙️ Configuração e Deploy

- **Variáveis de ambiente** (o `.env.example` explica cada uma): `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` ligam o ranking e a dupla online; `VITE_TURNSTILE_SITE_KEY` ativa a verificação contra robôs na criação de conta; `VITE_SUPPORT_URL` define o link de apoio. Só variáveis `VITE_` chegam ao navegador: nunca coloque uma chave secreta com esse prefixo.
- **Deploy:** o push na `main` publica na [Vercel](https://vercel.com). O CI do GitHub roda lint, build, `check:bundle`, `check:precache`, testes e `npm audit` a cada push na `main` e em cada pull request, e dois jobs de ponta a ponta (`e2e` e `e2e-supabase`) que, por enquanto, não bloqueiam a publicação.
- **Banco:** as migrations ficam em `supabase/migrations/` e os testes delas em `supabase/db-tests/`.
- **Operação** (inventário de serviços, plano de incidente, backup, rotação de chaves): [docs/operacao.md](docs/operacao.md).
- **Histórico de mudanças:** [CHANGELOG.md](CHANGELOG.md).

---

## 🏷️ Versões

O PRGB usa [versionamento semântico](https://semver.org/lang/pt-BR/) (`MAJOR.MINOR.PATCH`). A **1.0.0** é a primeira versão numerada e corresponde à rodada 20 do backlog; as rodadas anteriores não têm número. Daqui para frente:

- **MINOR** (1.1.0, 1.2.0…): recursos novos que não quebram nada do que já existe.
- **PATCH** (1.0.1…): correções.
- **MAJOR** (2.0.0): mudança que quebra dados salvos no navegador ou o jeito de usar o jogo.

O número marca o começo do versionamento e não é uma garantia de maturidade: o que ainda não foi testado está listado na seção "Conhecido" de cada versão.

As notas de cada versão ficam em [CHANGELOG.md](CHANGELOG.md) e nas [Releases do GitHub](https://github.com/LeonCS5/PRGB/releases), com uma tag `vX.Y.Z` por versão. O número da versão fica no `package.json`. O detalhe de cada item, com dono e status, fica em [AGENTS.md](AGENTS.md).

---

## 📂 Estrutura do Projeto

O mapa completo, arquivo por arquivo, fica em [AGENTS.md](AGENTS.md) (as regras de trabalho para quem contribui, incluindo agentes de IA, estão nele e no [CLAUDE.md](CLAUDE.md)). Em resumo:

```
PRGB/
├── src/
│   ├── components/   # Telas e componentes (jogo em canvas, modais, ranking, exercícios)
│   ├── context/      # Estado global: áudio, modais, ranking, salas, preferências
│   ├── services/     # Áudio, pitch, pontuação, exercícios, acervo, backend (cada um com seu teste)
│   └── content/      # Política de Privacidade e Termos (LGPD)
├── e2e/              # Testes de ponta a ponta (Playwright); e2e/supabase/ usa um Supabase local
├── supabase/         # Migrations, Edge Function e testes de banco
├── docs/             # Operação, aparência, trilha, sessões, repertório e revisões
├── scripts/          # Backup do banco, orçamento de bundle, precache e E2E local
└── public/           # Fontes, ícones, manifesto PWA e service worker
```

---

## 🎸 Dicas para a Melhor Experiência

1. **Use Fones de Ouvido:** Como o microfone/interface fica ativo para captura contínua, usar fones evita retorno e interferência no detector de pitch.
2. **Selecione o Canal Correto:** Se a sua guitarra estiver conectada na entrada 2 da interface USB, abra o menu **Áudio**, selecione **Canal 2 (R)** e verifique se o VU meter responde ao tocar uma corda.
3. **Afine Antes de Tocar:** Use o afinador integrado para garantir que as cordas estejam afinadas de acordo com a tablatura carregada.
4. **Teste de latência:** se quase tudo vira *Good* e quase nada *Perfect* mesmo tocando no tempo, faça o teste de latência em **Áudio**: ele mede o atraso da leitura e ajusta a pontuação. Refaça o teste se trocar de monitor ou de interface.
5. **Buffer & Latência:** O navegador usa os drivers do Windows, não ASIO, então a latência é maior que a de programas nativos. Ajuste o buffer e a compensação em **Áudio** e feche programas que usam ASIO, que podem prender a interface.

---

## 🔒 Privacidade & Segurança

- **100% Local:** Seu áudio é processado inteiramente na memória do seu navegador.
- **Sem Gravação:** Nenhum áudio é gravado ou transmitido para a rede.
- **Sem Rastreamento:** Sem anúncios, sem cookies e sem cadastro para tocar.
- **Ranking opcional:** só para maiores de 18 anos, com consentimento, conta anônima (sem e-mail nem senha) e uma verificação contra robôs da Cloudflare antes de criar a conta. Detalhes na Política de Privacidade do site.

---

## 📄 Licença

O código-fonte está público para consulta, mas ainda não tem licença de uso: todos os direitos reservados a Leonam Candido, exceto as bibliotecas e fontes de terceiros, que seguem as próprias licenças (veja `/licencas-terceiros.md` no site). Tablaturas e metadados musicais vêm de um provedor externo, sem afiliação com o PRGB.
