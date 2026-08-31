import sharp from 'sharp';
import fs from 'fs';

async function generateIcons() {
  const srcBuffer = fs.readFileSync('public/icon-512.png');
  const metadata = await sharp(srcBuffer).metadata();
  const size = metadata.width || 512;
  const radius = Math.round(size * (224 / 1024));

  const maskSvg = Buffer.from(`
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect x="0" y="0" width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="#ffffff" />
    </svg>
  `);

  const masked = await sharp(srcBuffer)
    .ensureAlpha()
    .composite([{
      input: maskSvg,
      blend: 'dest-in'
    }])
    .png()
    .toBuffer();

  // Save 512x512
  await sharp(masked)
    .resize(512, 512)
    .png()
    .toFile('public/icon-512.png');

  // Save 192x192
  await sharp(masked)
    .resize(192, 192)
    .png()
    .toFile('public/icon-192.png');

  // Save apple touch icon 180x180
  await sharp(masked)
    .resize(180, 180)
    .png()
    .toFile('public/apple-touch-icon.png');

  // Save 32x32 and 16x16
  await sharp(masked)
    .resize(32, 32)
    .png()
    .toFile('public/favicon-32x32.png');

  await sharp(masked)
    .resize(16, 16)
    .png()
    .toFile('public/favicon-16x16.png');

  const pngToIco = (await import('png-to-ico')).default;
  const icoBuf = await pngToIco(['public/favicon-16x16.png', 'public/favicon-32x32.png']);
  fs.writeFileSync('public/favicon.ico', icoBuf);

  console.log('Icons generated successfully with favicon.ico!');
}

generateIcons().catch(console.error);
