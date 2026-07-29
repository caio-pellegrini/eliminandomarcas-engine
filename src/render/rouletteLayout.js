const FULL_SPIN_DEGREES = -2610;

const positiveModulo = (value, divisor) => ((value % divisor) + divisor) % divisor;

function hashSeed(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleBrands(brands, day) {
  const shuffled = [...brands];
  const random = createRandom(hashSeed(`roulette-day-${day}`));
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}

function createRouletteLayout(brands, eliminatedBrand, day) {
  const labels = shuffleBrands(brands, day);
  const eliminatedIndex = labels.indexOf(eliminatedBrand);
  if (eliminatedIndex === -1) {
    throw new Error(`A marca eliminada ${eliminatedBrand} não está entre as marcas da roleta.`);
  }
  const segmentAngle = 360 / labels.length;
  return {
    labels,
    eliminatedIndex,
    segmentAngle,
    finalRotation: -eliminatedIndex * segmentAngle,
  };
}

function getSpinStartRotation(finalRotation) {
  return finalRotation + FULL_SPIN_DEGREES;
}

module.exports = {
  createRouletteLayout,
  getSpinStartRotation,
  positiveModulo,
  shuffleBrands,
};
