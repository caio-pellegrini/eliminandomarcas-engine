const fs = require('node:fs/promises');
const path = require('node:path');
const {spawn} = require('node:child_process');

const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac']);

async function findAudioTracks(audioDir, excludedPaths = []) {
  try {
    const excluded = new Set(excludedPaths.filter(Boolean).map((filePath) => path.resolve(filePath)));
    return (await fs.readdir(audioDir, {withFileTypes: true}))
      .filter((entry) => entry.isFile() && AUDIO_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
      .map((entry) => path.join(audioDir, entry.name))
      .filter((filePath) => !excluded.has(path.resolve(filePath)))
      .sort();
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function isFile(filePath) {
  if (!filePath) return false;
  try {
    return (await fs.stat(filePath)).isFile();
  } catch (error) {
    if (error.code === 'ENOENT') return false;
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

async function addBackgroundMusic({visualPath, outputPath, audioDir, day, durationSeconds, rouletteDurationSeconds, wheelSoundPath, ffmpegPath = 'ffmpeg'}) {
  const tracks = await findAudioTracks(audioDir, [wheelSoundPath]);
  const selectedTrack = tracks.length ? tracks[(day - 1) % tracks.length] : null;
  const hasWheelSound = await isFile(wheelSoundPath);
  const fadeOutStart = Math.max(0, durationSeconds - 0.7);
  const inputs = ['-i', visualPath];
  const filters = [];
  let musicInputIndex;
  let wheelInputIndex;

  if (selectedTrack) {
    musicInputIndex = inputs.filter((argument) => argument === '-i').length;
    inputs.push('-stream_loop', '-1', '-i', selectedTrack);
    filters.push(`[${musicInputIndex}:a]volume=0.22,afade=t=in:st=0:d=0.5,afade=t=out:st=${fadeOutStart}:d=0.7[music]`);
  }
  if (hasWheelSound) {
    wheelInputIndex = inputs.filter((argument) => argument === '-i').length;
    inputs.push('-stream_loop', '-1', '-i', wheelSoundPath);
    filters.push(
      `[${wheelInputIndex}:a]atrim=duration=${rouletteDurationSeconds},asetpts=PTS-STARTPTS,` +
      `volume=0.7,afade=t=out:st=${Math.max(0, rouletteDurationSeconds - 0.7)}:d=0.7,` +
      `apad=whole_dur=${durationSeconds}[wheel]`,
    );
  }

  let audioOutput;
  if (selectedTrack && hasWheelSound) {
    filters.push('[music][wheel]amix=inputs=2:duration=longest:normalize=0[mixed]');
    audioOutput = ['-filter_complex', filters.join(';'), '-map', '[mixed]'];
  } else if (selectedTrack) {
    audioOutput = ['-filter_complex', filters.join(';'), '-map', '[music]'];
  } else if (hasWheelSound) {
    audioOutput = ['-filter_complex', filters.join(';'), '-map', '[wheel]'];
  } else {
    audioOutput = ['-an'];
  }
  const args = [
    ...inputs, '-map', '0:v:0', ...audioOutput, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
    '-t', String(durationSeconds), '-movflags', '+faststart', '-y', outputPath,
  ];
  await runFfmpeg(ffmpegPath, args);
  return {
    outputPath,
    audioSource: selectedTrack,
    wheelAudioSource: hasWheelSound ? wheelSoundPath : null,
  };
}

module.exports = {addBackgroundMusic, findAudioTracks, isFile};
