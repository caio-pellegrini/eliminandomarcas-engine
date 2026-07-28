const RESULT_DURATION_SECONDS = 3;

function getVideoTiming(durationSeconds, fps = 30) {
  const rouletteEndSeconds = durationSeconds - RESULT_DURATION_SECONDS;
  return {
    rouletteEndSeconds,
    rouletteEndFrame: Math.round(rouletteEndSeconds * fps),
    rouletteStopFrame: Math.round((rouletteEndSeconds - 0.2) * fps),
    finalCardStartFrame: Math.round((rouletteEndSeconds - 0.15) * fps),
    resultDurationSeconds: RESULT_DURATION_SECONDS,
  };
}

module.exports = {getVideoTiming, RESULT_DURATION_SECONDS};
