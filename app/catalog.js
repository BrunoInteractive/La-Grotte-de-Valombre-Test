/* Catalogue de la future bibliothèque. Les entrées "planned" ne sont pas encore chargées par le lecteur. */
window.COLLECTION_CATALOG = {
  version: 2,
  defaultBookId: 'ecuyer-01',
  series: [
    { id: 'ecuyer', title: 'L’Écuyer' },
    { id: 'navire-fantome', title: 'Le Navire fantôme' },
    { id: 'sherpa', title: 'Le Sherpa' },
    { id: 'policier-parisien', title: 'Le Policier parisien' }
  ],
  books: [
    { id: 'ecuyer-01', seriesId: 'ecuyer', episode: 1, slug: 'la-grotte-de-valombre', title: 'La Grotte de Valombre', access: 'free', status: 'available' },
    { id: 'navire-fantome-01', seriesId: 'navire-fantome', episode: 1, title: 'Le Navire fantôme', access: 'free', status: 'planned' },
    { id: 'sherpa-01', seriesId: 'sherpa', episode: 1, title: 'Le Sherpa', access: 'premium', status: 'planned' },
    { id: 'policier-parisien-01', seriesId: 'policier-parisien', episode: 1, title: 'Le Policier parisien', access: 'premium', status: 'planned' }
  ]
};
