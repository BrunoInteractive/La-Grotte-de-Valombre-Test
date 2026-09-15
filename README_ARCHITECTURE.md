# Collection — V13 / identifiants stables

Cette version conserve l’application et le moteur séparés, mais fixe une convention durable pour les séries et les épisodes.

## Identité permanente de Valombre

- Série : `ecuyer`
- Épisode : `01`
- ID permanent du livre : `ecuyer-01`
- Slug : `la-grotte-de-valombre`
- Dossier : `books/ecuyer/01-la-grotte-de-valombre/`

L’ID et le chemin interne ne doivent plus dépendre du numéro de version de développement.

## Structure

- `index.html` : coque visuelle du lecteur.
- `engine/core.js` : dés, inventaire générique et registre des livres.
- `engine/reader.js` : navigation, sauvegarde, checkpoints, journal et affichage.
- `app/catalog.js` : catalogue de la future bibliothèque.
- `books/ecuyer/01-la-grotte-de-valombre/book.js` : contenu narratif et règles propres à Valombre.
- `books/ecuyer/01-la-grotte-de-valombre/images/` : images propres au livre.
- `books/ecuyer/01-la-grotte-de-valombre/book.json` : métadonnées du livre.

## Versionnage

Le numéro `V13` ne sert qu’au ZIP de travail. Il n’apparaît pas dans l’identité permanente du livre.

Le livre possède des métadonnées séparées :

- `contentVersion` : version du contenu du livre ; peut évoluer à chaque mise à jour.
- `saveVersion` : version du format de sauvegarde ; ne change que si la structure de sauvegarde doit réellement migrer.

Ainsi, une future V21 pourra toujours utiliser le même dossier `books/ecuyer/01-la-grotte-de-valombre/` et le même ID `ecuyer-01`.

## Sauvegardes

La sauvegarde principale utilise désormais l’ID stable :

- partie du livre : `ldveh.book.ecuyer-01.save.v1`
- mémoire de série : `ldveh.series.ecuyer.profile.v1`

La V13 tente aussi de récupérer automatiquement :

- la sauvegarde V12 utilisant l’ancien ID `ecuyer-01-valombre` ;
- les anciennes sauvegardes Valombre de la V11.

## Futurs épisodes

Exemple de structure :

```text
books/
  ecuyer/
    01-la-grotte-de-valombre/
    02-nouvelle-aventure/
    03-autre-aventure/
```

Les ZIP de développement peuvent continuer à s’appeler `..._V13.zip`, `..._V14.zip`, etc. Cela ne change jamais les IDs ni les chemins internes.


## V14 TEST — combats opposés
- Combat : Dextérité + 2D6 contre Dextérité + 2D6.
- Égalité : aucun dégât.
- Victoire du héros : dégâts = Puissance de l’arme.
- Victoire de l’adversaire : dégâts = Force de l’adversaire.
- Fiches adversaires intégrées : Masse dans l’ombre (Vie 6, Force 3, Dextérité 4) ; Disparu de Rochebrume (Vie 3, Force 3, Dextérité 5).
- Les tests hors combat restent en 3D6 ≤ caractéristique.


## V15 TEST — Force + puissance de l’arme
- Combat : Dextérité + 2D6 contre Dextérité + 2D6.
- Égalité : aucun dégât.
- Le gagnant inflige : Force + Puissance de l’arme s’il en possède une.
- Masse dans l’ombre : Vie 14, Force 3, Dextérité 4.
- Disparu de Rochebrume : Vie 6, Force 3, Dextérité 5.
- Les caractéristiques Chance, Force et Dextérité n’affichent plus `/18` et n’ont plus de plafond à 18.
- Seule la Vie conserve un maximum affiché.
- Les tests hors combat restent en 3D6 ≤ caractéristique.
- Ajout d’une bulle « Règles des combats » et d’un rappel clair de chaque caractéristique au début.
- Les illustrations sont désormais gérées séparément et ne sont plus incluses dans les ZIP de développement.


## V16 TEST — textes de présentation
- La Vie est décrite simplement comme la santé du héros ; la phrase sur ce qui le rend humain est retirée.
- La Dextérité précise désormais qu’elle peut être affectée par l’équipement porté, notamment une arme lourde.
- Le rappel général des tests en 3D6 est retiré de la page d’introduction ; les règles apparaîtront au moment où les tests surviennent dans le jeu.


## V17 TEST — nouvel équilibrage Force / armes
- Héros au départ : Vie 18, Chance 12, Force 8, Dextérité 13, Puissance de l’arme 0.
- Épée lourde de Sir Aldren : Dextérité -4 (DEX 9 au départ), Puissance 4.
- Épée du forgeron : Dextérité -1 (DEX 12 au départ), Puissance 1.
- Combat opposé inchangé : Dextérité + 2D6 contre Dextérité + 2D6.
- Dégâts : bonus de Force + Puissance de l’arme ; bonus de Force = ⌊Force / 4⌋, minimum 1.
- Masse dans l’ombre : Vie 6, Force 8, Dextérité 5, dégâts 2.
- Disparu de Rochebrume : Vie 3, Force 3, Dextérité 8, dégâts 1.
- La mini-fiche adversaire affiche aussi les dégâts.
- Aucun fichier d’illustration n’est inclus ; le dossier images reste vide.


## V18 TEST — trois routes vers la Cité morte
- Suite développée jusqu’au point de convergence dans la Cité morte (page 88).
- Trois routes majeures : Lac noir, Grandes Marches, Pont.
- Illustrations toujours gérées séparément.

## V19 TEST — navigation directe entre les pages
- Le bouton ☰ en haut à droite devient un navigateur de test.
- Il affiche toutes les pages 001 à 088, triées par numéro, avec leur titre.
- La page courante est surlignée et automatiquement centrée à l’ouverture.
- Cliquer sur une page y va directement sans exécuter les effets des choix ou des pages précédentes.
- L’état courant (inventaire, caractéristiques, objets, blessures) est conservé pendant ce saut de test.
- Le menu ne contient plus les anciens boutons Continuer / Inventaire / Recommencer ; ces fonctions restent accessibles ailleurs dans l’interface.


## V21 — Inventaire de test

- L’inventaire affiche dès le départ tous les objets déjà introduits jusqu’à la page 88.
- Chaque objet peut être coché/décoché pour simuler sa possession.
- Le Brassard et l’Anneau appliquent leurs bonus uniquement lorsqu’ils sont cochés.
- Les lames de jet passent à 3 lorsqu’elles sont cochées et à 0 lorsqu’elles sont décochées.
- Un sélecteur permet d’équiper Aucune arme / Grosse épée / Petite épée depuis l’inventaire.
- Cette interface est destinée uniquement aux versions TEST.


## V23 — direction créatures
Les créatures sont décrites par impressions contradictoires et détails difficiles à relier plutôt que par une anatomie exhaustive. Une créature blessée ne montre pas de peur : elle peut être physiquement repoussée ou ralentie, mais ne doute pas et ne protège pas instinctivement sa blessure. La fissure des Grandes Marches applique 2 dégâts (Protection puis Vie) et -1 Dextérité persistant.


## V23 — Style ténébreux et conséquences physiques
- Les descriptions des créatures suivent désormais une règle de perception incertaine : des détails isolés peuvent sembler familiers, mais l'ensemble refuse de former une anatomie stable ou identifiable.
- Le Rampant de l'îlot reprend la formulation validée : la comparaison rassurante avec un reptile se défait à mesure qu'il approche.
- La page 53 devient une véritable échappée de justesse : le héros se débat et s'arrache lui-même à la fissure ; aucune ressource d'eau n'est supposée. L'épreuve conserve 2 dégâts (Protection avant Vie), -1 Dextérité et la contamination à la terre noire.
- Une pièce de protection arrivée à 0 reste dans l'inventaire mais est marquée « endommagée — désormais inutilisable ». Le message apparaît aussi lors du coup qui la détruit.


## V24 — Cité morte et combats
- Navigation test étendue jusqu’à la page 088.
- Lames de jet désormais disponibles automatiquement dans tous les combats : 1 lame = 2 dégâts directs.
- Page 53 : sortie de la fissure réécrite comme une échappée in extremis par le héros.
- Messages de Protection reformulés au passé après résolution des dégâts.
- Cité morte développée : Salle des noms, Couloir des voix, Laboratoire des Veilleurs, perte de repères temporels, exploration commune et descente sous la cité.
- Nouveaux objets : Plaque du Veilleur et Ampoule blanche.
- Le Gantelet de Veilleur se récupère page 54 sur la route des Grandes Marches.


## V25 — Cité morte : aventure et exploration

- Page 66 : convergence des routes rendue plus discrète ; retrait de la phrase sur la poussière immobile ; le couloir des voix n'annonce plus les murmures avant d'y entrer.
- Page 78 : déclencheur du piège reformulé clairement (dalle qui s'abaisse + déclic).
- Page 80 : formulation volontairement plus mystérieuse sur le mal extrait par les machines.
- Pages 83–88 : suppression des aberrations trop explicites (craie, empreintes impossibles, fenêtre de Valombre). La progression devient plus physique : éboulement, passage de service, escalade, puits des Veilleurs, descente sécurisable avec la Ceinture de corde rouge, galerie de chantier et traces concrètes d'un passage récent vers les niveaux inférieurs.
- Direction : horreur lovecraftienne par le sous-entendu et l'ancienneté des lieux, mais aventure concrète et racontable, avec exploration physique dans un esprit archéologique.

## V26 — Cité morte : une histoire en trois chemins

- La Cité morte devient une zone de compréhension scénaristique, pas une simple succession de descriptions.
- Les trois chemins racontent trois facettes complémentaires du même phénomène :
  - Salle des noms : qui est touché et pourquoi les Veilleurs tenaient un registre des « appelés ».
  - Couloir des voix : comment l'appel utilise les morts, les proches, les souvenirs et les désirs pour faire venir les victimes d'elles-mêmes.
  - Laboratoire : comment les Veilleurs tentaient de retirer la terre noire et de faire taire l'appel.
- Chaque route contient assez d'indices pour que l'histoire principale soit compréhensible dès une première partie.
- La salle de veille (page 82) rassemble clairement les éléments essentiels sans exiger que le lecteur reconstitue seul l'intrigue.
- Les autres routes enrichissent ensuite la compréhension lors des parties suivantes, sans être obligatoires.
- Le nom du héros reste gravé dans la Salle des noms : il indique que le lien avec ce qui appelle sous la montagne a déjà commencé, sans expliquer encore son mécanisme.
- La dernière gravure de la Salle de veille prépare la recherche de la Lame noire et la descente vers la prochaine zone, destinée à être plus orientée action et combat.

## V27 — Rochebrume : continuité d’état
- Élias mémorise l’annonce de la mort de Gaspard.
- L’étranger ne réapparaît plus après sa disparition.


## V29 — actions sur place
- Les objets ramassables peuvent utiliser `stay: true` : l'effet est appliqué puis la page courante est simplement réaffichée, sans navigation vers une autre page.
- Page 30 : le casque cabossé est désormais ramassé sur place ; le bouton disparaît ensuite et l'illustration de la page 30 reste affichée.


### V32 — démo joueurs jusqu’à la page 40
La démo joueur se poursuit désormais dans les premières galeries et s’arrête à la page 40. Les pages marquées `noImage: true` sont rendues en texte seul.


## V32 — démo joueurs jusqu’à la page 40
- Page 4 sans image.
- Marchand et forgeron ne sont proposés qu'une seule fois sur la place de Valombre.
- L'achat des lames d'Élias se fait désormais directement sur la page 18, sans changement de page.
- La table des pages de la démo est correctement limitée aux pages 1 à 40.
