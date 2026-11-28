# Changelog

O histórico detalhado, com dono e status de cada item, fica em [AGENTS.md](AGENTS.md) › Problemas Conhecidos. Este arquivo resume cada versão.

As versões seguem o [versionamento semântico](https://semver.org/lang/pt-BR/). A **1.0.0** é a primeira versão numerada e corresponde à rodada 20 (as rodadas 1 a 19, abaixo, não têm número nem tag). Daqui para frente, MINOR (1.1.0…) traz recursos novos, PATCH (1.0.1…) traz correções e MAJOR (2.0.0) marca uma mudança que quebra dados salvos ou o uso do jogo.

## [1.0.0] — 2026-11-28 (rodada 20)

Pista, técnicas, sombra-guia, começo da música, barra do jogo e testes de ponta a ponta.

### Adicionado
- **Técnicas na pista:** hammer-on, pull-off e slide viram um **bloco único** segmentado (um segmento por nota, com selo H, P ou slide na divisão); palm mute com um colchete "PM" sobre o trecho; vibrato em onda; bend com o tamanho (`↑¼`, `↑½`, `↑1`, `↑1½`). Forma e letra além da cor, opção "Mostrar as técnicas" e legenda dos símbolos na Aparência.
- **Sombra-guia:** salta de corda em corda e chega à nota exatamente na hora de tocá-la, cobrindo todas as notas de um acorde. Estilos Sombra e Holograma, três intensidades, cinco predefinições (Discreta, Destaque, Cinema, Contorno e Neon), muitas opções de forma, cor, contorno, rastro e movimento e "Preservar a nota", que a mantém atrás da nota-alvo.
- **Tamanho das notas** (Pequeno 80%, Normal 100%, Grande 125%, Enorme 150%) e cartão **Espaçamento** com o modo Auto.
- **Sons de acerto e erro** que podem ser desligados (o som das notas e o metrônomo não entram).
- **Começo da música:** 5 s de pista vazia, com a contagem no centro da tela perdendo opacidade até a música começar, sem mudar a altura da pista.
- **Barra do jogo reorganizada** em grupos, com atalhos (`Espaço`, `M`, `N`, `A`, `↑` e `↓`), cartões de Velocidade e Espaçamento e aviso rápido sobre a pista.
- **Aparência rápida durante a música:** uma gaveta (folha no celular) que pausa o jogo, mostra as opções ao vivo e retoma com uma contagem de 3 s; "Todas as opções" abre a tela cheia sem perder a partida.
- **Velocidades de 0,25× a 2×** (o ranking e a dupla online valem a 1×).
- **Testes de ponta a ponta:** `npm run e2e` (Playwright, 31 testes) e `npm run e2e:supabase` (ranking, conta e dupla online contra um Supabase local em Docker, 8 testes, sem tocar a produção). O Supabase CLI entrou como dependência de desenvolvimento.

### Alterado
- **Espaçamento das notas:** passou a ser medido em tempo de música (cerca de 4 s à frente, igual em qualquer tela), e não em pixels fixos. A pista andava na velocidade ao quadrado; agora a velocidade só muda a rapidez. O modo Auto aproxima as notas nos trechos rápidos (até 0,7×) e as afasta nos lentos (até 1,5×), com transições de 1,5 s; um piso de legibilidade encurta a janela visível em telas estreitas.
- **Linha de acerto proporcional** à largura da tela (cerca de 28%).
- **Medidas relativas:** o canvas e as telas passaram a usar frações da nota, da corda e `rem`, no lugar de pixels fixos. A fonte base cresce a partir de 2200 px e o jogo ganhou um layout próprio para janelas baixas.
- **Julgamento de notas ligadas:** a nota de destino de um hammer-on, pull-off ou slide não exige nova palhetada, mas exige a nota exata, uma mudança de nota confirmada por duas leituras seguidas e tem 60 ms a mais de tolerância no fim. As janelas Perfect e Good e a pontuação das notas normais não mudaram.
- **Cadência fixa de 60 Hz** na análise do pitch, no relógio do áudio: em telas de 144 e 165 Hz ela rodava até 2,7 vezes mais e inflava os ataques falsos (de 23 a 24 para 13 a 18 numa palhetada a cada 0,5 s, medido com microfone falso). Quem tem tela acima de 60 Hz deve refazer o teste de latência.
- **Sincronia:** o som de guia e o metrônomo são agendados no relógio do `AudioContext`, descontam a latência de saída e são cancelados ao pausar e ao buscar.
- **Desempenho:** o relógio da música saiu do estado do React (de cerca de 190 para cerca de 4 renders por segundo tocando); o desenho e o som de guia não alocam mais por quadro.
- **Aparência:** trocar de tema preserva a sombra-guia, o tamanho das notas, as técnicas e os sons; abas abertas ao mesmo tempo passam a se acompanhar.
- **Telas fora do jogo** (revisão em `docs/ux-revisao.md`): "Tocar de novo" em primeiro no resultado, "Conectar guitarra" como ação principal no Play Free e no painel de Áudio, textos do Amp em português, alvos de 44 px, "Progresso" no menu e dica do que falta no "Continuar" da dupla.
- **Orçamento de bundle:** o total de todos os chunks passou de 340 para 350 kB (só pesa no cache offline); a primeira carga continua em 140 kB.

### Corrigido
- Clicar num interruptor da Aparência rolava a página inteira e deixava uma área vazia (o campo oculto do interruptor não tinha posição relativa).
- Trocar de tema apagava a sombra-guia configurada.
- O aviso de rota de áudio e a legenda da primeira partida cobriam a pista e mudavam o tamanho dela.
- Em janelas baixas e telas grandes a pista ficava pequena ou com texto minúsculo.

### Segurança e operação
- A chave pública do Supabase no site publicado passou da `anon` legada (JWT) para a **chave publicável**, em Production e Preview, conferida pelo conteúdo do bundle. A chave legada continua ativa para observação (pelo menos 7 dias) antes de ser desativada; o passo a passo e o rollback estão em `docs/operacao.md` seção 7.1. O teste no site publicado (conta, partida ranqueada, placar e dupla) ainda é manual.
- Nada mudou no banco, nas políticas de acesso, na pontuação máxima aceita pelo servidor nem no que sai do dispositivo. Nenhuma chave foi adicionada a arquivos versionados.

### Conhecido
- **O jogo ainda não foi testado com guitarra e interface de áudio reais**, nem no Firefox, no Safari ou em celular físico, nem com leitor de tela de verdade. Os testes usam sinais sintéticos, microfone falso e o Edge no Windows. O número 1.0.0 marca o início do versionamento, não uma garantia de maturidade.
- Notas erradas ainda pontuam mais do que deveriam em alguns exercícios de técnica (a origem de um slide aceita as alturas do caminho, `slideRange`).
- O envio da pontuação ao ranking não tem limite de tempo (a tela fica em "Enviando…" com rede ruim).
- Um zumbido de rede elétrica (50 ou 60 Hz) pode ser lido como uma nota grave.
- O botão Voltar do navegador sai de uma partida em andamento sem pedir confirmação.
- Falha ao carregar um pedaço do site pela primeira vez recarrega a página sem avisar, e há casos de tela em branco quando falha um arquivo essencial.
- O som de guia e o metrônomo ainda podem sair do tempo quando a velocidade não é 1×.
- A sombra-guia no estilo Sombra é pesada em algumas telas, e o rodapé do jogo ainda aperta em janelas muito baixas.
- Os primeiros 5 commits desta rodada são experimentos de perspectiva 3D e permanecem no histórico como estão.

## Rodada 19 — revisão crítica

- Seis revisores independentes, só leitura, fizeram uma revisão crítica do projeto: 89 achados (nenhum de segurança crítico ou alto), com dono por área, em `docs/revisao-critica.md`. As correções saíram em seis branches por área.
- Segurança e documentação: o backup local do banco passou a guardar 7 dias e a excluir `play_sessions`; o `image` do meta do acervo é validado antes de entrar no caminho do CDN; os textos que o anfitrião envia na dupla online passam pelo mesmo filtro dos links de desafio (caracteres de controle, links e termos bloqueados); README reescrito em torno de exercícios, trilha, repertório e sessões, sem alegações sem prova; metadados do `index.html` sem "tablaturas" como foco; documentos de identidade marcados como histórico; mapas de arquivos do AGENTS.md e do CLAUDE.md atualizados. Riscos aceitos e procedimentos (moderação, rate limit, cotas) em `docs/operacao.md` seção 11.
- Jogo: confirmação ao sair de uma partida em andamento, legenda da primeira partida, velocidade/metrônomo/sintetizador/treino mantidos entre os exercícios de uma sessão, timeout de 10 s no ranking sem travar o Tocar (a verificação automática é silenciosa e não abre modal), treino sem notas perdidas na virada da volta, textos de erro e botões mais claros, alvos de 44 px. Criar a conta pelo placar com o resultado aberto não apaga mais o resultado.
- Áudio: o PRGB detecta a interface USB desconectada durante a sessão (para o áudio e avisa, em vez de marcar tudo como Errou); saída indisponível mostra aviso; o microfone deixa de vazar se a abertura falha; limiar de volume mínimo volta a 0,02; o Play Free não re-renderiza a cada quadro. No rack do amp, alegações e nomes de preset e gabinete foram trocados por termos neutros; no painel de Áudio, ASIO, buffer e compensação são explicados.
- Interface: "Tocar agora" pede o microfone; landing em três grupos (Aprender, Praticar, Tocar músicas) com "O que você precisa"; nomes padronizados (Conectar áudio, Montar sessão, Meu progresso, Trilha, Repertório, Buscar músicas); critério das estrelas e da precisão sempre à vista; repertório marca "Vale para o ranking"; falha ao carregar uma tela lazy mostra "Tentar de novo" (e um reload único em `vite:preloadError`); rótulos de Aparência em português; tons com a grafia certa (Db, não C#).
- Conteúdo: tons grafados pela armadura (Db, C#m…); exercícios de nível 1 e 2 só até a casa 20; a trilha passou a 154 passos em 16 etapas (progressões com pestana só depois da etapa de pestana; cordas 6 a 2 e o exercício 141 entraram); "Brilha, brilha, estrelinha" creditada como tradicional; textos em cifra e com "casa", glossário e contagem falada nos ritmos.
- Engenharia: o service worker não regrava mais o index no cache de uma versão antiga (offline abria em branco após um deploy) e a navegação cai para o cache em 3,5 s; ícone maskable no precache; manifest sem `orientation`; o build falha se um chunk lazy de `src/components` ou `src/content` ficar fora do precache e `npm run check:precache` confere o `dist` no CI; chunk do Supabase com nome fixo (`supabase-*`); CI em Node 22 e 24; patches de supabase-js, react, vite e vitest.
<!-- rodada 19: outros agentes -->

## Rodada 18 — todas as variações de um exercício

- Biblioteca de exercícios: no topo, "Ao tocar um cartão" escolhe entre "Só esta variação" e "Todas as variações em sequência" (os 12 tons e todos os jeitos de tocar, um depois do outro, via sessão de prática). No segundo modo, cada cartão diz "N variações em sequência · X min" e o clique toca a sequência, com "Começar no tom" e "Quantos tons" (só este, 3, 6 ou 12; padrão 3). Não há botão extra em cada cartão.
- Na sessão, um exercício vai direto para o próximo, sem resultado nem menu no meio (termina 800 ms depois da última nota, não no fim do compasso; a contagem entre exercícios é de 3 s). Os resultados aparecem só no fim, com a lista de cada exercício.

## Rodada 17 — primeira carga menor e ranking automático

- O jogo, o Play Free, a dupla online e os modais (áudio, amp, busca, latência, relato, ranking) saíram do pacote de entrada e carregam ao abrir; seguem no cache offline. Primeira carga (entrada + React): 186 kB para 126 kB gzip. O orçamento agora limita a primeira carga (140 kB) e a entrada (75 kB); o total (340 kB) só vale para o cache offline.
- Ranking: quem tem conta joga sempre valendo, sem chave para ligar (nas peças que o ranking aceita); sem conta, um botão discreto leva à criação da conta, e criar a conta no meio do jogo já liga o ranking. Cenas de DEV `ranking-automatico` e `ranking-sem-conta`.

## Rodada 16 — sessões de prática

- Sessão de prática: exercícios em sequência, sem voltar ao menu, montada por etapa da trilha, por tempo (10, 15 ou 20 min) ou à mão; com "rodar os tons" (3, 6 ou 12) e "todos os jeitos de tocar" para deixar cada exercício mais longo. Detalhes em `docs/sessoes.md`.

## Rodada 15 — trilha de evolução e landing

- Trilha de evolução: 148 passos em 15 etapas (hoje 154 em 16, ver Rodada 19), do primeiro som ao material mais difícil, com estrelas e "Continue daqui"; nada fica bloqueado. A pesquisa e os critérios estão em `docs/trilha.md`.
- 58 exercícios novos (a biblioteca passou de 96 para 154 e de 1.891 para 3.339 variantes).
- Busca no acervo na primeira tela e no menu; landing reorganizada em "O que você quer tocar?".

## Rodada 14 — repertório próprio, progresso, acervo experimental e aparência

- Peças novas no repertório (Greensleeves, Minueto em Sol, Brilha brilha estrelinha e seis originais), marcadas "Em revisão" até alguém tocar.
- Tela Meu progresso, orçamento de bundle no CI e `register-part` somente leitura (publicada no Supabase em 2026-11-17).
- Repertório próprio de domínio público (offline), progresso local (estrelas, palhetas, ensaio da semana) e acervo externo como extra experimental, com chave para desligá-lo; o ranking só aceita conteúdo semeado no banco.
- Aparência: seis temas, estilos de nota, cordas, efeitos opcionais, estilos de componentes, tipografias e fundos, salvos só no navegador. Entram na exportação e na exclusão dos dados locais e na Política (sem mudar `LEGAL_VERSION`). Brilho do COMBO no HUD. Repertório, fontes IBM Plex e tela de Aparência no cache offline.

## Rodada 13 — endurecimento (auditoria de um checklist de software)
- Tela de recuperação em vez de página branca quando uma tela quebra; CI no GitHub (lint, build, testes e `npm audit`); Dependabot.
- Documentação de operação: inventário, plano de incidente, backup e rotação de chaves (`docs/operacao.md`).

## Rodada 12 — CAPTCHA na entrada do ranking
- Verificação contra robôs (Cloudflare) antes de criar a conta anônima; Política e Termos atualizados.

## Rodada 11 — modo treino
- Repetição contínua dos exercícios.

## Rodada 10 — exercícios e contagem
- Biblioteca de 96 exercícios (1.891 variantes), contagem de 5 s, acordes pontuados pela tônica, teste de latência, janelas de acerto assimétricas.

## Rodada 9 — navegação
- Menu e abas, Voltar do navegador em camadas, cartão "Continuar", painel de Áudio.

## Rodadas 1 a 8
- Fundação de áudio e parser, metrônomo, testes e PWA, ranking e Edge Function, dupla online, Play Free, rota de áudio, Firefox, conformidade e som neural. Detalhes em AGENTS.md.
