#!/usr/bin/env node
/**
 * Gera todos os ícones do Kortex a partir de docs/brand/kortex-logo.jpg
 * (PWA, favicon, apple-touch, logo da interface e ícone do app de Windows).
 *
 *   node scripts/gen-icons.mjs
 *
 * Usa o Chrome/Edge instalado (o mesmo dos testes de navegador) para redimensionar.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { CHROME } from '../e2e/lib.mjs';

/* global Image, document -- executa dentro do Chrome (page.evaluate) */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'docs/brand/kortex-logo.jpg');
const ICONS = path.join(ROOT, 'apps/web/public/icons');

// [arquivo de saída, tamanho em px, recorte opcional {x,y,s} em px da imagem original]
// Em tamanhos pequenos a arte inteira vira mancha: o recorte aproxima só o cérebro.
const BRAIN = { x: 255, y: 260, s: 520 };
const OUTPUTS = [
  [path.join(ICONS, 'icon-512.png'), 512],
  [path.join(ICONS, 'icon-192.png'), 192],
  [path.join(ICONS, 'maskable-512.png'), 512], // o desenho útil fica no centro: o recorte do Android não o atinge
  [path.join(ICONS, 'apple-touch-icon.png'), 180],
  [path.join(ICONS, 'favicon-64.png'), 64, BRAIN],
  [path.join(ICONS, 'logo-128.png'), 128, BRAIN], // logo da interface (menu lateral, tela de PIN)
  [path.join(ROOT, 'apps/desktop/assets/icon.png'), 512],
];

const dataUrl = `data:image/jpeg;base64,${fs.readFileSync(SRC).toString('base64')}`;
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
try {
  const page = await browser.newPage();
  await page.setContent('<canvas id="c"></canvas>');
  for (const [file, size, crop] of OUTPUTS) {
    const b64 = await page.evaluate(
      async (url, n, cr) => {
        const img = new Image();
        img.src = url;
        await img.decode();
        const c = document.getElementById('c');
        c.width = c.height = n;
        const ctx = c.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        if (cr) ctx.drawImage(img, cr.x, cr.y, cr.s, cr.s, 0, 0, n, n);
        else ctx.drawImage(img, 0, 0, n, n);
        return c.toDataURL('image/png').split(',')[1];
      },
      dataUrl,
      size,
      crop ?? null,
    );
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.from(b64, 'base64'));
    console.log(`✔ ${path.relative(ROOT, file)} (${size}px)`);
  }
} finally {
  await browser.close();
}
