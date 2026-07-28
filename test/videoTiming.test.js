const {getVideoTiming} = require('../src/render/videoTiming');

test.each([
  [9, 6],
  [10, 7],
])('reserva 3 segundos para o resultado em um vídeo de %ss', (duration, expectedRoulette) => {
  const timing = getVideoTiming(duration, 30);
  expect(timing.rouletteEndSeconds).toBe(expectedRoulette);
  expect(timing.rouletteEndFrame).toBe(expectedRoulette * 30);
  expect(timing.resultDurationSeconds).toBe(3);
});

test('a roleta começa no frame zero e desacelera antes do card final', () => {
  const timing = getVideoTiming(10, 30);
  expect(timing.rouletteStopFrame).toBeLessThan(timing.rouletteEndFrame);
  expect(timing.finalCardStartFrame).toBeLessThanOrEqual(timing.rouletteEndFrame);
});
