# La Grotte de Valombre — V68.119 Joueurs COMPLET — CACHE FIX

Décompresser TOUT le contenu de cette archive à la racine du dépôt GitHub Pages
des joueurs, en remplaçant les fichiers existants.

Fichiers importants ajoutés/modifiés :
- `sw.js` à la racine : Service Worker de mise à jour ;
- `engine/reader.js` : force un contrôle du Service Worker à chaque ouverture ;
- `version.json` : permet de vérifier facilement la version réellement publiée ;
- `index.html` : charge `reader.js?v=68.119`.

La sauvegarde du joueur reste dans `localStorage` et n'est pas supprimée.

IMPORTANT POUR LES PROCHAINES VERSIONS
À chaque nouvelle mise en ligne, augmenter `APP_VERSION` dans `sw.js`
(ex. 68.120, 68.121, etc.) et changer également la version du `reader.js`
dans `index.html` si `reader.js` a été modifié.

Le Service Worker utilise le réseau en priorité et conserve le cache seulement
comme secours hors connexion. Cela évite qu'une vieille version du livre reste
bloquée chez un testeur.
