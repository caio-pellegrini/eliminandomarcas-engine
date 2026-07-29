const {
  createRouletteLayout,
  getSpinStartRotation,
  positiveModulo,
  shuffleBrands,
} = require('../src/render/rouletteLayout');

const brands = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

test('embaralha a ordem visual de forma reproduzível para cada dia', () => {
  const dayOne = shuffleBrands(brands, 1);
  const repeatedDayOne = shuffleBrands(brands, 1);
  const dayTwo = shuffleBrands(brands, 2);

  expect(dayOne).toEqual(repeatedDayOne);
  expect(dayTwo).not.toEqual(dayOne);
  expect(dayOne).not.toEqual(brands);
  expect([...dayOne].sort()).toEqual([...brands].sort());
});

test('calcula a parada a partir da posição embaralhada da eliminada', () => {
  const layout = createRouletteLayout(brands, 'D', 7);
  const eliminatedAngle = layout.eliminatedIndex * layout.segmentAngle;

  expect(layout.labels[layout.eliminatedIndex]).toBe('D');
  expect(positiveModulo(eliminatedAngle + layout.finalRotation, 360)).toBeCloseTo(0);
  expect(getSpinStartRotation(layout.finalRotation) - layout.finalRotation).toBe(-2610);
});

test('a eliminada não fica presa à mesma posição relativa ao ponteiro', () => {
  const firstDay = createRouletteLayout(brands, 'D', 1);
  const secondDay = createRouletteLayout(brands, 'D', 2);

  expect(firstDay.eliminatedIndex).not.toBe(secondDay.eliminatedIndex);
  expect(firstDay.finalRotation).not.toBe(secondDay.finalRotation);
});

test('falha claramente se a marca eliminada não estiver na roleta', () => {
  expect(() => createRouletteLayout(brands, 'X', 1)).toThrow(/não está entre as marcas/);
});
