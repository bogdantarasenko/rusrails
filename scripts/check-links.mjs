#!/usr/bin/env node
// Проверка внутренних ссылок в content/docs/*.mdx.
//
// Что считается внутренней ссылкой:
//   - /docs/<slug>            — абсолютная ссылка на гайд
//   - /docs/<slug>#anchor     — ссылка с якорем на гайд
//   - #anchor                 — ссылка на якорь в текущем файле
//   - relative.md / .mdx      — относительная ссылка на соседний файл (.md или .mdx)
//
// Для каждой такой ссылки скрипт проверяет:
//   - существование целевого MDX-файла;
//   - наличие якоря (заголовка) в файле назначения — для ссылок с `#anchor`.
//
// Якоря вычисляются так же, как это делает fumadocs (`github-slugger` поверх
// flattenNode-текста заголовка) — см. node_modules/fumadocs-core/dist/mdx-plugins/remark-heading.js.
// Дополнительно поддерживается синтаксис кастомного id `## Title [#custom-id]`.
//
// Внешние ссылки (http/https/mailto/tel/...) и не-docs root-relative пути
// (например, /images/..., /api/...) игнорируются — цель скрипта именно
// внутренние навигационные ссылки между гайдами.

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Slugger from 'github-slugger';

const PROJECT_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DOCS_DIR = join(PROJECT_ROOT, 'content', 'docs');

function listMdx(dir) {
  const out = [];
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, name.name);
    if (name.isDirectory()) {
      out.push(...listMdx(full));
    } else if (name.isFile() && name.name.endsWith('.mdx')) {
      out.push(full);
    }
  }
  return out.sort();
}

function stripFrontmatter(src) {
  if (!src.startsWith('---\n')) return { body: src, offset: 0 };
  const end = src.indexOf('\n---\n', 4);
  if (end < 0) return { body: src, offset: 0 };
  const offset = end + 5;
  return { body: src.slice(offset), offset };
}

// Заменяет содержимое всех кодовых блоков (``` fenced и `inline`) пробелами,
// сохраняя длину строки. Так регулярки по ссылкам не цепляют примеры кода.
function maskCode(src) {
  const lines = src.split('\n');
  let inFence = false;
  const out = [];
  for (const line of lines) {
    const fence = line.match(/^(\s*)(```+|~~~+)/);
    if (fence) {
      inFence = !inFence;
      out.push(' '.repeat(line.length));
      continue;
    }
    if (inFence) {
      out.push(' '.repeat(line.length));
      continue;
    }
    // Inline code: ` ... `, ``...``, ```...```
    out.push(line.replace(/(`+)([\s\S]*?)\1/g, (m) => ' '.repeat(m.length)));
  }
  return out.join('\n');
}

// Извлекает «плоский» текст из строки заголовка markdown:
// убирает лишний markdown-синтаксис (звёздочки, инлайн-код, ссылки),
// чтобы получить тот же текст, что увидит github-slugger в fumadocs.
function flattenHeadingText(raw) {
  let s = raw;
  // [text](url) → text
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  // [text][ref] → text
  s = s.replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1');
  // `code` → code
  s = s.replace(/`+([^`]+)`+/g, '$1');
  // **bold** / *italic* / __ / _
  s = s.replace(/\*\*([^*]+)\*\*/g, '$1');
  s = s.replace(/\*([^*]+)\*/g, '$1');
  s = s.replace(/__([^_]+)__/g, '$1');
  s = s.replace(/_([^_]+)_/g, '$1');
  return s.trim();
}

// Возвращает Set якорей (heading id), сгенерированных как в fumadocs.
function collectAnchors(maskedBody) {
  const slugger = new Slugger();
  const ids = new Set();
  const lines = maskedBody.split('\n');
  for (const line of lines) {
    const m = line.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (!m) continue;
    let text = m[2];
    let id;
    // fumadocs `[#custom-id]` синтаксис в конце заголовка
    const custom = text.match(/\s*\[#([^\]]+)]\s*$/);
    if (custom) {
      id = custom[1];
      text = text.slice(0, custom.index).trim();
    } else {
      id = slugger.slug(flattenHeadingText(text));
    }
    ids.add(id);
  }
  return ids;
}

// Достаёт inline-ссылки и reference-определения из текста с замаскированным кодом.
function extractLinks(maskedBody) {
  const links = [];
  // inline: [text](url) — url до закрывающей скобки (без вложенных скобок).
  const inline = /\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let m;
  while ((m = inline.exec(maskedBody)) !== null) {
    links.push({ url: m[2], index: m.index, kind: 'inline' });
  }
  // reference: ^[label]: url (в начале строки, label без `:` в значении)
  const ref = /^\[([^\]]+)\]:\s*(\S+)(?:\s+"[^"]*")?\s*$/gm;
  while ((m = ref.exec(maskedBody)) !== null) {
    links.push({ url: m[2], index: m.index, kind: 'reference' });
  }
  return links;
}

function lineNumberAt(src, index) {
  let n = 1;
  for (let i = 0; i < index && i < src.length; i++) {
    if (src.charCodeAt(i) === 10) n++;
  }
  return n;
}

function isExternal(url) {
  return /^(https?:|mailto:|tel:|ftp:|ws:|wss:|data:|javascript:|#!)/i.test(url);
}

function splitAnchor(url) {
  const i = url.indexOf('#');
  if (i < 0) return { path: url, anchor: '' };
  return { path: url.slice(0, i), anchor: url.slice(i + 1) };
}

function slugFromDocsPath(p) {
  // /docs или /docs/ → корень (нет такой страницы — у нас [[...slug]] монтирует
  // только конкретные slug'и); считаем недействительным.
  const stripped = p.replace(/^\/docs\/?/, '');
  if (!stripped) return null;
  return stripped.replace(/\/+$/, '');
}

function main() {
  const files = listMdx(DOCS_DIR);
  // Карта slug → absolute path. Слаг — имя файла без .mdx.
  const slugToFile = new Map();
  for (const f of files) {
    const slug = relative(DOCS_DIR, f).replace(/\.mdx$/, '');
    slugToFile.set(slug, f);
  }

  // Лениво загружаем якоря целевых файлов: чтение происходит один раз на файл.
  const anchorCache = new Map();
  function anchorsFor(file) {
    if (anchorCache.has(file)) return anchorCache.get(file);
    const src = readFileSync(file, 'utf8');
    const { body } = stripFrontmatter(src);
    const masked = maskCode(body);
    const anchors = collectAnchors(masked);
    anchorCache.set(file, anchors);
    return anchors;
  }

  const broken = [];

  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    const { body, offset } = stripFrontmatter(src);
    const masked = maskCode(body);
    const links = extractLinks(masked);
    for (const link of links) {
      const { url, index } = link;
      if (isExternal(url)) continue;
      if (!url) continue;

      const { path: p, anchor } = splitAnchor(url);

      // Якорь в текущем файле.
      if (p === '' && anchor) {
        const anchors = anchorsFor(file);
        if (!anchors.has(anchor)) {
          broken.push({
            file,
            line: lineNumberAt(src, offset + index),
            url,
            reason: `якорь #${anchor} не найден в текущем файле`,
          });
        }
        continue;
      }

      // Абсолютный путь /docs/<slug>
      if (p.startsWith('/docs/') || p === '/docs') {
        const slug = slugFromDocsPath(p);
        if (!slug) {
          broken.push({
            file,
            line: lineNumberAt(src, offset + index),
            url,
            reason: 'пустой /docs путь — нет такой страницы',
          });
          continue;
        }
        const target = slugToFile.get(slug);
        if (!target) {
          broken.push({
            file,
            line: lineNumberAt(src, offset + index),
            url,
            reason: `файл content/docs/${slug}.mdx не существует`,
          });
          continue;
        }
        if (anchor) {
          const anchors = anchorsFor(target);
          if (!anchors.has(anchor)) {
            broken.push({
              file,
              line: lineNumberAt(src, offset + index),
              url,
              reason: `якорь #${anchor} не найден в content/docs/${slug}.mdx`,
            });
          }
        }
        continue;
      }

      // Относительные .md / .mdx
      if (/\.mdx?(?:$|[#?])/.test(p)) {
        const baseDir = dirname(file);
        const targetPath = resolve(baseDir, p);
        // Поддерживаем оба расширения: если в ссылке .md, ищем сначала .md, потом .mdx.
        let resolved = null;
        if (existsSync(targetPath)) {
          resolved = targetPath;
        } else if (targetPath.endsWith('.md')) {
          const alt = `${targetPath}x`;
          if (existsSync(alt)) resolved = alt;
        }
        if (!resolved) {
          broken.push({
            file,
            line: lineNumberAt(src, offset + index),
            url,
            reason: `относительный файл ${relative(PROJECT_ROOT, targetPath)} не найден`,
          });
          continue;
        }
        if (anchor) {
          const anchors = anchorsFor(resolved);
          if (!anchors.has(anchor)) {
            broken.push({
              file,
              line: lineNumberAt(src, offset + index),
              url,
              reason: `якорь #${anchor} не найден в ${relative(PROJECT_ROOT, resolved)}`,
            });
          }
        }
        continue;
      }

      // Иной root-relative или относительный путь — игнорируем
      // (асссеты /images/..., /favicon.ico, и т.п.).
    }
  }

  if (broken.length === 0) {
    console.log(
      `Проверено ${files.length} файлов, ${anchorCache.size} с подгруженными якорями. Битых внутренних ссылок не найдено.`,
    );
    return;
  }

  // Группировка по файлу для удобочитаемого вывода.
  const byFile = new Map();
  for (const b of broken) {
    if (!byFile.has(b.file)) byFile.set(b.file, []);
    byFile.get(b.file).push(b);
  }
  console.error(`Найдено битых внутренних ссылок: ${broken.length}`);
  console.error('');
  for (const [file, items] of byFile) {
    console.error(relative(PROJECT_ROOT, file));
    for (const it of items) {
      console.error(`  :${it.line}  ${it.url}`);
      console.error(`           → ${it.reason}`);
    }
    console.error('');
  }
  process.exitCode = 1;
}

main();
