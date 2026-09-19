/* Carte narrative V62 : compacte ; embranchements et découvertes conservés. */
(function(){
  const book = BookRegistry.get("ecuyer-01-player-test");
  if (book) book.adventureMap = {
  "mode": "player",
  "version": 2,
  "width": 680,
  "height": 989,
  "nodes": [
    {
      "id": "ecuries",
      "label": "Écuries",
      "x": 309,
      "y": 42,
      "pages": [
        "c1"
      ],
      "notes": []
    },
    {
      "id": "sacoche",
      "label": "Sacoche d’Aldren",
      "x": 172,
      "y": 90,
      "pages": [
        "c2"
      ],
      "notes": [
        {
          "page": "c2",
          "text": "Les notes d’Aldren disent « ne pas ouvrir l’œil » et mentionnent le soufre, une lame noire, la terre noire, une paroi et un avertissement interrompu."
        }
      ]
    },
    {
      "id": "place",
      "label": "Place de Valombre",
      "x": 411,
      "y": 92,
      "pages": [
        "c3"
      ],
      "notes": []
    },
    {
      "id": "marchand",
      "label": "Marchand",
      "x": 517,
      "y": 146,
      "pages": [
        "c4"
      ],
      "notes": []
    },
    {
      "id": "forge",
      "label": "Forge",
      "x": 374,
      "y": 157,
      "pages": [
        "c5"
      ],
      "notes": []
    },
    {
      "id": "ruelle",
      "label": "Ruelle",
      "x": 565,
      "y": 207,
      "pages": [
        "c6",
        "c7"
      ],
      "notes": [
        {
          "page": "c7",
          "text": "L’inconnu semble terrifié par quelque chose qu’il annonce en répétant : « Ils arrivent. » Quelque chose remue sous la peau de son cou."
        }
      ]
    },
    {
      "id": "chemin",
      "label": "Chemin de la montagne",
      "x": 289,
      "y": 238,
      "pages": [
        "c8"
      ],
      "notes": []
    },
    {
      "id": "gaspard",
      "label": "Gaspard Vellin",
      "x": 169,
      "y": 302,
      "pages": [
        "c9",
        "c10",
        "c11",
        "c12",
        "c13"
      ],
      "notes": [
        {
          "page": "c9",
          "text": "Gaspard Vellin a été retrouvé au bord du chemin. Sa gorge contient une terre noire et son corps dégage une odeur de soufre."
        },
        {
          "page": "c13",
          "text": "La fiole retrouvée sur Gaspard ressemble à une potion de guérison, mais son liquide est anormalement sombre."
        }
      ]
    },
    {
      "id": "foret",
      "label": "Forêt",
      "x": 454,
      "y": 297,
      "pages": [
        "c14"
      ],
      "notes": []
    },
    {
      "id": "rochebrume",
      "label": "Rochebrume",
      "x": 454,
      "y": 358,
      "pages": [
        "c15"
      ],
      "notes": []
    },
    {
      "id": "taverne",
      "label": "Taverne",
      "x": 354,
      "y": 412,
      "pages": [
        "c16",
        "c17",
        "c18"
      ],
      "notes": [
        {
          "page": "c17",
          "text": "À l’annonce de la mort de Gaspard, Élias murmure : « Pas lui aussi. » Il refuse ensuite de répondre aux questions."
        }
      ]
    },
    {
      "id": "etranger",
      "label": "Étranger",
      "x": 562,
      "y": 428,
      "pages": [
        "c19"
      ],
      "notes": [
        {
          "page": "c19",
          "text": "Un étranger raconte que les habitants de Rochebrume disparaissent un par un. Son propre visage devient impossible à se rappeler dès qu’on détourne les yeux."
        }
      ]
    },
    {
      "id": "grotte",
      "label": "Entrée de la grotte",
      "x": 286,
      "y": 504,
      "pages": [
        "c20"
      ],
      "notes": []
    },
    {
      "id": "acide",
      "label": "Passage acide",
      "x": 141,
      "y": 568,
      "pages": [
        "c21"
      ],
      "notes": []
    },
    {
      "id": "ombres",
      "label": "Salle des ombres",
      "x": 408,
      "y": 568,
      "pages": [
        "c22",
        "c24",
        "c25",
        "c26",
        "c27",
        "c29",
        "c33"
      ],
      "notes": []
    },
    {
      "id": "fuite",
      "label": "Fuite",
      "x": 534,
      "y": 624,
      "pages": [
        "c23"
      ],
      "notes": []
    },
    {
      "id": "camp",
      "label": "Camp sous la roche",
      "x": 366,
      "y": 664,
      "pages": [
        "c28",
        "c30"
      ],
      "notes": [
        {
          "page": "c28",
          "text": "Anselme Varn affirme que ceux qui disparaissent viennent d’eux-mêmes dans la grotte. Il avertit de ne pas laisser la terre noire pénétrer dans le corps."
        },
        {
          "page": "c30",
          "text": "Le carnet d’Anselme indique qu’il entend sa femme, morte depuis onze ans. Les dates contredisent son impression de n’être ici que depuis quelques jours."
        }
      ]
    },
    {
      "id": "galerie",
      "label": "Galerie condamnée",
      "x": 206,
      "y": 736,
      "pages": [
        "c31",
        "c32"
      ],
      "notes": []
    },
    {
      "id": "tunnel",
      "label": "Tunnel voisin",
      "x": 528,
      "y": 736,
      "pages": [
        "c34",
        "c35",
        "c36",
        "c38"
      ],
      "notes": [
        {
          "page": "c35",
          "text": "La silhouette du tunnel explique que ses jambes l’ont conduit malgré lui vers la montagne."
        }
      ]
    },
    {
      "id": "fissures",
      "label": "Passage des fissures",
      "x": 360,
      "y": 806,
      "pages": [
        "c37",
        "c39"
      ],
      "notes": []
    },
    {
      "id": "monde",
      "label": "Monde sous la montagne",
      "x": 360,
      "y": 876,
      "pages": [
        "c40"
      ],
      "notes": []
    }
  ],
  "edges": [
    [
      "ecuries",
      "sacoche"
    ],
    [
      "ecuries",
      "place"
    ],
    [
      "chemin",
      "ecuries"
    ],
    [
      "place",
      "sacoche"
    ],
    [
      "chemin",
      "sacoche"
    ],
    [
      "marchand",
      "place"
    ],
    [
      "forge",
      "place"
    ],
    [
      "place",
      "ruelle"
    ],
    [
      "chemin",
      "ruelle"
    ],
    [
      "chemin",
      "place"
    ],
    [
      "chemin",
      "gaspard"
    ],
    [
      "chemin",
      "foret"
    ],
    [
      "chemin",
      "grotte"
    ],
    [
      "foret",
      "gaspard"
    ],
    [
      "gaspard",
      "grotte"
    ],
    [
      "foret",
      "rochebrume"
    ],
    [
      "rochebrume",
      "taverne"
    ],
    [
      "etranger",
      "rochebrume"
    ],
    [
      "etranger",
      "taverne"
    ],
    [
      "grotte",
      "taverne"
    ],
    [
      "etranger",
      "grotte"
    ],
    [
      "grotte",
      "rochebrume"
    ],
    [
      "acide",
      "grotte"
    ],
    [
      "grotte",
      "ombres"
    ],
    [
      "fuite",
      "ombres"
    ],
    [
      "camp",
      "ombres"
    ],
    [
      "camp",
      "galerie"
    ],
    [
      "camp",
      "tunnel"
    ],
    [
      "camp",
      "fissures"
    ],
    [
      "fissures",
      "monde"
    ]
  ],
  "deathPages": [
    "c21",
    "c23"
  ],
  "endingPages": [
    "c40"
  ]
};
})();
