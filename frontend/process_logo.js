const fs = require('fs');
const { execSync } = require('child_process');

try {
  const sharp = require('sharp');
  const svgMask = Buffer.from('<svg width="512" height="512"><rect x="0" y="0" width="512" height="512" rx="140" ry="140" fill="#fff"/></svg>');
  
  sharp('c:/Users/shaks/OneDrive/Desktop/PYQ/frontend/public/airgate_logo.jpg')
    .resize(512, 512)
    .composite([{
      input: svgMask,
      blend: 'dest-in'
    }])
    .png()
    .toFile('c:/Users/shaks/OneDrive/Desktop/PYQ/frontend/public/airgate_logo.png')
    .then(() => console.log('CONVERT_SUCCESS'))
    .catch(err => console.error(err));
} catch(e) {
  console.error(e);
}
