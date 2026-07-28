function localDateKey(date = new Date(), timezone = 'America/Sao_Paulo') {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function getEliminationForDate(state, runDate) {
  const previous = state.history.find((entry) => entry.runDate === runDate);
  if (previous) {
    return {alreadyProcessed: true, day: previous.day, brand: previous.brand, entry: previous};
  }
  if (state.currentDay > state.totalDays) {
    return {seasonComplete: true};
  }
  return {
    alreadyProcessed: false,
    seasonComplete: false,
    day: state.currentDay,
    brand: state.eliminationOrder[state.currentDay - 1],
  };
}

function advanceState(state, elimination, details) {
  if (elimination.alreadyProcessed || elimination.seasonComplete) return state;
  if (elimination.day !== state.currentDay) {
    throw new Error(`Avanço inválido: esperado dia ${state.currentDay}, recebido ${elimination.day}.`);
  }
  const entry = {
    day: elimination.day,
    brand: elimination.brand,
    runDate: details.runDate,
    videoPath: details.videoPath,
    publishStatus: details.publishStatus,
    caption: details.caption,
    processedAt: details.processedAt,
  };
  return {
    ...state,
    currentDay: state.currentDay + 1,
    history: [...state.history, entry],
    lastRunAt: details.processedAt,
  };
}

module.exports = {advanceState, getEliminationForDate, localDateKey};
