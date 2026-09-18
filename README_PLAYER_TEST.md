# V45 — Démo joueurs, continuité des sauvegardes

- Pages 1 à 40 ouvertes. À la page 40, les trois routes restent verrouillées ; la partie est conservée automatiquement.
- Une mise à jour pourra ouvrir les pages suivantes sans rejouer le prologue : mêmes personnages, Vie, inventaire, monnaie, choix, combats et checkpoint.
- Sauvegarde stable : `ldveh.book.ecuyer-01-player-test.save` et checkpoint `ldveh.book.ecuyer-01-player-test.checkpoint`.
- Migration automatique de la sauvegarde V40 (`*.save.v18` et `*.checkpoint.v18`) ; les anciennes données ne sont pas effacées.
- Les données restent locales à cette installation / ce navigateur et à l'adresse d'origine du jeu : ne pas changer de dépôt, de domaine ni d'identifiant du livre. Ne pas effacer les données du site ni désinstaller l'app sans sauvegarde externe.
- Pour la publication suivante, modifier `PUBLISHED_PAGE_COUNT` dans `book.js` (ex. `66`) après avoir terminé toutes les branches publiées, en laissant `id` et la clé stable inchangés ; le lecteur active les liens correspondants automatiquement.
- Toujours aucune illustration incluse ; déposer les PNG séparément dans `books/ecuyer/01-la-grotte-de-valombre/images/`.
