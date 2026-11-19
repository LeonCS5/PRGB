# Changelog

O histórico detalhado, com dono e status de cada item, fica em [AGENTS.md](AGENTS.md) › Problemas Conhecidos. Este arquivo resume cada rodada. As versões passam a ser marcadas com tags (`v0.N.0`, uma por rodada) a partir da rodada 13.

## Rodada 19 — revisão crítica

- Seis revisores independentes, só leitura, fizeram uma revisão crítica do projeto: 89 achados (nenhum de segurança crítico ou alto), com dono por área, em `docs/revisao-critica.md`. As correções saíram em seis branches por área.
- Segurança e documentação: o backup local do banco passou a guardar 7 dias e a excluir `play_sessions`; o `image` do meta do acervo é validado antes de entrar no caminho do CDN; os textos que o anfitrião envia na dupla online passam pelo mesmo filtro dos links de desafio (caracteres de controle, links e termos bloqueados); README reescrito em torno de exercícios, trilha, repertório e sessões, sem alegações sem prova; metadados do `index.html` sem "tablaturas" como foco; documentos de identidade marcados como histórico; mapas de arquivos do AGENTS.md e do CLAUDE.md atualizados. Riscos aceitos e procedimentos (moderação, rate limit, cotas) em `docs/operacao.md` seção 11.
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

- Trilha de evolução: 148 passos em 15 etapas, do primeiro som ao material mais difícil, com estrelas e "Continue daqui"; nada fica bloqueado. A pesquisa e os critérios estão em `docs/trilha.md`.
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
