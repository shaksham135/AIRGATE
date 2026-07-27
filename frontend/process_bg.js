import fs from 'fs';
import { createCanvas, loadImage } from 'canvas';

// Pure JS canvas background removal
async function processImage() {
  try {
    const image = await loadImage('c:/Users/shaks/OneDrive/Desktop/PYQ/frontend/public/airgate_logo.jpg');
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');

    ctx.drawImage(image, 0, 0);
    const imgData = ctx.getImageData(0, 0, image.width, image.height);
    const data = imgData.data;

    // Convert dark pixels to 100% transparent alpha 0
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (r < 35 && g < 35 && b < 45) {
        data[i + 3] = 0; // transparent
      }
    }

    ctx.putImageData(imgData, 0, 0);
    const out = fs.createWriteStream('c:/Users/shaks/OneDrive/Desktop/PYQ/frontend/public/airgate_transparent_logo.png');
    const stream = canvas.createPNGStream();
    stream.pipe(out);
    out.on('finish', () => console.log('BG_REMOVAL_PNG_SUCCESS'));
  } catch (e) {
    console.error('Canvas processing failed', e);
  }
}

processImage();
