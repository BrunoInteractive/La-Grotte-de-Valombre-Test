/* Découvertes narratives de Valombre V68.44, sans carte. */
(function(){
  const book = BookRegistry.get("ecuyer-01");
  if (book) book.journalEntries = [
  {
    "id": "sacoche:c2",
    "page": "c2",
    "title": "Sacoche d’Aldren",
    "text": "Les notes d’Aldren demandent d’ouvrir l’œil fermé et de trouver une lame noire. Elles mettent en garde contre la terre noire et le soufre."
  },
  {
    "id": "ruelle:c7",
    "page": "c7",
    "title": "Ruelle",
    "text": "L’inconnu semble terrifié par quelque chose qu’il annonce en répétant : « Ils arrivent. » Quelque chose remue sous la peau de son cou."
  },
  {
    "id": "gaspard:c9",
    "page": "c9",
    "title": "Gaspard Vellin",
    "text": "Gaspard Vellin a été retrouvé au bord du chemin. Sa gorge contient une terre noire et son corps dégage une odeur de soufre."
  },
  {
    "id": "gaspard:c13",
    "page": "c13",
    "title": "Gaspard Vellin",
    "text": "La fiole retrouvée sur Gaspard ressemble à une potion de guérison, mais son liquide est anormalement sombre."
  },
  {
    "id": "taverne:c17",
    "page": "c17",
    "title": "Taverne",
    "text": "À l’annonce de la mort de Gaspard, Élias murmure : « Pas lui aussi. » Il refuse ensuite de répondre aux questions."
  },
  {
    "id": "etranger:c19",
    "page": "c19",
    "title": "Étranger",
    "text": "Un étranger raconte que les habitants de Rochebrume disparaissent un par un."
  },
  {
    "id": "camp:c28",
    "page": "c28",
    "title": "Camp sous la roche",
    "text": "Anselme Varn affirme que ceux qui disparaissent viennent d’eux-mêmes dans la grotte. Il avertit de ne pas laisser la terre noire pénétrer dans le corps."
  },
  {
    "id": "camp:c30",
    "page": "c30",
    "title": "Camp sous la roche",
    "text": "Le carnet d’Anselme relate ses premières doses de terre noire pour faire taire la voix. Il augmente la dose lorsqu’elle revient, puis sent quelque chose bouger sous la peau de sa jambe. Les dates finissent par disparaître."
  },
  {
    "id": "tunnel:c35",
    "page": "c35",
    "title": "Tunnel voisin",
    "text": "La silhouette du tunnel raconte que ses jambes l’ont conduit malgré lui vers la montagne, alors qu’il voulait rester chez lui."
  },
  {
    "id": "lac:c42",
    "page": "c42",
    "title": "Lac noir",
    "text": "Très loin sous la surface noire du lac apparaissent des lueurs et des formes qui évoquent une construction engloutie."
  },
  {
    "id": "ilot:c47",
    "page": "c47",
    "title": "Îlot",
    "text": "Sur l’îlot, une dalle porte le symbole de l’œil fermé. Une créature aux proportions anormales garde les ruines."
  },
  {
    "id": "fresques:c50",
    "page": "c50",
    "title": "Fresques",
    "text": "Une fresque montre des voyageurs venus d’horizons différents, marchant vers la montagne puis franchissant une arche marquée de l’œil fermé."
  },
  {
    "id": "fresques:c51",
    "page": "c51",
    "title": "Fresques",
    "text": "Une autre gravure représente un voyageur levant une petite lame noire vers l’œil fermé d’une porte. La suite de la scène a été détruite."
  },
  {
    "id": "hauts:c67",
    "page": "c67",
    "title": "Quartiers hauts",
    "text": "Des symboles de l’œil fermé et des marques de craie indiquent les passages utilisés par les Veilleurs dans la cité."
  },
  {
    "id": "passerelle:c65",
    "page": "c65",
    "title": "Porte suspendue",
    "text": "Dans la sacoche d’un Veilleur mort près du pont, un nouvel ordre interdit toute entrée et toute sortie, et exige de n’épargner personne. Trois lames de jet y étaient également conservées."
  },
  {
    "id": "cite:c70",
    "page": "c70",
    "title": "Cité morte",
    "text": "Une fresque montre des hommes et des femmes construisant les maisons et les rues de la cité. D’anciennes routes la relient à la surface, les bâtisseurs se rassemblent ensuite autour d’une ouverture sous la ville."
  },
  {
    "id": "cite:c71",
    "page": "c71",
    "title": "Cité morte",
    "text": "Une fresque montre les premiers Veilleurs bâtissant une prison autour d’une forme immense, puis fermant une porte marquée de l’œil fermé. Leur raison reste inconnue."
  },
  {
    "id": "cite:c72",
    "page": "c72",
    "title": "Cité morte",
    "text": "Les gravures montrent une influence traversant les murs de la prison jusqu’aux esprits de personnes qui partent ensuite vers la porte scellée."
  },
  {
    "id": "refectoire:c76",
    "page": "c76",
    "title": "Réfectoire",
    "text": "Une devise des Veilleurs affirme que leur veille doit préserver les habitants de la surface."
  },
  {
    "id": "garde:c77",
    "page": "c77",
    "title": "Poste de garde",
    "text": "Une consigne demande de conduire toute personne entendant l’appel aux salles de soins. Les gardes devaient isoler ceux qui tentaient de rejoindre la prison."
  },
  {
    "id": "garde:c78",
    "page": "c78",
    "title": "Poste de garde",
    "text": "Un registre décrit deux gardes volontairement contaminés. Ils ne répondent plus à l’appel, leurs corps se sont déformés et ils ont été enfermés près du poste."
  },
  {
    "id": "bureau:c83",
    "page": "c83",
    "title": "Bureau fermé",
    "text": "Le bureau du commandement contient des instructions devenues plus sévères, allant jusqu’à ordonner des exécutions au premier soupçon. Une autre main a contesté ces ordres.",
    "requiresFlag": "officeOpened"
  },
  {
    "id": "bureau:c84",
    "page": "c84",
    "title": "Bureau fermé",
    "text": "Deux rapports des appartements révèlent un conflit entre les Veilleurs : certains réclament des exécutions, d’autres des preuves et la poursuite des soins."
  },
  {
    "id": "appartements:c88",
    "page": "c88",
    "title": "Appartements",
    "text": "Un collier a été laissé sur un prisonnier enfermé dans les anciens appartements."
  },
  {
    "id": "observation:c93",
    "page": "c93",
    "title": "Quartier d’observation",
    "text": "Un chevalier d’un village voisin dit avoir entendu l’appel et être venu dans la cité il y a peu. Il ne semble plus maître de ses actes."
  },
  {
    "id": "observation:c94",
    "page": "c94",
    "title": "Quartier d’observation",
    "text": "Le chevalier a tenté de résister à l’appel en s’injectant de la terre noire. Son corps s’est déformé et il a fini par s’enfermer lui-même."
  },
  {
    "id": "cahiers:c96",
    "page": "c96",
    "title": "La dernière cellule",
    "text": "Le chevalier supplie d’être libéré ou achevé. Il dit avoir utilisé toute sa réserve de remède blanc, qui faisait revenir l’appel."
  },
  {
    "id": "cahiers:c145",
    "page": "c145",
    "title": "La dernière cellule",
    "text": "Un petit bouclier récupéré après le combat absorbe jusqu’à six dégâts, au prix d’un point de Dextérité tant qu’il protège.",
    "requiresFlag": "knightShieldTaken"
  },
  {
    "id": "laboratoire:c99",
    "page": "c99",
    "title": "Laboratoire",
    "text": "Les cahiers des Veilleurs racontent les soins prodigués aux personnes qui entendent l’appel. Les observations se succèdent sur plusieurs jours."
  },
  {
    "id": "laboratoire:c101",
    "page": "c101",
    "title": "Laboratoire",
    "text": "Les derniers registres parlent de transformations et de prisonniers devenus gardiens. Une annotation rappelle que ces sujets étaient encore des hommes."
  },
  {
    "id": "ampoule:c102",
    "page": "c102",
    "title": "Salle des injections",
    "text": "Des machines injectent la terre noire. Les installations ressemblent davantage à une salle de torture qu’à un lieu de soin."
  },
  {
    "id": "ampoule:c151",
    "page": "c151",
    "title": "Salle des injections",
    "text": "Le bras d’injection s’est brisé en retombant. Une étrange bague lumineuse est apparue parmi les débris."
  },
  {
    "id": "ampoule:c196",
    "page": "c196",
    "title": "Salle des injections",
    "text": "La bague découverte sous la machine éclaire faiblement ce qui l’entoure et améliore ta Dextérité de deux points.",
    "requiresFlag": "labRingTaken"
  },
  {
    "id": "registres:c199",
    "page": "c199",
    "title": "Le jeune chevalier",
    "text": "La main du jeune chevalier était en réalité un tentacule. L’aider à se relever a révélé sa transformation."
  },
  {
    "id": "sceau_salle:c104",
    "page": "c104",
    "title": "Salle du sceau",
    "text": "Un plan gravé montre des routes vers la surface, barrées. Une inscription indique que la terre noire entretient le sceau de la prison."
  },
  {
    "id": "medecin:c105",
    "page": "c105",
    "title": "Registre du médecin",
    "text": "Selon le médecin, la terre noire affaiblit l’appel mais provoque la transformation. Le traitement blanc réduit la contamination de 4 points. Les potions rouge sombre altérées par la terre noire rendent 3 points de Vie mais ajoutent 2 points de contamination. Les potions rouges ordinaires restent des soins classiques."
  },
  {
    "id": "secours:c107",
    "page": "c107",
    "title": "Poste de secours",
    "text": "Le poste de secours possède une armoire médicale et une étagère de livres. Certains objets méritent une fouille plus attentive."
  },
  {
    "id": "reserve:c108",
    "page": "c108",
    "title": "Réserve de terre noire",
    "text": "La réserve est couverte d’une poussière épaisse. Un sachet de terre noire repose sur une étagère. Un couinement provient des sacs."
  },
  {
    "id": "grille:c110",
    "page": "c110",
    "title": "Grille condamnée",
    "text": "Un coffre renferme des dizaines de parchemins identiques appelant à libérer l’esprit et demandant des preuves de sa prétendue malveillance."
  },
  {
    "id": "grille:c111",
    "page": "c111",
    "title": "Grille condamnée",
    "text": "Le journal des confiscations évoque des arrestations, une révolte grandissante et des gardes refusant d’obéir. Son rédacteur finit par douter de la version officielle."
  },
  {
    "id": "puits:c115",
    "page": "c115",
    "title": "Puits des Veilleurs",
    "text": "Le chevalier laissé enfermé a forcé la porte et a attaqué pendant la descente du puits. La corde peut arrêter la chute, sans empêcher la blessure ni la contamination.",
    "requiresFlag": "knightWellAttackDone"
  },
  {
    "id": "porte:c116",
    "page": "c116",
    "title": "Porte sous la ville",
    "text": "La porte porte l’œil fermé et une petite lame noire, gravée plus récemment. Une empreinte de botte mène vers l’intérieur."
  },
  {
    "id": "profondeurs:c117",
    "page": "c117",
    "title": "Sous la Cité morte",
    "text": "Les traces de bottes se poursuivent dans la poussière des marches, vers les niveaux anciens."
  },
  {
    "id": "corniche:c164",
    "page": "c164",
    "title": "Corniche inférieure",
    "text": "Trois lames de jet et une potion trouvées sur la corniche.",
    "requiresFlag": "labyrinthCorpseLooted"
  },
  {
    "id": "don:c175",
    "page": "c175",
    "title": "Épée du forgeron-sorcier",
    "text": "Une femme blessée transmet une épée rouge équilibrée, une ampoule blanche, de la terre noire et une potion.",
    "requiresFlag": "labyrinthWomanGiftTaken"
  },
  {
    "id": "passage-secret:c185",
    "page": "c185",
    "title": "Le livre de bois",
    "text": "Le faux livre de l’étagère commande une trappe dissimulée dans le poste de secours."
  },
  {
    "id": "soignant:c187",
    "page": "c187",
    "title": "Le cahier du soignant",
    "text": "Un soignant ne croyait plus aux Veilleurs. Il espérait aider les prisonniers à se révolter et a caché un remède contre la terre noire."
  },
  {
    "id": "remede:c189",
    "page": "c189",
    "title": "L’ampoule du soignant",
    "requiresFlag": "secretAmpouleTaken",
    "text": "Tu as récupéré l’ampoule blanche que le soignant avait soustraite à la destruction ordonnée par les Veilleurs."
  },
  {
    "id": "armoire:c139",
    "page": "c139",
    "title": "L’ampoule du poste de secours",
    "requiresFlag": "commonAmpouleTaken",
    "text": "Tu as découvert une ampoule blanche intacte dans l’armoire médicale. Elle permet de réduire la contamination par la terre noire."
  },
  {
    "id": "reserve:c140",
    "page": "c140",
    "title": "La sacoche de terre noire",
    "text": "Tu as récupéré une dose de terre noire, sans la consommer."
  },
  {
    "id": "rat:c191",
    "page": "c191",
    "title": "Quelque chose dans les sacs",
    "text": "Un rat difforme de taille anormale a surgi des sacs de la réserve et t’a attaqué."
  },
  {
    "id": "rat:c195",
    "page": "c195",
    "title": "Les trois lames récupérées",
    "text": "Après l’affrontement dans la réserve, tu as trouvé trois lames de jet dans le sac du rat."
  },
  {
    "id": "chevalier:c197",
    "page": "c197",
    "title": "Une silhouette dans le couloir",
    "text": "Un très jeune chevalier est accroupi dans le couloir. Il semble perdu et pleure."
  }
  ,{"id":"horde:c202","page":"c202","title":"Les condamnés","text":"Une multitude de corps transformés errait dans la grande caverne. Tu as survécu à leur assaut."}
  ,{"id":"aldren:c203","page":"c203","title":"Sir Aldren","text":"Sir Aldren a survécu jusqu’à la prison, mais la transformation a déjà gagné la partie inférieure de son corps."}
  ,{"id":"lame:c206","page":"c206","title":"La lame noire","text":"Aldren avait trouvé la lame noire. Elle est capable de trancher les liens du sceau ou de frapper le cœur de l’esprit.","requiresFlag":"blackBladeRecovered"}
  ,{"id":"sac:c210","page":"c210","title":"La poudre","text":"Une autre survivante détient un sac de poudre capable de faire s’effondrer la voûte de la prison."}
  ,{"id":"esprit:c212","page":"c212","title":"L’esprit prisonnier","text":"La voix affirme avoir été emprisonnée par un sorcier jaloux. Son récit varie avec la terre noire qui brouille tes perceptions. Sa véracité reste incertaine."}

];
})();
