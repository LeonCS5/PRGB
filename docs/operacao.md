# Operação do PRGB

Guia para quem mantém o site em produção. Não contém segredos nem e-mails de contas: eles ficam nos próprios painéis e no cofre de senhas do responsável.

> O que está marcado como **(a confirmar)** não foi verificado nos painéis nem na documentação do fornecedor quando este texto foi escrito. Confira antes de depender dele.

## 1. Inventário de serviços

| Serviço | Para quê | Plano | Dono |
|---|---|---|---|
| GitHub, repositório `LeonCS5/PRGB` | Código (público), CI | Free | Leonam Candido |
| Vercel, projeto `prgb` | Site estático, rewrites do acervo, deploy | Hobby | Leonam Candido |
| Supabase, projeto de São Paulo | Auth anônimo, RPCs, Edge Function `register-part`, Realtime, pg_cron | Free | Leonam Candido |
| Cloudflare Turnstile, widget `PRGB` | CAPTCHA na criação de conta | Grátis | Leonam Candido |
| Provedor de tablaturas | Conteúdo das músicas | Sem contrato | Risco legal conhecido (AGENTS.md › Pendências) |
| E-mail de contato (Gmail) | Só recebe: titulares da LGPD e relatos que falharam | Grátis | Leonam Candido |

Hoje uma única pessoa é dona de tudo. Isso é um ponto único de falha (seção 8).

## 2. Segurança das contas

- MFA ligado no GitHub, na Vercel, no Supabase e na Cloudflare. Declarado pelo dono em 2026-11-10; revisar a cada 6 meses.
- Códigos de recuperação do MFA e a lista de contas ficam num cofre de senhas, fora do repositório.
- Nenhuma chave no repositório (ele é público). O `.gitignore` cobre `.env*`.
- Tokens de ferramentas (CLI da Vercel, agentes): revogar nos painéis quando deixarem de ser usados; revisar a lista a cada 3 meses.
- Segredos que já existiram sem uso na Vercel (service role, senha do Postgres, segredo do JWT) foram removidos em 2026-11-10. Se a integração Supabase↔Vercel for reinstalada, ela os recria: remova de novo.

## 3. Configuração

**Variáveis na Vercel (Production):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_TURNSTILE_SITE_KEY`; opcional `VITE_SUPPORT_URL`. Só variáveis `VITE_` chegam ao navegador. A Edge Function usa os segredos do próprio Supabase e `ALLOWED_ORIGINS`.

**Supabase Auth (painel):** entrada anônima ligada; provedor de e-mail e demais desligados; CAPTCHA Turnstile ligado (Authentication › Attack Protection). Rate limits em 2026-11-10: contas anônimas 30 por hora por IP, renovação de sessão 150 por 5 minutos por IP. Se jogadores atrás do mesmo IP (escola, casa) não conseguirem entrar no ranking, o primeiro número a subir é o das contas anônimas.

**Ambientes:** existe um só projeto Supabase, o de produção. Previews da Vercel e o `.env.local` apontam para ele. Mitigação: os testes de banco rodam em PGlite isolado, e testes manuais usam contas temporárias que são apagadas. Ideal: um segundo projeto gratuito para previews e desenvolvimento.

## 4. Deploy e reversão

- **Site:** push na `main` publica na Vercel em cerca de 1 minuto. O CI do GitHub roda lint, build, testes e `npm audit` a cada push na `main` e em cada pull request.
- **Conferir o deploy:** compare o nome do bundle `assets/index-*.js` do site com o log do build (`vercel inspect <url> --logs`). O status 200 sozinho não prova nada: o último rewrite devolve a página para quase qualquer caminho.
- **Reverter:** Vercel › Deployments › escolher um deploy anterior › Promote to Production. A Vercel guarda os 10 últimos por 30 dias.
- **Banco:** as migrations de `supabase/migrations/` foram aplicadas à mão pelo SQL Editor, e o histórico remoto não bate com os arquivos (faltam `room_realtime` e `feedback`, e as versões têm números diferentes). Antes de qualquer `supabase db push`, alinhe o histórico com `supabase migration repair --status applied <versão>` para cada migration já aplicada. Sem isso, o `db push` tentaria reaplicar tudo.
- **Edge Function:** `supabase functions deploy register-part`.

## 5. Backup e restauração

O plano Free do Supabase **não** faz backup baixável. O procedimento é manual:

1. Semanalmente, rode `scripts/backup-db.sh` (veja o cabeçalho do script). Ele gera `schema-*.sql` e `data-*.sql` numa pasta **fora** do repositório e apaga as cópias com mais de **7 dias**. O dump de dados **exclui `public.play_sessions`** (`-x public.play_sessions`): a Política guarda essa tabela por 7 dias, e um backup de 30 dias a contradiria.
2. As cópias contêm apelidos e pontuações (dado pessoal): guarde-as criptografadas e nunca no repositório. O prazo de 7 dias do script alinha o backup local ao que a Política promete para `play_sessions`; a Política cita só os backups do próprio Supabase, "em poucos dias". **Decisão do dono:** se quiser manter backups locais por mais tempo, isso precisa constar na Política (o que sobe `LEGAL_VERSION`). O texto legal não foi alterado.
3. Restaurar: crie um projeto Supabase novo, aplique as migrations em ordem e carregue o `data-*.sql`. **A cobertura do schema `auth` (as contas anônimas) não foi verificada:** a documentação do Supabase indica que o dump de dados pode incluir `auth.users`, e é preciso ensaiar a restauração para saber se os UUIDs voltam e se o ranking reencontra os jogadores. Enquanto isso não for ensaiado, trate a cópia como contendo dados pessoais além dos apelidos e não conte com ela para devolver as contas.
4. Metas (não ensaiadas): perder no máximo 7 dias de dados; voltar em algumas horas. **Pendente:** ensaiar uma restauração num projeto descartável. Como `play_sessions` fica fora do dump, o restaurado não terá sessões em andamento; isso é aceitável (são descartáveis em 7 dias).

## 6. Plano de incidente

**Gravidade 1** (dado pessoal exposto, chave vazada, acesso indevido): siga os passos 1 a 5. **Gravidade 2** (ranking ou salas fora do ar, abuso de contas): passos 1 e 4. **Gravidade 3** (defeito sem risco): backlog normal.

1. **Conter.**
   - Desligar o online sem tirar o jogo do ar: na Vercel, remover `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` e publicar de novo. O jogo, os exercícios e o Play Free seguem funcionando.
   - Ou, no Supabase, desligar "Allow anonymous sign-ins" (Authentication › Sign In / Providers): ninguém novo entra; quem já tem conta continua.
   - Último recurso: pausar o projeto Supabase (Project Settings › General).
   - Sob ataque: Vercel › Firewall › Attack Challenge Mode.
2. **Revogar chaves** (seção 7) e, se uma sessão vazou, tratar a conta afetada.
3. **Preservar evidências** antes de mexer: exporte os logs do Supabase e da Vercel na hora, porque a retenção no plano gratuito é curta.
4. **Avaliar:** que dados, de quantas contas (o PRGB guarda só apelido, pontuações e datas) e por quanto tempo.
5. **Comunicar:** havendo risco ou dano relevante aos titulares, avisar a ANPD e os titulares (LGPD, art. 48). Prazo para a ANPD: 3 dias úteis pela Resolução CD/ANPD nº 15/2024 **(a confirmar no site da ANPD)**. Avisar também no site (faixa na landing) e por e-mail a quem escreveu. Responsável: o controlador, que acumula a função de encarregado (contato público na Política de Privacidade).
6. **Depois:** nota sem culpados em `docs/incidentes/AAAA-MM-DD.md` com o que aconteceu, a causa, o que funcionou e o que mudar.

Modelo de aviso curto: "Em [data], identificamos [o que ocorreu]. Foram afetados [quais dados, de quantas pessoas]. Já [o que foi feito]. Recomendamos [o que a pessoa deve fazer]. Dúvidas: [e-mail do encarregado]."

## 7. Rotação de chaves

- **Chave pública do Supabase (`anon`):** migrar para a chave publicável (`sb_publishable_...`) seguindo o runbook da seção 7.1. O bundle de produção ainda usa a chave legada (JWT).
- **Segredo do Turnstile:** Cloudflare › Turnstile › `PRGB` › Rotate secret, colar o novo em Supabase › Authentication › Attack Protection e testar criando uma conta pelo site.
- **Sessões e chaves de assinatura do JWT:** rotacionar uma chave não encerra sessões, porque a chave anterior segue válida até ser revogada. Para invalidar tokens já emitidos é preciso **revogar** a chave antiga (Authentication › JWT Signing Keys) ou excluir as contas afetadas. O efeito sobre contas anônimas não foi testado: teste com uma conta descartável antes de depender disso num incidente, e leia a documentação de signing keys do Supabase.

### 7.1 Runbook: migrar da chave `anon` legada para a chave publicável

**Situação (conferida na documentação do Supabase, guia "Migrating to publishable and secret API keys", em 2026-11-27):** as chaves legadas `anon` e `service_role` seguem funcionando junto com as novas; o guia diz "até o fim de 2026", mas páginas mais recentes e terceiros falam em início de 2027 **(prazo não confirmado: tratar como fim de 2026)**. A chave publicável tem os mesmos privilégios da `anon`, então as políticas de RLS se comportam igual, e o login do jogador (JWT próprio do usuário) não muda.

**O que o código já faz (nada a mudar no repositório):**
- `VITE_SUPABASE_ANON_KEY` é só uma string repassada ao `createClient`; nenhum código valida formato JWT. O nome da variável fica; só o valor muda.
- `register-part` já lê `SUPABASE_SECRET_KEYS` (chave secreta nova) e cai em `SUPABASE_SERVICE_ROLE_KEY`. Só lê `song_parts` e `profiles` e valida o token do jogador com `auth.getUser`.
- A CSP não muda (mesmo host do Supabase).

**Risco principal: `verify_jwt` da `register-part`.** A verificação embutida da plataforma só entende chaves JWT legadas. O app chama a função com o token de sessão do jogador (um JWT de verdade) em `Authorization`, e a chave publicável vai no cabeçalho `apikey`; em princípio isso passa. **Não foi testado**: a documentação recomenda `verify_jwt = false` só para quem envia a chave nova em `Authorization`. Se o teste do passo 4 falhar com `Invalid JWT`, a saída é `verify_jwt = false` em `supabase/config.toml` e republicar a função; isso é seguro aqui porque `handler.ts` já exige o `Authorization: Bearer` e valida o token com `auth.getUser` (conta apagada é recusada). Faça isso **só** se o teste falhar, e teste de novo.

**Atualização (2026-11-27): a combinação foi testada no Supabase local** (CLI 3.4.0, `verify_jwt = true` como em `supabase/config.toml`): o app com a **chave publicável** em `apikey` e o JWT do jogador em `Authorization` chamou a `register-part` e recebeu 200, numa partida ranqueada completa (`e2e/supabase/ranking.e2e.ts`). Isso reduz o risco do passo 4, mas **não prova a produção**: o gateway hospedado pode se comportar diferente. O teste do passo 6 com conta real continua necessário.

**Passo a passo (feito pelo humano, nesta ordem):**
1. **Painel do Supabase › Project Settings › API Keys:** criar a chave publicável (aba "Publishable and secret API keys"). Copiar só a publishable. Não apagar nem desativar a legada ainda.
2. **Teste local:** em `.env.local`, trocar o valor de `VITE_SUPABASE_ANON_KEY` pela publicável, `npm run dev`, criar uma conta de teste no ranking (consentimento 18+), jogar o exercício original ranqueado, abrir o placar, criar e entrar numa sala de dupla (dois navegadores). Voltar o `.env.local` se algo falhar.
3. **Vercel › Settings › Environment Variables:** trocar `VITE_SUPABASE_ANON_KEY` pela publicável, primeiro só em **Preview** (as previews são protegidas por login; ver a seção 4). Fazer o deploy de uma branch e repetir os testes do passo 2 no endereço da preview, incluindo a chamada que passa pela Edge Function `register-part` (abrir a Ode à Alegria/exercício original ranqueado para o jogo registrar a faixa).
4. **Conferir a função:** nos logs da Edge Function (Supabase › Edge Functions › `register-part` › Logs) não pode haver 401 `Invalid JWT` nas chamadas novas. Se houver, aplicar o ajuste de `verify_jwt` descrito acima.
5. **Produção:** trocar o valor em **Production** na Vercel e fazer um novo deploy (variáveis `VITE_` são embutidas no build, então só valem depois do deploy). Conferir com o hash/conteúdo do bundle publicado (seção "Deploy" do AGENTS.md): o bundle deve conter `sb_publishable_` e não o JWT antigo.
6. **Teste em produção:** conta nova, partida ranqueada, placar, sala de dupla, exportar e excluir a conta. Jogadores com sessão salva devem continuar logados, porque a sessão é do Auth e não da chave **(não testado)**.
7. **Observar 7 dias** o painel de logs (Auth, API e Edge Functions) antes de revogar a legada. Se o painel mostrar o último uso de cada chave **(a confirmar)**, a `anon` legada deve ter parado de ser usada.
8. **Revogar a legada:** Project Settings › API Keys › desativar a `anon` e a `service_role` legadas (a desativação pode ser revertida no painel se algo ainda depender delas). Só depois disso rotacionar o segredo do JWT, se for o caso (seção 7, assinatura de JWT).
9. **Registrar** a data da troca na seção 1 (inventário) e marcar o item do backlog no `AGENTS.md`.

**Rollback:** colocar o valor legado de volta em `VITE_SUPABASE_ANON_KEY` na Vercel e refazer o deploy (a legada fica ativa até o passo 8). Depois do passo 8, reativar as chaves legadas no painel e repetir o deploy.

**`register-part` e a chave secreta (mínimo privilégio):** hoje a função usa um cliente com poder total (secret key/service role, ignora RLS) para três consultas só de leitura. Riscos: um bug na função daria acesso a todo o banco, e a chave fica nos segredos da função. Melhoria opcional, sem urgência: criar uma função SQL `security definer` que só devolve a faixa e conferir o perfil, e chamá-la com a chave publicável + token do jogador (sem secret key). Antes disso, ao migrar para a chave secreta nova, confirmar nos segredos da função que `SUPABASE_SECRET_KEYS` existe e que `SUPABASE_SERVICE_ROLE_KEY` legada só é usada como reserva; depois do passo 8 a reserva deixa de funcionar e `SUPABASE_SECRET_KEYS` passa a ser obrigatória.

## 8. Continuidade e acesso de emergência

- Hoje só o dono acessa os painéis. Guarde no cofre de senhas: códigos de recuperação do MFA, a lista de contas e um passo a passo curto para a pessoa de confiança que precise agir.
- Quando possível, adicionar um segundo owner na organização do Supabase e no projeto da Vercel.
- **Supabase Free pausa projetos sem atividade** (a regra exata, a confirmar na documentação: cerca de 7 dias). Pausado, ranking e dupla online param e o jogo continua. O painel oferece reativar. Se o online for importante, avalie o plano Pro ou um acesso periódico.
- **Realtime Free** tem tetos de conexões e mensagens (a confirmar na documentação do Supabase). A dupla online fica instável se muitos jogadores usarem ao mesmo tempo; a tela já mostra um erro de salas lotadas.

## 9. Monitoramento

Hoje não há monitor de queda, alerta de erro nem coleta de erros do navegador (decisão de privacidade: nada sai do navegador; o console é o único registro). **Pendente, ação do dono:** criar um monitor externo gratuito (por exemplo, UptimeRobot) para `https://prgb.vercel.app/` com alerta por e-mail, e acompanhar a página de status do Supabase e da Vercel.

## 10. Retirada de conteúdo (takedown) e desligamento do acervo

Contexto: o acervo externo de tablaturas é um recurso experimental, de terceiros, que o PRGB não licencia nem hospeda (veja Política e Termos). O provedor disse por escrito que não pode autorizar a exibição fora do site dele; quem pode são os titulares dos direitos. O ranking não usa o acervo externo. Este procedimento vale para um pedido de titular de direitos, para uma ordem do provedor ou para a decisão de desligar o acervo. Não é parecer jurídico.

1. **Receber e registrar.** O pedido chega pelo e-mail de contato da Política. No mesmo dia, anote (fora do repositório, se houver dado pessoal): data e hora do recebimento, quem pede (nome e vínculo com a obra), o que pede (obra, música ou faixa e onde aparece no PRGB) e o motivo. Guarde o e-mail original.
2. **Desligar o acervo na hora, se o caso pedir.** Na Vercel, projeto do PRGB, Settings › Environment Variables: definir `VITE_ACERVO_ENABLED=false` em **Production** e publicar de novo (Deployments › Redeploy, sem cache de build). **A confirmar:** isso depende da tarefa que cria o interruptor; até ela entrar em `main`, a variável não faz nada. Para desligar só uma obra, não há mecanismo hoje (a confirmar): desligue o acervo inteiro enquanto a análise corre.
3. **Conferir em produção.** Abra `https://prgb.vercel.app` numa janela anônima, depois de o novo deploy estar ativo, e confirme que a busca de músicas sumiu ou avisa que o acervo está indisponível e que os exercícios do PRGB seguem funcionando. Compare o conteúdo do bundle com o log do build (o status sozinho não prova nada, veja o AGENTS.md › Deploy). Registre o horário em que o acervo saiu do ar.
4. **Responder ao solicitante em até 15 dias** (o prazo da Política) pelo mesmo e-mail: confirme o recebimento, diga o que foi feito (acervo desligado, conteúdo fora do alcance do PRGB) e lembre que o PRGB não hospeda as tablaturas, que vêm do provedor externo. Se o pedido não proceder, explique o motivo e ofereça revisão, como dizem os Termos. Avise também o provedor externo se a retirada precisar ser feita na origem.
5. **Registrar o incidente** em `docs/incidentes/AAAA-MM-DD.md` (nota sem culpados): data, quem pediu, o que foi pedido, o que foi feito, quando o acervo saiu do ar, quando respondeu e o que mudar. Sem dados pessoais do solicitante além do necessário.
6. **Peça do repertório próprio** (quando esse repertório existir; **a confirmar**, o local e o formato ainda não estão definidos): apagar o arquivo da peça e o registro de procedência dela, publicar de novo e conferir em produção como no passo 3. Se a peça já estiver no ranking ou em recordes e desafios, a decisão sobre esses dados é do dono; registre-a na nota do passo 5.
7. **Religar o acervo** só depois de resolvido o caso: variável de volta para `true` (ou removida), novo deploy, conferência e nota no registro do passo 5.

## 11. Riscos aceitos e procedimentos da revisão crítica (2026-11-18)

Itens de `docs/revisao-critica.md` que são decisão ou ação do dono, ou que ficaram só anotados. Nada aqui foi aplicado em produção.

### 11.1 Moderação de pontuação suspeita (SEG-01)

O servidor só confere plausibilidade (`submit_score` aceita um resultado possível para a faixa e o tempo desde `start_session`). Quem tem a chave pública pode iniciar uma sessão, esperar cerca de 90% da duração da Ode e enviar a pontuação máxima. O risco é **aceito e comunicado**: o ranking é de brincadeira, sem prêmio. Endurecer exigiria um log de acertos validado no servidor. Procedimento, no SQL Editor do Supabase (rode e confira o `select` antes de qualquer `delete`):

1. Achar o suspeito (pontuação perfeita, ou o topo do placar):
   ```sql
   select p.nickname, b.user_id, b.song_id, b.part_id, b.score, b.accuracy, b.max_combo, b.achieved_at
   from public.scores_best b join public.profiles p on p.id = b.user_id
   where b.song_id = <id da faixa> and b.part_id = <parte>
   order by b.score desc, b.achieved_at limit 20;
   ```
   Sinais: `accuracy` 100 com `perfect` igual ao total de notas logo na primeira partida, `achieved_at` muito perto do `started_at` + duração da faixa em `play_sessions` (essa tabela só guarda 7 dias).
2. Apagar a pontuação da faixa, nas duas tabelas (o placar geral usa `scores_best`, o da semana usa `scores_weekly`):
   ```sql
   delete from public.scores_weekly where user_id = '<uuid>' and song_id = <id> and part_id = <parte>;
   delete from public.scores_best   where user_id = '<uuid>' and song_id = <id> and part_id = <parte>;
   ```
3. Se for reincidente, apagar a conta inteira (o `on delete cascade` leva o perfil, as pontuações e as sessões): `delete from auth.users where id = '<uuid>';`. Isso também é o que o titular tem direito de pedir (LGPD), então registre o motivo fora do repositório.
4. Anote data, `user_id` e motivo numa nota sem dados pessoais além do necessário. Não responda publicamente com o apelido.

### 11.2 Tentativas que falham não contam na cota (SEG-03)

`consume_rpc_quota` conta só chamadas bem-sucedidas: uma RPC que levanta erro (`nickname_taken`, `room_not_found`) dá rollback e leva a linha de cota junto. Consequência: sem freio por jogador para (a) sondar a blocklist de apelidos por tentativa e erro e (b) adivinhar códigos de sala (32^6, cerca de 1 bilhão de combinações, com `join_room` limitado só quando dá certo).

**Decisão: não entregar migration agora.** O Postgres do Supabase não tem transação autônoma sem `dblink` (não instalada, e abrir conexão do banco para ele mesmo é frágil). A alternativa dentro do banco é a RPC **devolver o erro como valor** (`{"error":"nickname_taken"}`) em vez de levantá-lo, para a contagem sobreviver ao commit. Isso muda o contrato de `create_profile`, `update_nickname` e `join_room` e todos os pontos do app e dos testes que hoje mapeiam a exceção (`toRankingError`, `roomChannel`), ou seja, é uma mudança grande para um risco baixo. Mitigação adotada: o Auth do Supabase já limita contas anônimas por IP (30 por hora, seção 3), o que limita quem consegue trocar de conta para recomeçar a sondagem.

**Alternativa recomendada, por IP:** um rate limit no Vercel Firewall não alcança o Supabase (as chamadas vão direto do navegador para ele). Para limitar por IP de verdade seria preciso passar as RPCs por uma Edge Function com contador por IP, o que contraria a regra de manter o backend mínimo. Reavalie se aparecer abuso real nos logs (`join_room` com muitos `room_not_found` do mesmo usuário).

### 11.3 `register-part` sem cota por usuário (SEG-04)

Desde que virou somente leitura (só devolve faixa já guardada), a função não consulta fonte externa e não consome mais a cota por usuário. A função SQL `consume_register_part_quota` e a tabela de cota ficaram **órfãs**. Não há risco de custo: cada chamada é uma leitura. Opções futuras: cache por sessão no cliente para evitar chamadas repetidas, ou remover a função e a tabela numa migration própria (não feita agora para não mexer no que já está em produção).

### 11.4 Limite de banda dos rewrites do acervo (SEG-08)

Os rewrites de `/api/tabs`, `/cdn/tabs` e `/cdn2/tabs` no `vercel.json` funcionam como proxy de banda: qualquer cliente pode usá-los. **Recomendação, ação do dono:** no painel da Vercel, projeto do PRGB › Firewall › Rules, criar uma regra de **rate limit** para esses três prefixos (por exemplo, 60 requisições por minuto por IP, ação "Too Many Requests") e conferir o resultado em Firewall › Traffic. Não foi verificado se já existe uma regra assim. Se aparecer consumo anormal, o Attack Challenge Mode (seção 6) é o freio de emergência, e `VITE_ACERVO_ENABLED=false` desliga o caminho (seção 10).

### 11.5 Anotações de segurança menores (SEG-10)

- A Edge Function `register-part` aceita origens `localhost` por padrão em `ALLOWED_ORIGINS`. Em produção, defina o segredo só com `https://prgb.vercel.app` (e previews, se precisar) para tirar `localhost`.
- Não há `Strict-Transport-Security` explícito nem `upgrade-insecure-requests` na CSP do `vercel.json`. A Vercel já serve HTTPS e envia HSTS nos domínios dela; se o domínio próprio for usado, confirme o cabeçalho com `curl -I`.
- `submit_feedback` pode ser esgotado por script (60 relatos por hora para todos, já registrado no backlog). Só CAPTCHA validado numa Edge Function ou limite por IP resolve, e ambos mexem na Política: decisão do dono.

## 12. E2E local contra o Supabase (Docker)

`npm run e2e:supabase` roda os testes de ponta a ponta de `e2e/supabase/` (ranking, conta e dupla online) contra um Supabase **local**, nunca contra o projeto hospedado. Os testes que não precisam de Supabase seguem em `npm run e2e`, que ignora esta pasta.

**O que precisa:** Docker Desktop aberto e o Supabase CLI do projeto (`devDependency`, usado por `npx supabase`). O script (`scripts/e2e-supabase.mjs`) confere o Docker, roda `supabase start` se a stack não estiver de pé (a primeira vez baixa várias imagens), serve a Edge Function `register-part` localmente (`ALLOWED_ORIGINS` só com a origem do preview de teste, em um arquivo temporário apagado no fim) e chama o Playwright com `playwright.supabase.config.ts`. **O Docker fica como está no fim**: `npm run e2e:supabase -- --stop` para a stack; `-- --reset` recria o banco local a partir das migrations (`supabase db reset --local`). O que vier depois de `--` vai para o Playwright (por exemplo `-g "dupla"`).

**Como não toca na produção:**
- O script recusa qualquer comando com `link`, `login`, `push`, `deploy` ou `--linked`, e o `project_id` de `supabase/config.toml` só dá nome aos contêineres locais.
- A URL e a chave publicável vêm de `supabase status` em tempo de execução, só na memória do processo: nenhum arquivo guarda chave. O build do app de teste (`dist-e2e-local/`, ignorado pelo git) recebe essas variáveis no ambiente do processo, que vencem qualquer `.env`; o `globalSetup` confere no bundle que não há host `supabase.co` nem chave em formato JWT, e recusa rodar se `VITE_SUPABASE_URL` não for `http://127.0.0.1` ou `localhost`.
- Toda requisição fora do preview e da API local é abortada e vira falha do teste. A CSP é a do `vercel.json`, com o host do Supabase trocado pelo local.
- No fim, o `globalSetup` apaga as contas anônimas que a execução criou (e, por cascata, perfis, pontuações, sessões e vagas de sala).

**O que cobre (8 testes, ~1,5 min):** placar aberto sem conta; criar conta (consentimento 18+, perfil e `consent_version` no banco); partida ranqueada do exercício original aceita pelo servidor (a `register-part` responde 200 com a chave publicável), no placar da semana e geral; exportar os dados e excluir a conta (nada sobra em `profiles`, `scores_*`, `play_sessions` e `auth.users`); limite por hora (`update_nickname`, 10 por jogador: o 11º é recusado com `rate_limited`); dupla online com dois contextos de navegador (criar, entrar, escolher faixa, ficar pronto, começar no mesmo relógio, mesmo placar da equipe nas duas telas, sair e voltar com o código, sala cheia e código desconhecido). O microfone é um oscilador que toca as notas do exercício no relógio do jogo (Chrome só apita), porque o servidor recusa partida sem nota acertada (`empty_run`).

**Limites conhecidos:** só testado no Edge do Windows com Docker Desktop; o CI tem um job `e2e-supabase` separado e com `continue-on-error`, **ainda não executado no GitHub**; o CAPTCHA fica desligado no ambiente local (`VITE_TURNSTILE_SITE_KEY` vazio), então o caminho do Turnstile não é exercitado; o `create_profile` (5 por hora) não é testado porque um jogador só cria um perfil; o Edge precisa da permissão `local-network-access` porque a página servida pelo Playwright chama a API em outra porta.
