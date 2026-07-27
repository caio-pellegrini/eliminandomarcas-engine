const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {readSeasonState, validateState, writeSeasonState} = require('../src/core/seasonState');

const validState = {
  seasonId: 'test', seasonNumber: 1, name: 'Teste', niche: 'Teste', totalDays: 2,
  brands: ['A', 'B', 'C'], eliminationOrder: ['A', 'B'], currentDay: 1, history: [], lastRunAt: null,
};

test('grava e lê JSON de estado preservando os dados', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'eliminandomarcas-engine-'));
  const filePath = path.join(directory, 'state.json');
  try {
    await writeSeasonState(filePath, validState);
    await expect(readSeasonState(filePath)).resolves.toEqual(validState);
  } finally {
    await fs.rm(directory, {recursive: true, force: true});
  }
});

test('rejeita ordem com marca desconhecida', () => {
  expect(() => validateState({...validState, eliminationOrder: ['A', 'X']})).toThrow(/marca ausente/);
});

test('rejeita currentDay incoerente com o histórico', () => {
  expect(() => validateState({...validState, currentDay: 2})).toThrow(/próximo dia/);
});

test('arquivo inválido produz erro contextual', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'eliminandomarcas-engine-'));
  const filePath = path.join(directory, 'state.json');
  try {
    await fs.writeFile(filePath, '{não é json');
    await expect(readSeasonState(filePath)).rejects.toThrow(`Estado inválido em ${filePath}`);
  } finally {
    await fs.rm(directory, {recursive: true, force: true});
  }
});
