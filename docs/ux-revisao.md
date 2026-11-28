# Revisão de UX das telas (fora do jogo e da Aparência)

Data: 2026-11-27. Método: capturas no Edge (headless, microfone falso) em 1366×768, 1920×1080, 2560×1440 e 390×844 de landing, navegação, Exercícios, Trilha, Repertório, Sessão, Progresso, Play Free, Áudio, Amp, Teste de latência, Reportar problema, Dupla, Ranking (lista, vazio, entrada, conta), Resultado, páginas legais, 404 e busca; mais medição de alvos de toque e leitura do código. As imagens ficam fora do repositório (pasta de trabalho do revisor); este arquivo guarda só as conclusões.

Escopo: tudo, menos o jogo (`PracticeGame` e seus controles) e a tela de Aparência (só relato).

## Resumo

A base é sólida: caminho principal claro na landing ("Tocar agora" + "Buscar"), vocabulário em pt-BR, tokens PRGB consistentes, estados vazios com texto útil. Os problemas se concentram em onboarding do áudio (jargão e rótulos), ação principal fraca em alguns pontos, alvos de toque abaixo de 44 px e restos em inglês no Amp.

Legenda: **Feito** = corrigido nesta rodada. Esforço: B baixo, M médio, A alto.

## P0 — bloqueia ou confunde o caminho principal

| # | Achado | Onde | Esforço | Estado |
|---|---|---|---|---|
| 1 | Resultado de partida: "Tocar de novo" (ação principal) ficava depois de três botões secundários, abaixo da dobra em 1366×768. | `ResultPanel.tsx` | B | **Feito**: principal e "Escolher outra" agora vêm primeiro; ranking e desafio depois. |
| 2 | Play Free sem guitarra conectada: "Conectar guitarra" tinha o mesmo peso de "Limpar" e "Áudio", e a tela inteira mostra só traços. | `FreePlay.tsx` | B | **Feito**: botão principal (laranja) enquanto desconectado. |
| 3 | Painel de Áudio: botão "Conectar / tentar novamente" confunde quem nunca conectou (parece erro). | `AudioSettingsModal.tsx` | B | **Feito**: "Conectar guitarra"; "Tentar novamente" só depois de um erro. |

## P1 — atrito claro, correção barata

| # | Achado | Onde | Esforço | Estado |
|---|---|---|---|---|
| 4 | "Caminho do som" usa "GATE / Aberto / Fechado": jargão sem explicação; nome da saída truncado sem dica. | `AudioRoutePanel.tsx` | B | **Feito**: "RUÍDO · Passando/Cortado" e `title` com o nome inteiro. |
| 5 | Amp: nomes e textos em inglês ("Modern Metal", "Liquid Solo Lead", "Acoustic Simulator", "Direct Monitor (Raw DI)", "TONE STACK", "VU Meter", "Bypass Cab Sim"), contra a regra de UI toda em pt-BR. | `AmpRack.tsx`, `ampEngine.ts` (só os textos `name`) | B | **Feito**. Os ids dos modelos e a cadeia DSP não mudaram. |
| 6 | Amp abre com o modelo neural (.nam, avançado) acima dos modelos de uso comum. | `AmpRack.tsx` | B | **Feito**: foi para o fim, antes do medidor. |
| 7 | Botão de arquivo nativo do modelo neural cortado ("N…ido"), parecia quebrado. | `NeuralAmpSection.tsx` | B | **Feito**: botão próprio "Escolher/Trocar", entrada nativa oculta com `relative` e foco visível. |
| 8 | Dupla (passo 1): "Continuar" desligado sem dizer por quê. | `DuoSetupModal.tsx` | B | **Feito**: dica ligada por `aria-describedby` enquanto não há 2 canais. |
| 9 | Alvos abaixo de 44 px: links do rodapé e "Reportar problema" (32 px), índice das páginas legais (28 px). | `App.tsx`, `LegalPage.tsx` | B | **Feito**. |
| 10 | Cabeçalho em 2560 px: "Meu progresso" quebrava em duas linhas. | `SiteNav.tsx` | B | **Feito**: rótulo "Progresso" sem quebra (o nome acessível continua "Meu progresso"). |
| 11 | Ranking vazio ("Ninguém pontuou… Seja o primeiro!") não oferece a ação (entrar no ranking ou tocar). | `LeaderboardModal.tsx` | B | Aberto. |
| 12 | Tela de entrada no ranking: cinco itens legais antes do campo de apelido; o campo some abaixo da dobra em 1366×768. | `RankingEntryModal.tsx` | M | Aberto; texto legal é decisão sua (ver adiante). |
| 13 | Inputs de rádio/checkbox da Sessão com 20×20 px visíveis (o cartão inteiro clica, mas o alvo visual é pequeno). | `SessionScreen.tsx` | B | Aberto, baixo impacto. |

## P2 — melhorias de produto ou de acabamento

- **Ícones sem texto no cabeçalho** abaixo de 1536 px (progresso, aparência, conta, apoio): só têm `title`, que não existe em toque. Alternativa: mostrar o texto a partir de `xl` para "Progresso" e "Aparência" (cabe a 1366 px se "Apoiar" ficar só ícone). Esforço B/M.
- **Barra de abas do celular** não alcança Trilha, Modos (Play Free, dupla) nem Aparência/Progresso; só pela landing. Avaliar uma aba "Mais" (M).
- **Emojis como ícones** nos modelos de amp (⚡🔥🎸🚀🌿) destoam dos ícones de linha (lucide). Os `badge` também aparecem no jogo (M, toca em `ampEngine.ts`).
- **Landing**: o cartão "O que você precisa" aparece antes de qualquer ação de conexão; a primeira visita poderia ganhar um passo "1. Conectar áudio" visível junto do "Tocar agora" (decisão de produto).
- **Painel de Áudio**: o aviso de segurança elétrica (amarelo) abre o painel; mantido por segurança, mas o primeiro olhar de um iniciante cai nele em vez da ação "Conectar" (A: reorganizar em abas "Conectar / Timbre / Afinador").
- **Contraste**: textos `text-ink-400` de 10 px no Amp (legendas das regulagens) ficam abaixo do confortável; subir para 11–12 px e `ink-300` (B).
- **Escala em telas grandes** (2560+): o conteúdo cresce com a fonte raiz (rodada de responsividade), mas o canvas do jogo não; fora deste escopo.

## Decisões de produto que ficam com você

1. Mover o texto legal da entrada do ranking para um bloco recolhível ("Ler como tratamos seus dados") deixaria o apelido visível, mas toca em consentimento (LGPD, `src/content/legal.ts`). Não alterei.
2. Aba "Mais" na barra do celular x manter só pela landing.
3. Trocar os emojis dos modelos de amp por ícones: afeta também o rótulo no jogo.
4. Reorganizar o painel de Áudio em abas ou etapas guiadas (onboarding de primeira vez).

## Não verificado

Leitor de tela e teclado de ponta a ponta; Firefox e Safari; celular físico; fluxo real de permissão do microfone (usei microfone falso, que concede sozinho); dupla online e fluxo de conta com Supabase real; o contraste de cada tema da Aparência.
