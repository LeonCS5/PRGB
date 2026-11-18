# Changelog

O histórico detalhado, com dono e status de cada item, fica em [AGENTS.md](AGENTS.md) › Problemas Conhecidos. Este arquivo resume cada rodada. As versões passam a ser marcadas com tags (`v0.N.0`, uma por rodada) a partir da rodada 13.

## Rodada 17 — primeira carga menor e ranking automático

- O jogo, o Play Free, a dupla online e os modais (áudio, amp, busca, latência, relato, ranking) saíram do pacote de entrada e carregam ao abrir; seguem no cache offline. Primeira carga (entrada + React): 186 kB para 126 kB gzip. O orçamento agora limita a primeira carga (140 kB) e a entrada (75 kB); o total (340 kB) só vale para o cache offline.
- Ranking: quem tem conta joga sempre valendo, sem chave para ligar (nas peças que o ranking aceita); sem conta, um botão discreto leva à criação da conta, e criar a conta no meio do jogo já liga o ranking. Cenas de DEV `ranking-automatico` e `ranking-sem-conta`.

## Rodada 16 — sessões de prática

- Sessão de prática: exercícios em sequência, sem voltar ao menu, montada por etapa da trilha, por tempo (10, 15 ou 20 min) ou à mão; com "rodar os tons" (3, 6 ou 12) e "todos os jeitos de tocar" para deixar cada exercício mais longo. Detalhes em `docs/sessoes.md`.

## Rodada 15 — trilha de evolução e landing

- Trilha de evolução: 148 passos em 15 etapas, do primeiro som ao material mais difícil, com estrelas e "Continue daqui"; nada fica bloqueado. A pesquisa e os critérios estão em `docs/trilha.md`.
- 58 exercícios novos (a biblioteca passou de 96 para 154 e de 1.891 para 3.339 variantes).
- Busca no acervo na primeira tela e no menu; landing reorganizada em "O que você quer tocar?".

## Rodada 14 — repertório próprio, progresso, acervo experimental e aparência

- Peças novas no repertório (Greensleeves, Minueto em Sol, Brilha brilha estrelinha e seis originais), marcadas "Em revisão" até alguém tocar.
- Tela Meu progresso, orçamento de bundle no CI e `register-part` somente leitura (a função publicada precisa ser atualizada pelo painel do Supabase).
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
