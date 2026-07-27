const fs = require('node:fs/promises');
const path = require('node:path');

function validateState(state) {
  const requiredStrings = ['seasonId', 'name', 'niche'];
  for (const field of requiredStrings) {
    if (typeof state[field] !== 'string' || !state[field].trim()) {
      throw new Error(`Estado inválido: ${field} é obrigatório.`);
    }
  }
  if (!Number.isInteger(state.seasonNumber) || state.seasonNumber < 1) {
    throw new Error('Estado inválido: seasonNumber deve ser inteiro positivo.');
  }
  if (!Array.isArray(state.brands) || state.brands.length === 0) {
    throw new Error('Estado inválido: brands deve ser uma lista não vazia.');
  }
  if (!Array.isArray(state.eliminationOrder) || state.eliminationOrder.length === 0) {
    throw new Error('Estado inválido: eliminationOrder deve ser uma lista não vazia.');
  }
  if (new Set(state.brands).size !== state.brands.length || new Set(state.eliminationOrder).size !== state.eliminationOrder.length) {
    throw new Error('Estado inválido: marcas duplicadas não são permitidas.');
  }
  const knownBrands = new Set(state.brands);
  if (state.eliminationOrder.some((brand) => !knownBrands.has(brand))) {
    throw new Error('Estado inválido: eliminationOrder contém marca ausente em brands.');
  }
  if (state.totalDays !== state.eliminationOrder.length) {
    throw new Error('Estado inválido: totalDays deve corresponder à ordem de eliminação.');
  }
  if (state.brands.length !== state.totalDays + 1) {
    throw new Error('Estado inválido: brands deve conter as eliminadas mais uma vencedora.');
  }
  if (!Number.isInteger(state.currentDay) || state.currentDay < 1 || state.currentDay > state.totalDays + 1) {
    throw new Error('Estado inválido: currentDay fora dos limites da temporada.');
  }
  if (!Array.isArray(state.history)) {
    throw new Error('Estado inválido: history deve ser uma lista.');
  }
  const days = new Set();
  const runDates = new Set();
  for (const entry of state.history) {
    if (!Number.isInteger(entry.day) || entry.day < 1 || entry.day > state.totalDays) {
      throw new Error('Estado inválido: histórico contém dia fora dos limites.');
    }
    if (days.has(entry.day) || runDates.has(entry.runDate)) {
      throw new Error('Estado inválido: histórico contém dia ou data duplicada.');
    }
    if (state.eliminationOrder[entry.day - 1] !== entry.brand) {
      throw new Error(`Estado inválido: marca incorreta no histórico do dia ${entry.day}.`);
    }
    if (typeof entry.runDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(entry.runDate)) {
      throw new Error(`Estado inválido: runDate incorreto no histórico do dia ${entry.day}.`);
    }
    if (typeof entry.videoPath !== 'string' || !entry.videoPath) {
      throw new Error(`Estado inválido: videoPath ausente no histórico do dia ${entry.day}.`);
    }
    if (typeof entry.processedAt !== 'string' || Number.isNaN(Date.parse(entry.processedAt))) {
      throw new Error(`Estado inválido: processedAt incorreto no histórico do dia ${entry.day}.`);
    }
    days.add(entry.day);
    runDates.add(entry.runDate);
  }
  if (state.currentDay !== state.history.length + 1) {
    throw new Error('Estado inválido: currentDay deve apontar para o próximo dia após o histórico.');
  }
  return state;
}

async function readSeasonState(filePath) {
  let contents;
  try {
    contents = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    throw new Error(`Não foi possível ler o estado em ${filePath}: ${error.message}`, {cause: error});
  }
  try {
    return validateState(JSON.parse(contents));
  } catch (error) {
    throw new Error(`Estado inválido em ${filePath}: ${error.message}`, {cause: error});
  }
}

async function writeSeasonState(filePath, state) {
  validateState(state);
  await fs.mkdir(path.dirname(filePath), {recursive: true});
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    await fs.writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, {encoding: 'utf8', mode: 0o600});
    await fs.rename(temporaryPath, filePath);
  } catch (error) {
    await fs.rm(temporaryPath, {force: true}).catch(() => {});
    throw new Error(`Não foi possível salvar o estado em ${filePath}: ${error.message}`, {cause: error});
  }
}

async function acquireStateLock(filePath) {
  const lockPath = `${filePath}.lock`;
  let handle;
  try {
    handle = await fs.open(lockPath, 'wx');
    await handle.writeFile(`${process.pid}\n`);
  } catch (error) {
    if (error.code === 'EEXIST') {
      throw new Error(`Já existe uma execução em andamento (lock: ${lockPath}).`);
    }
    throw error;
  }
  return async () => {
    await handle.close();
    await fs.rm(lockPath, {force: true});
  };
}

module.exports = {acquireStateLock, readSeasonState, validateState, writeSeasonState};
