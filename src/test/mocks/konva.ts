// Мок Konva для юнит-тестов.
// В node/jsdom-окружении реальный пакет konva резолвится на index-node.js,
// который требует нативный node-canvas. Для тестов чистых функций (filters)
// достаточно констант фильтров — здесь они представлены строками.
const Filters = {
  Grayscale: 'Grayscale',
  Sepia: 'Sepia',
  Brighten: 'Brighten',
  Contrast: 'Contrast',
  HSL: 'HSL',
  Blur: 'Blur',
} as const;

export default { Filters };
