// Legal copy (LGPD) rendered by the UI. It must describe what the app really does: when a data practice changes
// (what is stored, retention, providers), update these texts and LEGAL_VERSION, which is saved with each consent.

export interface LegalContact {
  controller: string;
  email: string;
}

export interface LegalSection {
  id: string;           // kebab-case, used as anchor; unique across both documents
  title: string;
  paragraphs: string[];
  items?: string[];     // bullet list rendered after the paragraphs; when present, the last paragraph introduces it
}

export interface LegalDocument {
  id: 'privacidade' | 'termos';
  title: string;
  updatedAt: string;    // ISO date (YYYY-MM-DD), equal to LEGAL_VERSION; format it with formatLegalDate
  summary: string[];
  sections: LegalSection[];
}

export interface ConsentCopy {
  ageLabel: string;
  rankingLabel: string;
  rankingSummary: string[];
  onlineLabel: string;
  onlineSummary: string[];
  nicknameHelp: string;
  exportLabel: string;
  exportDescription: string;
  deleteTitle: string;
  deleteDescription: string;
  deleteConfirmLabel: string;
  localDataDescription: string;
  clearLocalLabel: string;
}

export const LEGAL_VERSION: string = '2026-11-01';

export const LEGAL_CONTACT: LegalContact = {
  controller: 'Leonam Candido',
  email: 'interntufappli4@gmail.com'
};

const { controller, email } = LEGAL_CONTACT;
const PRIVACY_TITLE = 'Política de Privacidade';
const TERMS_TITLE = 'Termos de Uso';
// Button labels quoted inside the texts, shared with CONSENT_COPY so the UI and the documents never disagree
const EXPORT_LABEL = 'Baixar meus dados';
const DELETE_LABEL = 'Excluir minha conta e dados';
const CLEAR_LOCAL_LABEL = 'Apagar dados locais';

// Parsed and formatted in UTC: `new Date('2026-10-28')` shown in a Brazilian time zone would read as the day before
export const formatLegalDate = (isoDate: string): string =>
  new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${isoDate}T00:00:00Z`));

export const PRIVACY_POLICY: LegalDocument = {
  id: 'privacidade',
  title: PRIVACY_TITLE,
  updatedAt: LEGAL_VERSION,
  summary: [
    'Para tocar, você não precisa de conta: preferências, recordes e histórico ficam só no seu navegador.',
    'O som da guitarra ou do microfone é processado no seu aparelho e nunca é gravado nem enviado.',
    'Ranking e sala online são opcionais, só para maiores de 18 anos, e dependem do seu consentimento.',
    'No ranking, a conta é anônima: guardamos o apelido que você escolher (público), um ID aleatório e suas pontuações, sem e-mail, senha, nome real ou telefone.',
    'Você pode baixar seus dados, trocar o apelido ou excluir a conta quando quiser, direto no app.',
    'A caixa “Reportar problema” não pede nome nem e-mail: guardamos só a categoria, a tela e o texto, por 180 dias.',
    'Como em todo site, a hospedagem registra dados técnicos de acesso, como o endereço IP.',
    'Não vendemos dados, não exibimos publicidade e não usamos cookies nem ferramentas de análise de audiência.',
    'Não enviamos e-mails de marketing e não usamos seus dados para treinar inteligência artificial.'
  ],
  sections: [
    {
      id: 'quem-somos',
      title: 'Quem somos',
      paragraphs: [
        `O PRGB (Play Real Guitar in Browser) é um site gratuito para praticar guitarra no navegador. O controlador dos seus dados pessoais, ou seja, quem decide como eles são tratados, é ${controller}, que atende pelo e-mail ${email}.`,
        'Esta política explica, de acordo com a Lei Geral de Proteção de Dados (LGPD, Lei nº 13.709/2018), quais dados o PRGB trata, para quê, por quanto tempo, com quem compartilha e como você exerce seus direitos. Ela vale para o site e para os recursos online opcionais: o ranking e a sala online em dupla.'
      ]
    },
    {
      id: 'dados-coletados',
      title: 'Quais dados tratamos',
      paragraphs: [
        'O que tratamos depende de como você usa o PRGB. Não pedimos e-mail, senha, nome real, telefone, documentos nem sua localização, e não tratamos dados pessoais sensíveis.'
      ],
      items: [
        'Áudio da guitarra ou do microfone: usado só dentro do seu navegador, para detectar as notas, mostrar o afinador e simular o amplificador. Nunca é gravado nem enviado a nenhum servidor.',
        'Dados guardados no seu navegador: preferências, recordes, histórico e apelido local. Ficam no seu aparelho e não são enviados ao PRGB (veja “O que fica só no seu navegador”).',
        'Registros técnicos de acesso: como qualquer site, a hospedagem (Vercel) registra dados técnicos de cada visita, como endereço IP, data e hora, endereço da página e informações do navegador (user agent). Quando você abre o ranking ou usa a sala online, o Supabase registra dados técnicos parecidos das conexões. Se você tiver conta no ranking, o sistema de login do Supabase também guarda, junto da conta, dados das sessões de acesso (como endereço IP e navegador); eles são apagados quando a conta é excluída.',
        'Busca de músicas: o termo pesquisado e a música que você abre são repassados ao provedor externo de tablaturas.',
        'Ranking (opcional, para maiores de 18 anos): apelido, ID aleatório da conta, pontuações e datas, detalhados em “Ranking: o que guardamos”.',
        'Sala online em dupla (opcional, para maiores de 18 anos): apelido e placar ao vivo, repassados ao seu parceiro sem serem gravados, e o registro temporário da sua vaga na sala (código da sala, ID pseudônimo e horário de entrada).',
        'Relatos de problemas: se você usar a caixa “Reportar problema”, guardamos a categoria, a tela em que você estava e o texto que escreveu. Esse registro não tem nome, e-mail, conta nem endereço IP. Como em qualquer pedido, o envio passa pelos registros técnicos de acesso do Supabase, que incluem o endereço IP e seguem os prazos do fornecedor. Evite escrever dados pessoais no texto.',
        'Contato por e-mail: se você escrever para nós, recebemos seu endereço de e-mail e o que você contar na mensagem.'
      ]
    },
    {
      id: 'dados-no-navegador',
      title: 'O que fica só no seu navegador',
      paragraphs: [
        `Para lembrar suas escolhas sem criar conta, o PRGB usa o armazenamento local do seu navegador (localStorage), sem cookies, publicidade ou rastreadores. Por isso o aviso da primeira visita só informa e não pede consentimento: o que fica guardado é o que você mesmo escolheu. Esses dados ficam no seu aparelho até você apagá-los com o botão “${CLEAR_LOCAL_LABEL}” ou limpar os dados do site no navegador.`,
        'O navegador também guarda uma cópia dos arquivos do site, para ele abrir mais rápido e funcionar sem internet. Essa cópia não contém dados seus.',
        'Modelos de amplificador (.nam) e gabinetes (.wav) que você carregar são lidos só na memória desta página: não são enviados a nenhum servidor e somem ao fechá-la.',
        'Ficam só no seu aparelho, sem envio ao PRGB:'
      ],
      items: [
        'preferências: a entrada e a saída de áudio escolhidas (por identificadores criados pelo próprio navegador), o canal de entrada, as opções de áudio, os ajustes do amplificador e a última música aberta;',
        'seus recordes pessoais e o histórico das suas últimas partidas;',
        'o apelido local, se você escolher um;',
        'a marca de que você já viu o aviso da primeira visita;',
        'se você entrar no ranking, a chave de sessão que mantém sua conta conectada neste navegador.'
      ]
    },
    {
      id: 'link-de-desafio',
      title: 'Link de desafio',
      paragraphs: [
        'Se você compartilhar um link de desafio, ele leva a música (nome, artista e faixa), sua pontuação e sua precisão e, se você quiser, seu apelido. Qualquer pessoa que receber o link poderá ver essas informações, então escolha com quem compartilhar.',
        'O desafio não é guardado em banco de dados: as informações ficam no próprio link. Como qualquer endereço visitado, ele pode aparecer nos registros técnicos de acesso da hospedagem quando alguém o abre.'
      ]
    },
    {
      id: 'dados-do-ranking',
      title: 'Ranking: o que guardamos',
      paragraphs: [
        'O ranking é opcional e só para maiores de 18 anos. A conta só é criada depois que você confirma a idade e aceita publicar seu apelido e suas pontuações. Ela é anônima: não pedimos e-mail, senha, nome real nem telefone.',
        'No ranking, qualquer pessoa vê seu apelido e suas pontuações (pontos, precisão, maior combo e data). O ID da conta nunca é mostrado.',
        `Uma chave de sessão guardada no seu navegador mantém você conectado. Como a conta é anônima, ela só pode ser usada nesse navegador: se você limpar os dados do site ou trocar de aparelho, perde o acesso e não temos como devolvê-lo. Nesse caso, a conta é apagada automaticamente depois de 12 meses sem uso. Para apagá-la antes, use “${DELETE_LABEL}” antes de limpar o navegador.`,
        'Os dados do ranking ficam no Supabase, nosso fornecedor de banco de dados, em servidores na região de São Paulo. Guardamos:'
      ],
      items: [
        'o apelido, que aparece publicamente no ranking;',
        'um ID aleatório da conta, que não revela quem você é;',
        'as pontuações das partidas ranqueadas: pontos, precisão, maior combo e quantidade de notas Perfeito, Bom e Errou, com data e hora;',
        'registros técnicos de cada partida ranqueada (música, faixa e horários de início e de envio), usados para conferir a pontuação;',
        'quais faixas entraram no ranking pela sua conta (quando você foi a primeira pessoa a jogá-las), para limitar abusos;',
        'a data e a hora em que você confirmou a idade e aceitou os termos, e a versão do texto aceito;',
        'a data de criação da conta e a do último acesso, que serve para apagar contas inativas.'
      ]
    },
    {
      id: 'sala-online',
      title: 'Sala online em dupla',
      paragraphs: [
        'A sala online é opcional e só para maiores de 18 anos. Durante a partida, seu parceiro vê seu apelido e, ao vivo, seus pontos, seu combo e sua precisão, e você vê os dele.',
        'Essas informações e os comandos da partida passam pelo serviço de tempo real do Supabase só para chegar ao outro jogador e não são gravados. O som da sua guitarra nunca é transmitido.',
        'Para que só você e seu parceiro consigam entrar na sala, guardamos a sua vaga: o código da sala, o ID pseudônimo da conta e o horário de entrada. Esse registro é apagado quando a sala acaba ou, no máximo, em 6 horas. Para limitar abusos, guardamos também, por cerca de 1 hora, os horários em que você criou salas, sem os códigos.'
      ]
    },
    {
      id: 'finalidades',
      title: 'Para que usamos os dados',
      paragraphs: [
        'Não vendemos dados, não fazemos publicidade e não criamos perfis de consumo. Usamos os dados só para:'
      ],
      items: [
        'entregar o site e mantê-lo seguro e funcionando;',
        'buscar as tablaturas no provedor externo;',
        'mostrar o ranking, guardar suas pontuações e calcular sua posição;',
        'conferir automaticamente se as pontuações são possíveis e evitar trapaças e abusos;',
        'ligar você ao seu parceiro na sala online;',
        'ler os relatos de problemas e corrigir o que não funciona;',
        'registrar seu consentimento e atender aos seus pedidos como titular dos dados;',
        'apagar contas inativas e dados antigos nos prazos desta política.'
      ]
    },
    {
      id: 'bases-legais',
      title: 'Bases legais',
      paragraphs: [
        'O áudio e os dados que ficam só no seu navegador não chegam até nós. Para os demais, usamos estas bases legais da LGPD:'
      ],
      items: [
        `Consentimento (art. 7º, I): para criar a conta do ranking, publicar seu apelido e suas pontuações e usar a sala online. Você pode revogá-lo quando quiser, sem custo, excluindo a conta com o botão “${DELETE_LABEL}” ou deixando de usar a sala. Sem consentimento, você continua usando o PRGB normalmente, só sem esses recursos.`,
        'Legítimo interesse (art. 7º, IX): para os registros técnicos de acesso, a segurança do site, a prevenção de fraudes no ranking e a leitura dos relatos de problemas, sempre com o mínimo de dados necessário.',
        'Execução de contrato (art. 7º, V): para entregar o site e os recursos que você usa, conforme os Termos de Uso.',
        'Cumprimento de obrigação legal (art. 7º, II): quando a lei ou uma autoridade competente exigir que guardemos ou forneçamos dados.'
      ]
    },
    {
      id: 'compartilhamento',
      title: 'Com quem compartilhamos',
      paragraphs: [
        'Não vendemos nem alugamos dados pessoais. O site não usa serviços de terceiros para estatísticas, publicidade ou fontes: até as fontes são servidas pelo próprio PRGB. Links externos, como o de doação e o do GitHub, levam a sites com regras e políticas de privacidade próprias.',
        'Compartilhamos dados só com quem está listado abaixo. O Supabase atua como operador: trata os dados do ranking e os relatos em nosso nome, sob um adendo de tratamento de dados. A Vercel hospeda o site e trata os registros de acesso pelos termos e pela política de privacidade dela.',
        'O Supabase lista seus suboperadores em supabase.com/legal/customer-resources/subprocessor-list, e a Vercel, em security.vercel.com.'
      ],
      items: [
        'Vercel (Vercel Inc., Estados Unidos): hospeda o site, entrega os arquivos por uma rede global de servidores e repassa ao provedor de tablaturas os pedidos de busca e de música. Trata os registros técnicos de acesso.',
        'Supabase (Supabase Pte. Ltd., Singapura): guarda os dados do ranking e os relatos de problemas em servidores na região de São Paulo e transmite as mensagens da sala online. Para conferir pontuações, consulta no provedor de tablaturas dados públicos das faixas, como o número de notas e a duração, sem enviar dados seus.',
        'Provedor externo de tablaturas: serviço de terceiro que fornece o acervo de músicas. Recebe, repassados pela Vercel, o termo que você busca e os códigos da música e da faixa que você abre. Esses pedidos podem levar dados técnicos, como endereço IP e tipo de navegador, que ele trata conforme a política de privacidade dele. Ele nunca recebe dados da sua conta do ranking. Você pode pedir o nome desse provedor pelo e-mail desta Política.',
        'Outros jogadores: veem seu apelido e suas pontuações no ranking e, na sala online, seu placar ao vivo.',
        'Autoridades: só quando a lei ou uma ordem judicial exigir.'
      ]
    },
    {
      id: 'transferencia-internacional',
      title: 'Transferência internacional',
      paragraphs: [
        'A Vercel é uma empresa dos Estados Unidos e entrega o site por servidores espalhados pelo mundo. O Supabase tem sede em Singapura e guarda o banco de dados do ranking na região de São Paulo, mas pode tratar dados fora do Brasil, por exemplo em suporte e em registros técnicos. Por isso, pode haver transferência internacional de dados.',
        'Essas transferências acontecem para entregar o site e os recursos que você pede (art. 33, IX, combinado com o art. 7º, V, da LGPD) e, no ranking e na sala online, com o seu consentimento, pedido antes de você entrar (art. 33, VIII).'
      ]
    },
    {
      id: 'inteligencia-artificial',
      title: 'Inteligência artificial',
      paragraphs: [
        'O PRGB não usa seus dados nem o som da sua guitarra para treinar inteligência artificial e não vende nem cede dados para isso. O Supabase se compromete, por contrato, a não usar os dados do banco para treinar IA sem autorização.',
        'A detecção de notas e a pontuação usam algoritmos de processamento de som e regras fixas, sem IA generativa. O PRGB não gera músicas nem tablaturas com IA.',
        'Parte do código, dos textos (inclusive esta política), da identidade visual e do exercício de demonstração foi criada com ajuda de assistentes de IA, sob responsabilidade do mantenedor.'
      ]
    },
    {
      id: 'comunicacoes',
      title: 'Comunicações',
      paragraphs: [
        'O PRGB não envia newsletter, e-mails de marketing nem notificações, e nem tem o seu e-mail, a não ser que você nos escreva. Se isso mudar, será só com um consentimento separado, que você poderá retirar quando quiser, e com opção de descadastro em cada mensagem.'
      ]
    },
    {
      id: 'retencao',
      title: 'Por quanto tempo guardamos',
      paragraphs: ['Guardamos os dados só pelo tempo necessário. Os prazos do banco de dados são aplicados por rotinas automáticas diárias:'],
      items: [
        `conta do ranking e pontuações do ranking geral: enquanto a conta existir, até você usar “${DELETE_LABEL}” ou até ela ser apagada automaticamente depois de 12 meses sem acesso;`,
        'ranking semanal: 8 semanas;',
        'registros técnicos das partidas ranqueadas: 7 dias;',
        'sala online: mensagens e placar ao vivo não são gravados; o registro da vaga na sala é apagado em até 6 horas, e os horários de criação de salas, em cerca de 1 hora;',
        'registros técnicos de acesso da Vercel e do Supabase: pelos prazos definidos por esses fornecedores;',
        'cópias de segurança automáticas do banco, quando o Supabase as mantém: descartadas no ciclo do fornecedor, em poucos dias; nunca as usamos para recuperar dados que você excluiu;',
        'relatos de problemas: 180 dias;',
        'e-mails de contato: pelo tempo necessário para atender ao seu pedido;',
        'dados no seu navegador: até você apagá-los.'
      ]
    },
    {
      id: 'direitos',
      title: 'Seus direitos',
      paragraphs: [
        'A LGPD (art. 18) garante a você os direitos abaixo, sem custo. Quem tem conta no ranking exerce os principais direto no app, na hora; para os demais, veja “Contato e encarregado”.'
      ],
      items: [
        `Confirmação e acesso: o botão “${EXPORT_LABEL}” entrega um arquivo com os dados da sua conta.`,
        'Portabilidade: esse arquivo, em formato JSON, pode ser levado para outro serviço.',
        'Correção: você pode trocar seu apelido quando quiser.',
        `Eliminação e revogação do consentimento: o botão “${DELETE_LABEL}” apaga sua conta e os dados ligados a ela na hora, de forma definitiva.`,
        'Informação: saber com quem compartilhamos dados (veja “Com quem compartilhamos”) e o que acontece se você não consentir: você continua usando o PRGB, só sem ranking e sala online.',
        'Revisão de decisões automatizadas: se uma pontuação ou um apelido seu for recusado automaticamente, você pode pedir que a decisão seja revista.',
        'Anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desacordo com a LGPD.',
        'Oposição a tratamentos feitos com base no legítimo interesse, se eles não cumprirem a LGPD.',
        'Relatos de problemas: como são guardados sem identificar você, só conseguimos achar um relato para apagá-lo se você nos contar o que escreveu.'
      ]
    },
    {
      id: 'seguranca',
      title: 'Segurança',
      paragraphs: [
        'Nenhum sistema é totalmente seguro, mas adotamos medidas proporcionais ao que tratamos. Se houver um incidente de segurança que possa causar risco ou dano relevante a você, avisaremos no próprio site, já que não temos seu contato, e comunicaremos a ANPD, como exige a lei.',
        'Entre as medidas:'
      ],
      items: [
        'coletamos o mínimo: a conta é anônima e o único dado que você escolhe é o apelido;',
        'o áudio nunca sai do seu aparelho;',
        'a comunicação com o site e com o Supabase é criptografada (HTTPS);',
        'o app não lê as tabelas do banco diretamente: tudo passa por funções que só devolvem os dados da sua própria conta ou o ranking público, que mostra apelido e números, nunca o ID da conta;',
        'o servidor confere as pontuações e limita a quantidade de envios para dificultar abusos.'
      ]
    },
    {
      id: 'menores-de-idade',
      title: 'Menores de 18 anos',
      paragraphs: [
        'O ranking e a sala online são só para maiores de 18 anos. A idade é autodeclarada: antes de criar a conta ou entrar numa sala, você confirma que tem 18 anos ou mais. Esse limite é uma escolha do PRGB para tratar menos dados pessoais nos recursos online, não uma classificação indicativa.',
        'O modo local, sem conta, pode ser usado por qualquer pessoa: nele, preferências, recordes e histórico ficam só no navegador.',
        'Em todo o site não há publicidade, compras, caixas de recompensa, perfis de comportamento nem conversa entre jogadores, e a sala online só mostra apelido e placar.',
        `Se soubermos que uma conta do ranking pertence a alguém com menos de 18 anos, vamos excluí-la. Se você é responsável por um menor e acredita que isso aconteceu, escreva para ${email}.`
      ]
    },
    {
      id: 'alteracoes',
      title: 'Mudanças nesta política',
      paragraphs: [
        'Podemos atualizar esta política quando o PRGB mudar. A data da versão em vigor aparece no topo. Se a mudança afetar o que acontece com os dados do ranking ou da sala online, avisaremos no site e pediremos seu aceite de novo antes que você continue usando esses recursos.'
      ]
    },
    {
      id: 'contato',
      title: 'Contato e encarregado',
      paragraphs: [
        `O controlador, ${controller}, também atua como encarregado pelo tratamento de dados pessoais (art. 41 da LGPD): é ele quem recebe os pedidos e as reclamações dos titulares e as comunicações da Autoridade Nacional de Proteção de Dados (ANPD), pelo e-mail ${email}.`,
        'Use esse canal para exercer os direitos que não estão no app, pedir uma cópia completa dos seus dados (inclusive os registros técnicos das partidas), tirar dúvidas e avisar sobre problemas de segurança ou de privacidade. Respondemos em até 15 dias.',
        'Como a conta é anônima, podemos pedir informações que ajudem a confirmar que ela é sua antes de atender ao pedido.',
        'Você também pode apresentar reclamação à ANPD, em gov.br/anpd.'
      ]
    }
  ]
};

export const TERMS_OF_USE: LegalDocument = {
  id: 'termos',
  title: TERMS_TITLE,
  updatedAt: LEGAL_VERSION,
  summary: [
    'O PRGB é gratuito e oferecido no estado em que se encontra, sem garantia de que estará sempre disponível.',
    'As tablaturas vêm de um provedor externo, que não tem relação com o PRGB; as músicas pertencem aos seus titulares.',
    'Ranking e sala online são só para maiores de 18 anos.',
    'Não vale apelido ofensivo ou que imite outra pessoa ou a equipe, nem trapaça ou envio automatizado.',
    'Podemos remover apelidos e pontuações e encerrar contas que violem estas regras.',
    'Cuide da sua audição: comece sempre com o volume baixo.',
    'Use tomadas aterradas. Se sentir choque ao tocar na guitarra, pare, desconecte tudo e chame um eletricista.'
  ],
  sections: [
    {
      id: 'sobre-os-termos',
      title: 'Sobre estes termos',
      paragraphs: [
        `Estes ${TERMS_TITLE} são as regras para usar o PRGB (Play Real Guitar in Browser), site gratuito para praticar guitarra no navegador, mantido por ${controller}. Ao usar o PRGB, você concorda com eles; se não concordar, não use o site.`,
        `A ${PRIVACY_TITLE}, que explica como tratamos seus dados, complementa estes termos. Para entrar no ranking ou na sala online, você aceita os dois documentos de forma expressa.`
      ]
    },
    {
      id: 'o-servico',
      title: 'O serviço',
      paragraphs: [
        'O PRGB permite tocar guitarra no navegador: o som do seu instrumento passa por um simulador de amplificador feito em software, que não reproduz com exatidão nenhum equipamento real, e você pode acompanhar tablaturas com detecção de notas e pontuação. O ranking e a sala online em dupla são recursos opcionais que dependem de internet.',
        'O PRGB é gratuito, não exibe publicidade e é oferecido no estado em que se encontra. Podemos mudar, suspender ou encerrar qualquer recurso, inclusive o ranking e a sala online, e não garantimos que o site estará sempre disponível, livre de erros ou compatível com todos os navegadores e equipamentos. Não prometemos nenhuma porcentagem de disponibilidade: o PRGB é mantido por uma pessoa, sem equipe de plantão.',
        'A detecção de notas e a pontuação são estimativas e podem errar, por exemplo por ruído, afinação ou ajustes do equipamento.'
      ]
    },
    {
      id: 'idade-e-requisitos',
      title: 'Idade e requisitos',
      paragraphs: [
        'O ranking e a sala online são só para maiores de 18 anos. Ao confirmar sua idade, você declara que a informação é verdadeira.',
        'O modo local, sem conta, pode ser usado por qualquer pessoa. Recomendamos que crianças e adolescentes usem o PRGB com o acompanhamento de um responsável, principalmente para controlar o volume.',
        'Para usar o PRGB, você precisa de um navegador compatível e, para tocar, de uma interface de áudio ou de um microfone. Internet e equipamento ficam por sua conta.'
      ]
    },
    {
      id: 'conteudo-de-terceiros',
      title: 'Tablaturas e conteúdo de terceiros',
      paragraphs: [
        'As tablaturas e os dados das músicas vêm de um provedor externo e são buscados quando você os pede. O PRGB não é afiliado, patrocinado nem endossado por esse provedor, por artistas ou por gravadoras.',
        'Músicas, tablaturas, nomes de artistas e marcas pertencem aos seus titulares. Não garantimos que esse conteúdo esteja correto, completo ou disponível, e ele pode deixar de aparecer se o provedor mudar ou bloquear o acesso.',
        'O PRGB exibe esse conteúdo para você praticar. Copiar, baixar em massa ou redistribuir tablaturas pode violar os direitos dos titulares.'
      ]
    },
    {
      id: 'direitos-autorais',
      title: 'Direitos autorais e pedidos de remoção',
      paragraphs: [
        'O PRGB não guarda tablaturas em servidor próprio: elas vêm do provedor externo quando você as abre. Guardamos só números sobre cada faixa, como a quantidade de notas e a duração, para conferir pontuações.',
        `Se você é titular de direitos, ou representa quem é, e acha que algo no PRGB viola esses direitos, escreva para ${email} dizendo quem você é, qual é a obra, onde ela aparece no PRGB e por que o uso é indevido. Analisamos cada pedido e, se ele proceder, tiramos o conteúdo do alcance do PRGB o quanto antes.`,
        'Quem discordar de uma remoção pode pedir revisão pelo mesmo e-mail.'
      ]
    },
    {
      id: 'arquivos-que-voce-carrega',
      title: 'Arquivos que você carrega',
      paragraphs: [
        'Você pode carregar seus próprios modelos de amplificador (.nam) e gabinetes (.wav). Eles ficam só no seu navegador e não são enviados a ninguém. O PRGB não inclui nem distribui esses arquivos, e cabe a você ter o direito de usá-los.',
        'Modelos neurais podem pesar no computador e gerar som muito alto. Baixe o volume antes de trocar de modelo.'
      ]
    },
    {
      id: 'regras-de-conduta',
      title: 'Regras de conduta',
      paragraphs: [
        `Para manter o PRGB justo e seguro, valem as regras abaixo. Se encontrar uma falha de segurança, avise-nos pelo e-mail ${email} em vez de explorá-la.`,
        'É proibido:'
      ],
      items: [
        'usar apelido ofensivo, discriminatório, obsceno ou que incentive violência;',
        'usar apelido que se passe por outra pessoa, artista ou marca, ou pela equipe do PRGB (como “admin”, “moderador” ou “suporte”);',
        'usar apelido com dados pessoais de outras pessoas;',
        'trapacear: enviar pontuações que não vieram de uma partida de verdade, alterar o funcionamento do app ou explorar falhas para ganhar pontos;',
        'automatizar envios ou acessos (robôs, scripts ou requisições em massa) ao ranking, à sala online ou à busca de músicas;',
        'tentar acessar contas ou dados de outras pessoas, sobrecarregar o serviço ou contornar suas proteções;',
        'usar o PRGB para assediar outras pessoas ou para qualquer fim ilegal.'
      ]
    },
    {
      id: 'ranking-e-sala-online',
      title: 'Ranking e sala online',
      paragraphs: [
        'Para entrar no ranking, você confirma que tem 18 anos ou mais e aceita publicar seu apelido e suas pontuações. A conta é anônima e fica ligada ao navegador em que foi criada: se você limpar os dados do site, pode perder o acesso a ela.',
        'As pontuações são calculadas no seu navegador e conferidas pelo servidor, que recusa resultados impossíveis para a música. Só valem para o ranking partidas na velocidade normal (1×).',
        'Cada apelido é único no ranking, e apelidos com termos proibidos são recusados automaticamente. Posições no ranking não dão direito a prêmios e podem mudar ou ser corrigidas a qualquer momento.',
        'Na sala online, seu parceiro vê seu apelido e seu placar ao vivo. Jogue com respeito.'
      ]
    },
    {
      id: 'remocao-e-encerramento',
      title: 'Remoção de conteúdo e encerramento de contas',
      paragraphs: [
        'Podemos recusar ou remover apelidos e pontuações e encerrar contas que violem estes termos ou mostrem sinais de trapaça. Como a conta é anônima, nem sempre conseguiremos avisar antes.',
        `Se achar que houve engano, escreva para ${email} e revisaremos o caso.`,
        `Você pode excluir sua conta quando quiser, pelo botão “${DELETE_LABEL}”. A exclusão é imediata e não pode ser desfeita. Contas sem acesso por 12 meses são apagadas automaticamente.`
      ]
    },
    {
      id: 'audicao-e-equipamento',
      title: 'Sua audição, sua segurança e seu equipamento',
      paragraphs: [
        'O PRGB envia o som da sua guitarra, já processado, para fones ou caixas de som em tempo real. Antes de tocar, abaixe o volume e aumente aos poucos. Volume alto, principalmente em fones de ouvido e por muito tempo, pode causar perda auditiva permanente. Faça pausas.',
        'Ganho alto no amplificador e microfonia (o som da caixa voltando para o microfone) podem gerar sons fortes de repente. Se usar microfone, prefira fones de ouvido.',
        'Ligue o computador, a interface e os amplificadores em tomadas com aterramento. Sem isso, as cordas da guitarra podem ficar energizadas e dar choque. Se sentir choque ao tocar na guitarra, pare na hora, desconecte tudo e chame um eletricista antes de usar de novo. Um computador sem aterramento é um risco elétrico que o PRGB não consegue detectar.',
        'Você é responsável pelo seu equipamento (interface de áudio, cabos, fones e caixas de som) e pelo modo de usá-lo.'
      ]
    },
    {
      id: 'limites-de-responsabilidade',
      title: 'Limites de responsabilidade',
      paragraphs: [
        'Nada nestes termos exclui ou limita direitos que a lei garante a você, inclusive os do Código de Defesa do Consumidor.',
        'Respeitado isso, e por ser um serviço gratuito oferecido no estado em que se encontra, o PRGB não responde por:'
      ],
      items: [
        'indisponibilidade, lentidão ou erros do site;',
        'erros na detecção de notas ou na pontuação;',
        'perda de recordes, histórico ou outros dados guardados no navegador;',
        'mudanças, erros ou retirada de conteúdo de terceiros, como as tablaturas do provedor externo;',
        'danos causados por uso inadequado do equipamento de áudio ou por volume excessivo;',
        'conteúdo e funcionamento de sites externos, como a plataforma de doação.'
      ]
    },
    {
      id: 'propriedade-intelectual',
      title: 'Propriedade intelectual',
      paragraphs: [
        `O nome PRGB, o logotipo e a identidade visual do site pertencem a ${controller}. Não os use de forma que sugira parceria, patrocínio ou que você fala em nome do PRGB.`,
        'Músicas, tablaturas, nomes de artistas e marcas de terceiros pertencem aos seus titulares, e estes termos não dão a você nenhum direito sobre eles.',
        'O PRGB usa software livre e fontes com licenças próprias, listadas em prgb.vercel.app/licencas-terceiros.md, em /nam/NOTICE.txt e na pasta /fonts do site.'
      ]
    },
    {
      id: 'preco-e-reembolso',
      title: 'Preço, assinatura e reembolso',
      paragraphs: [
        'O PRGB é gratuito: não há assinatura, renovação automática, compra dentro do jogo nem taxa escondida. Como nada é cobrado, não há o que cancelar nem reembolsar.',
        'Se um dia houver algo pago, o preço, a renovação, o cancelamento e o reembolso serão mostrados antes, e nada será cobrado sem o seu aceite.'
      ]
    },
    {
      id: 'doacoes',
      title: 'Doações',
      paragraphs: [
        'Doar para o projeto é opcional, não dá vantagens no jogo nem no ranking e é feito numa plataforma externa, com regras e política de privacidade próprias. Pedidos sobre uma doação, como estornos, seguem as regras dessa plataforma.'
      ]
    },
    {
      id: 'mudancas-nos-termos',
      title: 'Mudanças nos termos',
      paragraphs: [
        'Podemos atualizar estes termos. A data da versão em vigor aparece no topo. Mudanças relevantes serão avisadas no site, e quem tem conta no ranking poderá ter de aceitar a nova versão para continuar usando os recursos online.',
        'Se continuar usando o PRGB depois da mudança, você concorda com a nova versão. Se não concordar, pare de usar e, se tiver conta, exclua-a.'
      ]
    },
    {
      id: 'lei-e-foro',
      title: 'Lei aplicável e foro',
      paragraphs: [
        'Estes termos seguem as leis do Brasil. Qualquer disputa sobre eles será resolvida no foro do seu domicílio.'
      ]
    },
    {
      id: 'fale-conosco',
      title: 'Fale conosco',
      paragraphs: [
        `O PRGB é mantido por ${controller}. Dúvidas, sugestões, denúncias de apelidos ou de trapaça, pedidos de remoção e avisos de falhas de segurança: escreva para ${email}.`
      ]
    }
  ]
};

export const CONSENT_COPY: ConsentCopy = {
  ageLabel: 'Confirmo que tenho 18 anos ou mais.',
  rankingLabel: `Quero entrar no ranking: aceito que meu apelido e minhas pontuações fiquem públicos, conforme a ${PRIVACY_TITLE} e os ${TERMS_TITLE}.`,
  rankingSummary: [
    'Criamos uma conta anônima, sem e-mail, senha, nome real ou telefone. Ela fica só neste navegador: se você limpar os dados do site, perde o acesso.',
    'Guardamos seu apelido, suas pontuações ranqueadas e as datas do aceite e do último acesso no Supabase, nosso fornecedor, com servidores em São Paulo. Ele tem sede fora do Brasil, então esses dados podem ser tratados no exterior.',
    'Qualquer pessoa vê seu apelido e suas pontuações no ranking; o ID da conta nunca aparece.',
    'Sem uso por 12 meses, a conta é apagada automaticamente. O ranking semanal guarda 8 semanas.',
    'Você pode baixar seus dados, trocar o apelido ou excluir a conta quando quiser. A exclusão é imediata e definitiva.'
  ],
  onlineLabel: `Quero jogar online: aceito que meu parceiro de sala veja meu apelido e meu placar ao vivo, conforme a ${PRIVACY_TITLE} e os ${TERMS_TITLE}.`,
  onlineSummary: [
    'Seu parceiro vê seu apelido e, ao vivo, seus pontos, seu combo e sua precisão.',
    'O som da sua guitarra nunca é transmitido.',
    'Apelido, placar e comandos da partida passam pelo Supabase, que tem sede fora do Brasil, só para chegar ao outro jogador, e não são gravados. Só a sua vaga na sala fica registrada, por até 6 horas.',
    'A sala online é só para maiores de 18 anos.'
  ],
  nicknameHelp: 'De 3 a 20 caracteres: letras (com ou sem acento), números, espaço, _ (sublinhado), - (hífen) e . (ponto). Não são aceitos palavrões, ofensas nem nomes que imitem outras pessoas ou a equipe do PRGB. No ranking, cada apelido é único. Para proteger sua privacidade, não use seu nome completo.',
  exportLabel: EXPORT_LABEL,
  exportDescription: 'Baixa um arquivo JSON com os dados da sua conta do ranking: apelido, ID da conta, datas de criação, do aceite e do último acesso, versão do texto aceito, suas pontuações (recordes e ranking semanal), os registros técnicos das partidas e das faixas que você cadastrou e, se houver, sua vaga em sala online. O arquivo pode ser aberto em qualquer editor de texto e não inclui dados de outras pessoas.',
  deleteTitle: DELETE_LABEL,
  deleteDescription: `Apaga na hora sua conta do ranking e tudo o que está ligado a ela: apelido, pontuações e registros das partidas. Não dá para desfazer nem recuperar. Os dados guardados só neste navegador continuam aqui; para apagá-los, use “${CLEAR_LOCAL_LABEL}”.`,
  deleteConfirmLabel: 'Excluir definitivamente',
  localDataDescription: 'O PRGB guarda só neste navegador, sem enviar a nenhum servidor: suas preferências de áudio e do amplificador, a última música, seus recordes, o histórico das últimas partidas e seu apelido local. Apagar esses dados não exclui sua conta do ranking, se você tiver uma.',
  clearLocalLabel: CLEAR_LOCAL_LABEL
};
