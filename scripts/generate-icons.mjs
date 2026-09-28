/**
 * Generate PWA / favicon assets from the brand source image.
 *
 * Source:  assets/brand/icon-source.jpg
 * Output:  public/icons/*  +  public/favicon.ico
 *
 * Usage:   pnpm icons
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import pngToIco from "png-to-ico";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const sourcePath = path.join(root, "assets/brand/icon-source.jpg");
const outDir = path.join(root, "public/icons");
const faviconPath = path.join(root, "public/favicon.ico");

/** Soft sky blue sampled from the icon background */
const BG = "#A8D4F5";

const PNG_TARGETS = [
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
  { file: "apple-touch-icon.png", size: 180 },
  /** Maskable: content inset ~10% so Android safe zone (~80%) still shows the art */
  { file: "maskable-512.png", size: 512, maskable: true },
];

const FAVICON_SIZES = [16, 32, 48];

async function resizeSquare(size) {
  return sharp(sourcePath)
    .resize(size, size, {
      fit: "cover",
      position: "centre",
    })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function resizeMaskable(size) {
  const inset = Math.round(size * 0.1);
  const inner = size - inset * 2;
  const foreground = await sharp(sourcePath)
    .resize(inner, inner, { fit: "cover", position: "centre" })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: BG,
    },
  })
    .composite([{ input: foreground, left: inset, top: inset }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function main() {
  await mkdir(outDir, { recursive: true });

  for (const target of PNG_TARGETS) {
    const buf = target.maskable
      ? await resizeMaskable(target.size)
      : await resizeSquare(target.size);
    const dest = path.join(outDir, target.file);
    await writeFile(dest, buf);
    console.log(`✓ ${path.relative(root, dest)} (${target.size}x${target.size})`);
  }

  const faviconPngs = [];
  for (const size of FAVICON_SIZES) {
    faviconPngs.push(await resizeSquare(size));
  }
  const ico = await pngToIco(faviconPngs);
  await writeFile(faviconPath, ico);
  console.log(
    `✓ ${path.relative(root, faviconPath)} (${FAVICON_SIZES.join("/")})`,
  );

  // Keep a lossless master PNG next to the jpg source for future edits
  const masterPng = path.join(root, "assets/brand/icon-source.png");
  await sharp(sourcePath).png({ compressionLevel: 9 }).toFile(masterPng);
  console.log(`✓ ${path.relative(root, masterPng)} (master png)`);

  console.log("\nDone. Theme hint BG =", BG);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
