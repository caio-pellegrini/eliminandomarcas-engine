const fs = require('node:fs/promises');
const path = require('node:path');
const {spawn} = require('node:child_process');

const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac']);
const SYNTHETIC_CHORDS = [
  '0.045*(sin(2*PI*220*t)+sin(2*PI*277.18*t)+sin(2*PI*329.63*t))',
  '0.045*(sin(2*PI*196*t)+sin(2*PI*246.94*t)+sin(2*PI*293.66*t))',
  '0.045*(sin(2*PI*261.63*t)+sin(2*PI*329.63*t)+sin(2*PI*392*t))',
];

async function findAudioTracks(audioDir) {
  try {
    return (await fs.readdir(audioDir, {withFileTypes: true}))
      .filter((entry) => entry.isFile() && AUDIO_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
      .map((entry) => path.join(audioDir, entry.name))
      .sort();
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

function runFfmpeg(ffmpegPath, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, {stdio: ['ignore', 'ignore', 'pipe']});
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.once('error', (error) => reject(new Error(`Não foi possível iniciar FFmpeg: ${error.message}`, {cause: error})));
    child.once('close', (code) => code === 0 ? resolve() : reject(new Error(`FFmpeg encerrou com código ${code}: ${stderr.slice(-2000)}`)));
  });
}

async function addBackgroundMusic({visualPath, outputPath, audioDir, day, durationSeconds, ffmpegPath = 'ffmpeg'}) {
  const tracks = await findAudioTracks(audioDir);
  const selectedTrack = tracks.length ? tracks[(day - 1) % tracks.length] : null;
  const fadeOutStart = Math.max(0, durationSeconds - 0.7);
  const commonOutput = [
    '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
    '-af', `volume=0.22,afade=t=in:st=0:d=0.5,afade=t=out:st=${fadeOutStart}:d=0.7`,
    '-t', String(durationSeconds), '-movflags', '+faststart', '-y', outputPath,
  ];
  const args = selectedTrack
    ? ['-i', visualPath, '-stream_loop', '-1', '-i', selectedTrack, ...commonOutput]
    : ['-i', visualPath, '-f', 'lavfi', '-i', `aevalsrc=${SYNTHETIC_CHORDS[(day - 1) % SYNTHETIC_CHORDS.length]}:s=44100:d=${durationSeconds}`, ...commonOutput];
  await runFfmpeg(ffmpegPath, args);
  return {outputPath, audioSource: selectedTrack || `synthetic-${((day - 1) % SYNTHETIC_CHORDS.length) + 1}`};
}

module.exports = {addBackgroundMusic, findAudioTracks};
