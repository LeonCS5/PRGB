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

- **Site:** push na `main` publica na Vercel em cerca de 1 minuto. O CI do GitHub roda lint, build, testes e `npm audit` a cada push e pull request.
- **Conferir o deploy:** compare o nome do bundle `assets/index-*.js` do site com o log do build (`vercel inspect <url> --logs`). O status 200 sozinho não prova nada: o último rewrite devolve a página para quase qualquer caminho.
- **Reverter:** Vercel › Deployments › escolher um deploy anterior › Promote to Production. A Vercel guarda os 10 últimos por 30 dias.
- **Banco:** as migrations de `supabase/migrations/` foram aplicadas à mão pelo SQL Editor, e o histórico remoto não bate com os arquivos (faltam `room_realtime` e `feedback`, e as versões têm números diferentes). Antes de qualquer `supabase db push`, alinhe o histórico com `supabase migration repair --status applied <versão>` para cada migration já aplicada. Sem isso, o `db push` tentaria reaplicar tudo.
- **Edge Function:** `supabase functions deploy register-part`.

## 5. Backup e restauração

O plano Free do Supabase **não** faz backup baixável. O procedimento é manual:

1. Semanalmente, rode `scripts/backup-db.sh` (veja o cabeçalho do script). Ele gera `schema-*.sql` e `data-*.sql` numa pasta **fora** do repositório e apaga as cópias com mais de 30 dias.
2. As cópias contêm apelidos e pontuações (dado pessoal): guarde-as criptografadas e nunca no repositório. Prazo de 30 dias, coerente com a Política.
3. Restaurar: crie um projeto Supabase novo, aplique as migrations em ordem e carregue o `data-*.sql`. As contas anônimas vivem no schema `auth`, que este backup não cobre: depois de restaurar, os jogadores precisam criar conta de novo (o ranking antigo só volta se o schema `auth` também for restaurado, o que exige o plano Pro).
4. Metas (não ensaiadas): perder no máximo 7 dias de dados; voltar em algumas horas. **Pendente:** ensaiar uma restauração num projeto descartável.

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

- **Chave pública do Supabase (`anon`):** criar a chave nova no painel › atualizar `VITE_SUPABASE_ANON_KEY` na Vercel › publicar › revogar a antiga. O bundle de produção ainda usa a chave no formato antigo (JWT). O Supabase anunciou o fim das chaves legadas para o fim de 2026 **(a confirmar na documentação)**: migrar para a chave publicável antes disso e revisar o uso da service role em `supabase/functions/register-part/index.ts`.
- **Segredo do Turnstile:** Cloudflare › Turnstile › `PRGB` › Rotate secret, colar o novo em Supabase › Authentication › Attack Protection e testar criando uma conta pelo site.
- **Sessões:** trocar as chaves de assinatura do JWT no Supabase derruba todas as sessões (os jogadores perdem a conta anônima).

## 8. Continuidade e acesso de emergência

- Hoje só o dono acessa os painéis. Guarde no cofre de senhas: códigos de recuperação do MFA, a lista de contas e um passo a passo curto para a pessoa de confiança que precise agir.
- Quando possível, adicionar um segundo owner na organização do Supabase e no projeto da Vercel.
- **Supabase Free pausa projetos sem atividade** (a regra exata, a confirmar na documentação: cerca de 7 dias). Pausado, ranking e dupla online param e o jogo continua. O painel oferece reativar. Se o online for importante, avalie o plano Pro ou um acesso periódico.
- **Realtime Free** tem tetos de conexões e mensagens (a confirmar na documentação do Supabase). A dupla online fica instável se muitos jogadores usarem ao mesmo tempo; a tela já mostra um erro de salas lotadas.

## 9. Monitoramento

Hoje não há monitor de queda, alerta de erro nem coleta de erros do navegador (decisão de privacidade: nada sai do navegador; o console é o único registro). **Pendente, ação do dono:** criar um monitor externo gratuito (por exemplo, UptimeRobot) para `https://prgb.vercel.app/` com alerta por e-mail, e acompanhar a página de status do Supabase e da Vercel.
