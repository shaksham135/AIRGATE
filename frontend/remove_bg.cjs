const fs = require('fs');
const sharp = require('sharp');

sharp('c:/Users/shaks/OneDrive/Desktop/PYQ/frontend/public/airgate_logo.jpg')
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })
  .then(({ data, info }) => {
    // Replace dark pixels (#000 to #202030) with transparent alpha 0
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (r < 30 && g < 30 && b < 40) {
        data[i + 3] = 0; // transparent
      }
    }
    return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
      .png()
      .toFile('c:/Users/shaks/OneDrive/Desktop/PYQ/frontend/public/airgate_transparent_logo.png');
  })
  .then(() => console.log('BG_REMOVE_SUCCESS'))
  .catch(err => console.error(err));
