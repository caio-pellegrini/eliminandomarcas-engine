const instagram = require('./instagram');
const tiktok = require('./tiktok');

async function publishToEnabledPlatforms(videoPath, metadata, dependencies) {
  return Promise.all([
    instagram.publish(videoPath, metadata, dependencies),
    tiktok.publish(videoPath, metadata, dependencies),
  ]);
}

module.exports = {publishToEnabledPlatforms};
