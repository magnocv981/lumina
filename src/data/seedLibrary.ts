import type { Book, BookChapter, Bookmark, Category, ReaderPreferences } from '../types/library';

export const DEFAULT_PREFERENCES: ReaderPreferences = {
  ownerId: 'local',
  appTheme: 'dark',
  readerTheme: 'night',
  fontFamily: 'source-serif',
  fontSize: 18,
  lineHeight: 1.7,
  pageWidth: 'medium',
  textAlign: 'left',
  readingMode: 'paginated',
};

export const SEED_CATEGORIES: Category[] = [
  {
    id: 'cat_classicos',
    ownerId: 'local',
    name: 'Clássicos Brasileiros',
    color: '#3B5BDB',
    description: 'Obras fundamentais da literatura em língua portuguesa.',
    sortOrder: 1,
  },
  {
    id: 'cat_contos',
    ownerId: 'local',
    name: 'Contos & Crônicas',
    color: '#0D9488',
    description: 'Narrativas curtas para leitura rápida no celular.',
    sortOrder: 2,
  },
  {
    id: 'cat_estudos',
    ownerId: 'local',
    name: 'Estudos Literários',
    color: '#D97706',
    description: 'Textos anotados e revisões de biblioteca no Windows.',
    sortOrder: 3,
  },
];

export const SEED_BOOKS: Book[] = [
  {
    id: 'book_dom_casmurro',
    ownerId: 'local',
    format: 'epub',
    title: 'Dom Casmurro',
    author: 'Machado de Assis',
    publisher: 'Livraria Garnier · Edição Digital',
    language: 'pt-BR',
    synopsis:
      'Bento Santiago narra a história de sua juventude no Rio de Janeiro do século XIX, o amor por Capitu e as dúvidas que marcaram toda a sua existência.',
    notes: 'Revisar a passagem sobre os olhos de ressaca no capítulo XXXII e comparar com o prefácio.',
    coverUrl: '/src/assets/images/cover_dom_casmurro_1795053717990.jpg',
    categoryIds: ['cat_classicos', 'cat_estudos'],
    isFavorite: true,
    status: 'reading',
    progressPercent: 28,
    currentChapterIndex: 1,
    scrollRatio: 0.35,
    totalChapters: 4,
    lastDevice: 'Windows Desktop',
    fileSizeBytes: 245000,
    hasCloudChapters: true,
    isBuiltIn: true,
  },
  {
    id: 'book_o_alienista',
    ownerId: 'local',
    title: 'O Alienista',
    author: 'Machado de Assis',
    publisher: 'Edição Crítica Lumina',
    language: 'pt-BR',
    synopsis:
      'Em Itaguaí, o médico Simão Bacamarte funda a Casa Verde para estudar a fronteira tênue entre a razão e a loucura humana.',
    notes: 'Sátira genial sobre o cientificismo e o poder local.',
    coverUrl: '/src/assets/images/cover_o_alienista_1795053718820.jpg',
    categoryIds: ['cat_classicos', 'cat_contos'],
    isFavorite: false,
    status: 'reading',
    progressPercent: 12,
    currentChapterIndex: 0,
    scrollRatio: 0.48,
    totalChapters: 3,
    lastDevice: 'Android',
    fileSizeBytes: 184000,
    hasCloudChapters: true,
    isBuiltIn: true,
  },
  {
    id: 'book_a_cartomante',
    ownerId: 'local',
    title: 'A Cartomante',
    author: 'Machado de Assis',
    publisher: 'Cadernos de Contos',
    language: 'pt-BR',
    synopsis:
      'Camilo, Rita e Vilela veem seus destinos entrelaçados entre o ceticismo, o remorso e a consulta inesperada a uma cartomante na Rua da Guarda Velha.',
    notes: 'Excelente conto para leitura noturna no modo OLED.',
    coverUrl: '/src/assets/images/cover_cartomante_1795053718249.jpg',
    categoryIds: ['cat_contos'],
    isFavorite: true,
    status: 'unread',
    progressPercent: 0,
    currentChapterIndex: 0,
    scrollRatio: 0,
    totalChapters: 3,
    lastDevice: 'Windows Desktop',
    fileSizeBytes: 112000,
    hasCloudChapters: true,
    isBuiltIn: true,
  },
];

export const SEED_BOOKMARKS: Bookmark[] = [
  {
    id: 'bm_dom_casmurro_1',
    ownerId: 'local',
    bookId: 'book_dom_casmurro',
    chapterIndex: 1,
    chapterTitle: 'Capítulo II · Do Livro',
    scrollRatio: 0.35,
    progressPercent: 28,
    excerpt: 'O meu fim evidente era atar as duas pontas da vida, e restaurar na velhice a adolescência.',
    note: 'Tese central do narrador sobre memória e reconstrução da casa do Engenho Novo.',
    deviceName: 'Windows Desktop',
  },
  {
    id: 'bm_alienista_1',
    ownerId: 'local',
    bookId: 'book_o_alienista',
    chapterIndex: 0,
    chapterTitle: 'Capítulo I · De como Itaguaí ganhou uma Casa de Orates',
    scrollRatio: 0.48,
    progressPercent: 12,
    excerpt: 'A ciência é o meu emprego único; Itaguaí é o meu universo.',
    note: 'Frase emblemática do Dr. Simão Bacamarte.',
    deviceName: 'Android',
  },
];

export const SEED_CHAPTERS: Record<string, BookChapter[]> = {
  book_dom_casmurro: [
    {
      id: 'ch_0',
      ownerId: 'local',
      bookId: 'book_dom_casmurro',
      index: 0,
      title: 'Capítulo I · Do Título',
      wordCount: 245,
      htmlContent: `
        <p>Uma noite destas, vindo da cidade para o Engenho Novo, encontrei no trem da Central um rapaz aqui do bairro, que eu conheço de vista e de chapéu. Cumprimentou-me, sentou-se ao pé de mim, falou da lua e dos ministros, e acabou recitando-me versos. A viagem era curta, e os versos pode ser que não fossem inteiramente maus. Sucedeu, porém, que, como eu estava cansado, fechei os olhos três ou quatro vezes; tanto bastou para que ele interrompesse a leitura e metesse os versos no bolso.</p>
        <p>— Continue, disse eu acordando.</p>
        <p>— Já acabei, murmurou ele.</p>
        <p>— São muito bonitos.</p>
        <p>Vi-lhe fazer um gesto para tirá-los outra vez do bolso, mas não passou do gesto; estava amuado. No dia seguinte entrou a dizer de mim nomes feios, e acabou alcunhando-me <em>Dom Casmurro</em>. Os vizinhos, que não gostam dos meus hábitos reclusos e calados, deram curso à alcunha, que afinal pegou. Nem por isso me zanguei. Contei a anedota aos amigos da cidade, e eles, por graça, chamam-me assim, alguns em bilhetes: "Dom Casmurro, domingo vou jantar com você."</p>
        <p>Não consultes dicionários. <em>Casmurro</em> não está aqui no sentido que eles lhe dão, mas no que lhe pôs o vulgo de homem calado e metido consigo. Dom veio por ironia, para atribuir-me fumos de fidalgo. Tudo por estar cochilando! Também não achei melhor título para a minha narração; se não tiver outro daqui até ao fim do livro, vai este mesmo.</p>
      `,
    },
    {
      id: 'ch_1',
      ownerId: 'local',
      bookId: 'book_dom_casmurro',
      index: 1,
      title: 'Capítulo II · Do Livro',
      wordCount: 268,
      htmlContent: `
        <p>Agora que expliquei o título, passo a escrever o livro. Antes disso, porém, digamos os motivos que me põem a pena na mão.</p>
        <p>Vivo só, com um criado. A casa em que moro é própria; fi-la construir de propósito, levado de um desejo tão particular que me vexa imprimi-lo, mas vá lá. Um dia, há bastantes anos, lembrou-me reproduzir no Engenho Novo a casa em que me criei na antiga Rua de Matacavalos, dando-lhe o mesmo aspecto e economia daquela outra, que desapareceu.</p>
        <p>Construtor e pintor entenderam bem as indicações que lhes fiz: é o mesmo prédio assobradado, três janelas de frente, varanda ao fundo, as mesmas alcovas e salas. Na principal destas, a pintura do teto e das paredes é mais ou menos igual, umas grinaldas de flores miúdas e grandes pássaros que as tomam nos bicos, de espaço a espaço.</p>
        <blockquote>O meu fim evidente era atar as duas pontas da vida, e restaurar na velhice a adolescência. Pois, senhor, não consegui recompor o que foi nem o que fui.</blockquote>
        <p>Em tudo, se o rosto é igual, a fisionomia é diferente. Se só me faltassem os outros, vá; um homem consola-se mais ou menos das pessoas que perde; mas falto eu mesmo, e esta lacuna é tudo. O que aqui está é, mal comparando, semelhante à pintura que se põe na barba e nos cabelos, e que apenas conserva o hábito externo, como se diz nas autópsias; o interno não aguenta tinta.</p>
      `,
    },
    {
      id: 'ch_2',
      ownerId: 'local',
      bookId: 'book_dom_casmurro',
      index: 2,
      title: 'Capítulo III · A Denúncia',
      wordCount: 214,
      htmlContent: `
        <p>Ia a entrar na sala de visitas, quando ouvi proferir o meu nome e escondi-me atrás da porta. A casa era a da Rua de Matacavalos, o mês novembro, o ano é que é um tanto remoto, mas eu não hei de trocar as datas à minha vida só para agradar às pessoas que não amam histórias velhas; o ano era de 1857.</p>
        <p>— Dona Glória, a senhora persiste na ideia de meter o nosso Bentinho no seminário? É mais que tempo, e já agora pode haver uma dificuldade.</p>
        <p>— Que dificuldade?</p>
        <p>— Uma grande dificuldade.</p>
        <p>Minha mãe quis saber o que era. José Dias, depois de alguns instantes de concentração, veio ver se havia alguém no corredor; não deu por mim, voltou e, abafando a voz, disse que a dificuldade estava na casa ao pé, a gente do Pádua.</p>
        <p>— A gente do Pádua?</p>
        <p>— Há algum tempo estou para lhe dizer isto, mas não me atrevia. Não me parece bonito que o nosso Bentinho ande metido nos cantos com a filha do Tartaruga, e esta é a dificuldade, porque se eles pegam de namoro, a senhora terá muito que lutar para separá-los.</p>
      `,
    },
    {
      id: 'ch_3',
      ownerId: 'local',
      bookId: 'book_dom_casmurro',
      index: 3,
      title: 'Capítulo XXXII · Olhos de Ressaca',
      wordCount: 228,
      htmlContent: `
        <p>Tudo era matéria às curiosidades de Capitu. Caso houve, porém, no qual não sei se aprendeu ou ensinou, ou se fez ambas as coisas, como eu. É o que vou contar no próximo capítulo. Neste direi somente que, passados alguns dias do ajuste com o agregado, fui ver a minha amiga; eram dez horas da manhã.</p>
        <p>Dona Fortunata, que estava no quintal, nem esperou que lhe perguntasse pela filha.</p>
        <p>— Está na sala penteando o cabelo, disse-me; vá devagarzinho para lhe pregar um susto.</p>
        <p>Fui devagar, mas ou o pé ou o espelho traiu-me. Pode ser que não fosse nenhum deles e que ela, ouvindo o meu passo, não quisesse voltar a cabeça senão quando eu chegasse à porta. Quando entrei, Capitu penteava os cabelos, sentada de costas para mim, diante do espelhinho oval.</p>
        <blockquote>Retórica dos namorados, dá-me uma comparação exata e poética para dizer o que foram aqueles olhos de Capitu. Não me acode imagem capaz de dizer, sem quebra da dignidade do estilo, o que eles foram e me fizeram. Olhos de ressaca? Vá, de ressaca. É o que me dá ideia daquela feição nova.</blockquote>
        <p>Traziam não sei que fluido misterioso e enérgico, uma força que arrastava para dentro, como a vaga que se retira da praia, nos dias de ressaca.</p>
      `,
    },
  ],
  book_o_alienista: [
    {
      id: 'ch_0',
      ownerId: 'local',
      bookId: 'book_o_alienista',
      index: 0,
      title: 'Capítulo I · De como Itaguaí ganhou uma Casa de Orates',
      wordCount: 220,
      htmlContent: `
        <p>As crônicas da vila de Itaguaí dizem que em tempos remotos vivera ali um certo médico, o Dr. Simão Bacamarte, filho da nobreza da terra e o maior dos médicos do Brasil, de Portugal e das Espanhas. Estudara em Coimbra e Pádua. Aos trinta e quatro anos regressou ao Brasil, não podendo el-rei alcançar dele que ficasse em Coimbra, regendo a universidade, ou em Lisboa, expedindo os negócios da monarquia.</p>
        <blockquote>— A ciência, disse ele a Sua Majestade, é o meu emprego único; Itaguaí é o meu universo.</blockquote>
        <p>Dito isto, meteu-se em Itaguaí, e entregou-se de corpo e alma ao estudo da ciência, alternando as curas com as leituras, e demonstrando os teoremas com cataplasmas. Aos quarenta anos casou com D. Evarista da Costa e Mascarenhas, senhora de vinte e cinco anos, viúva de um juiz de fora, e não bonita nem simpática.</p>
        <p>Um dos tios dele, caçador de pacas perante o Eterno, e não menos franco, admirou-se de semelhante escolha e disse-lho. Simão Bacamarte explicou-lhe que D. Evarista reunia condições fisiológicas e anatômicas de primeira ordem, digeria com facilidade, dormia regularmente, tinha bom pulso e excelente vista; estava assim apta para dar-lhe filhos robustos, sãos e inteligentes.</p>
      `,
    },
    {
      id: 'ch_1',
      ownerId: 'local',
      bookId: 'book_o_alienista',
      index: 1,
      title: 'Capítulo II · Torrente de Loucos',
      wordCount: 195,
      htmlContent: `
        <p>Três dias depois, em uma sessão solene, a Câmara Municipal autorizou a construção da Casa Verde, assim chamada pela cor das janelas, que pela primeira vez aparecia em Itaguaí. Foi inaugurada com imensa pompa: de todas as vilas e povoações próximas, e até remotas, e da própria cidade do Rio de Janeiro, correu muita gente a assistir às cerimônias.</p>
        <p>A Casa Verde era o cárcere privado dos alienados. Desde os primeiros meses começou a povoar-se de maneira notável. Simão Bacamarte observava, classificava e comparava cada caso com rigor geométrico.</p>
        <p>— A razão é o perfeito equilíbrio de todas as faculdades; fora daí insânia, insânia e só insânia.</p>
        <p>Não tardou que a vila inteira começasse a olhar com assombro para o número crescente de recolhidos, pois bastava um gesto desmedido, uma vaidade discreta ou um escrúpulo excessivo para despertar a atenção clínica do alienista.</p>
      `,
    },
    {
      id: 'ch_2',
      ownerId: 'local',
      bookId: 'book_o_alienista',
      index: 2,
      title: 'Capítulo XIII · Plus Ultra!',
      wordCount: 185,
      htmlContent: `
        <p>Mas o ilustre médico, com os olhos acesos da convicção científica, trancou os ouvidos às queixas da vila e prosseguiu na revisão de sua teoria. Se quatro quintos da população haviam passado pela Casa Verde, não estaria o erro justamente na definição inicial do equilíbrio?</p>
        <p>Invertendo a hipótese com a serenidade de um geômetra, concluiu que a verdadeira loucura talvez residisse no equilíbrio perfeito e inabalável — e que os pequenos desvios humanos constituíam a norma natural do espírito.</p>
        <p>Assim, depois de restituir a liberdade a todos os antigos internos, o Dr. Simão Bacamarte recolheu-se pessoalmente à Casa Verde, convicto de reunir em si mesmo todas as características do equilíbrio absoluto que a ciência buscava compreender.</p>
      `,
    },
  ],
  book_a_cartomante: [
    {
      id: 'ch_0',
      ownerId: 'local',
      bookId: 'book_a_cartomante',
      index: 0,
      title: 'I · Hamlet e a Cartomante',
      wordCount: 198,
      htmlContent: `
        <p>Hamlet observa a Horácio que há mais coisas no céu e na terra do que sonha a nossa filosofia. Era a mesma explicação que dava a bela Rita ao moço Camilo, numa sexta-feira de novembro de 1869, quando este ria dela, por ter ido na véspera consultar uma cartomante; a diferença é que o fazia por outras palavras.</p>
        <p>— Ria, ria. Os homens são assim; não acreditam em nada. Pois saiba que fui, e que ela adivinhou o motivo da consulta, antes mesmo que eu lhe dissesse o que era. Apenas começou a botar as cartas, disse-me: "A senhora gosta de uma pessoa..." Confessei que sim, e então ela continuou a tirar as cartas, combinou-as, e no fim declarou-me que eu tinha medo de que você me esquecesse, mas que não era verdade.</p>
        <p>— Errou! interrompeu Camilo, rindo.</p>
        <p>— Não diga isso, Camilo. Se você soubesse como eu tenho andado pensativa, por sua causa...</p>
      `,
    },
    {
      id: 'ch_1',
      ownerId: 'local',
      bookId: 'book_a_cartomante',
      index: 1,
      title: 'II · O Bilhete de Vilela',
      wordCount: 184,
      htmlContent: `
        <p>Vilela, Camilo e Rita formavam um trio inseparável desde a volta do casal da província. Camilo havia perdido a mãe recentemente e encontrara no lar do amigo de infância um refúgio diário. Com o passar dos meses, porém, o afeto silencioso transformou-se em segredo.</p>
        <p>Começaram então a chegar cartas anônimas denunciando a traição. Temendo uma tragédia, ambos passaram a espaçar os encontros, até que certa tarde Camilo recebeu em casa um bilhete lacônico escrito com letra trêmula:</p>
        <blockquote>"Vem já, já, à nossa casa; preciso falar-te sem demora. Vilela."</blockquote>
        <p>Camilo empalideceu. Leu o papel duas, três vezes. Chamou um tílburi à pressa e partiu em direção a Botafogo, dividido entre o remorso e a incerteza do que encontraria à porta.</p>
      `,
    },
    {
      id: 'ch_2',
      ownerId: 'local',
      bookId: 'book_a_cartomante',
      index: 2,
      title: 'III · Rua da Guarda Velha',
      wordCount: 190,
      htmlContent: `
        <p>No caminho, o tílburi deteve-se diante de uma carroça tombada precisamente na Rua da Guarda Velha, defronte à casa da cartomante que Rita tanto elogiara. Impelido por uma súbita necessidade de alívio, Camilo subiu a escada estreita e bateu à porta.</p>
        <p>A mulher acolheu-o com voz calma, embaralhou o maço gasto de cartas sobre o pano gasto da mesa e sorriu com segurança serena: garantiu-lhe que nada havia a temer, que o amigo ignorava tudo e que ambos seriam felizes.</p>
        <p>Restaurado pela esperança, Camilo desceu as escadas quase leve, pagou o cocheiro e entrou enfim na casa de Vilela — onde o silêncio da sala guardava um desfecho muito diverso daquele prometido pelas cartas.</p>
      `,
    },
  ],
};
