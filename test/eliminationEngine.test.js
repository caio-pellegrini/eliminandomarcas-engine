const {advanceState, getEliminationForDate, localDateKey} = require('../src/core/eliminationEngine');

function makeState(overrides = {}) {
  return {
    seasonId: 'test-season',
    seasonNumber: 1,
    name: 'Temporada de Teste',
    niche: 'Teste',
    totalDays: 2,
    brands: ['A', 'B', 'Vencedora'],
    eliminationOrder: ['A', 'B'],
    currentDay: 1,
    history: [],
    lastRunAt: null,
    ...overrides,
  };
}

test('retorna e avança a eliminação do dia atual', () => {
  const state = makeState();
  const elimination = getEliminationForDate(state, '2026-07-27');
  expect(elimination).toMatchObject({day: 1, brand: 'A', alreadyProcessed: false});
  const next = advanceState(state, elimination, {
    runDate: '2026-07-27', videoPath: 'output/dia-01.mp4', publishStatus: 'manual_required', caption: 'Legenda auditável', processedAt: '2026-07-27T15:00:00.000Z',
  });
  expect(next.currentDay).toBe(2);
  expect(next.history).toHaveLength(1);
  expect(next.history[0].caption).toBe('Legenda auditável');
  expect(state.currentDay).toBe(1);
});

test('é idempotente para uma data já processada', () => {
  const entry = {day: 1, brand: 'A', runDate: '2026-07-27', videoPath: 'x.mp4', publishStatus: 'manual_required', processedAt: '2026-07-27T15:00:00.000Z'};
  const state = makeState({currentDay: 2, history: [entry]});
  expect(getEliminationForDate(state, '2026-07-27')).toMatchObject({alreadyProcessed: true, day: 1, brand: 'A'});
});

test('não avança além do último dia', () => {
  const history = [
    {day: 1, brand: 'A', runDate: '2026-07-27'},
    {day: 2, brand: 'B', runDate: '2026-07-28'},
  ];
  const state = makeState({currentDay: 3, history});
  expect(getEliminationForDate(state, '2026-07-29')).toEqual({seasonComplete: true});
});

test('processa o Dia 60 e encerra a temporada no próximo disparo', () => {
  const eliminationOrder = Array.from({length: 60}, (_, index) => `Marca ${index + 1}`);
  const state = makeState({
    totalDays: 60,
    brands: [...eliminationOrder, 'Vencedora'],
    eliminationOrder,
    currentDay: 60,
    history: Array.from({length: 59}, (_, index) => ({day: index + 1, runDate: `data-${index + 1}`})),
  });
  const elimination = getEliminationForDate(state, '2026-09-24');
  expect(elimination).toMatchObject({day: 60, brand: 'Marca 60'});
  const finished = advanceState(state, elimination, {
    runDate: '2026-09-24', videoPath: 'dia-60.mp4', publishStatus: 'manual_required', processedAt: '2026-09-24T15:00:00.000Z',
  });
  expect(finished.currentDay).toBe(61);
  expect(getEliminationForDate(finished, '2026-09-25')).toEqual({seasonComplete: true});
});

test('calcula a data no fuso da execução', () => {
  expect(localDateKey(new Date('2026-07-28T01:30:00.000Z'), 'America/Sao_Paulo')).toBe('2026-07-27');
});
