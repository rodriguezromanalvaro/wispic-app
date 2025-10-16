import path from 'path';
import fs from 'fs';
import Jimp from 'jimp';

async function main() {
  try {
  // Use CWD to be robust under ts-node ESM
  const root = path.resolve(process.cwd());
    const input = path.join(root, 'assets', 'adaptive-icon-foreground.png');
    const backup = path.join(root, 'assets', 'adaptive-icon-foreground.original.png');

    if (!fs.existsSync(input)) {
      console.error('Input image not found:', input);
      process.exit(1);
    }

    // Default to a subtle shrink: 94% of the original size
    let scale = 0.94;
    const arg = process.argv[2];
    if (arg) {
      const v = parseFloat(arg.replace('%',''));
      if (!isNaN(v)) {
        scale = v > 1 ? v / 100 : v;
      }
    }
    if (scale <= 0.5 || scale > 1) {
      console.warn('Scale out of range, using 0.94');
      scale = 0.94;
    }

    const img = await Jimp.read(input);
    const W = img.bitmap.width;
    const H = img.bitmap.height;
    const targetW = Math.round(W * scale);
    const targetH = Math.round(H * scale);

    const resized = img.clone().resize(targetW, targetH, Jimp.RESIZE_BICUBIC);
    const canvas = new Jimp(W, H, 0x00000000);
    const x = Math.round((W - targetW) / 2);
    const y = Math.round((H - targetH) / 2);
    canvas.composite(resized, x, y);

    // Backup once
    if (!fs.existsSync(backup)) {
      fs.copyFileSync(input, backup);
      console.log('Backup created at', backup);
    }

    await canvas.writeAsync(input);
    console.log(`Foreground icon shrunk to ${(scale*100).toFixed(1)}% and centered.`);
  } catch (e) {
    console.error('Error shrinking icon:', (e as any)?.message || e);
    process.exit(1);
  }
}

main();
