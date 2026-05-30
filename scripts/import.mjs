#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const SRC = process.env.RUSRAILS_SRC || '/tmp/rusrails-source';
const PROJECT_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT_DOCS = path.join(PROJECT_ROOT, 'content/docs');
const OUT_IMAGES = path.join(PROJECT_ROOT, 'public/images');

const indexYml = yaml.load(
  fs.readFileSync(path.join(SRC, 'source/index.yml'), 'utf8'),
);

const pages = indexYml.pages ?? [];
const special = indexYml.special ?? [];

const fileToSlug = new Map();
const fileToTitle = new Map();
for (const p of [...special, ...pages]) {
  fileToSlug.set(p.file, p.path);
  fileToTitle.set(p.file, p.title);
}

const slugSet = new Set(
  [...special, ...pages].map((p) => '/' + p.path),
);

const CALLOUT_MAP = {
  NOTE: 'info',
  INFO: 'info',
  TIP: 'info',
  WARNING: 'warn',
};

function escapeJsxBraces(s) {
  return s.replace(/\{/g, '\\{').replace(/\}/g, '\\}');
}

// Apply transform to text NOT inside ``` fences or inline backticks.
function transformOutsideCode(src, fn) {
  const lines = src.split('\n');
  let inFence = false;
  const out = [];
  for (const line of lines) {
    if (line.startsWith('```')) {
      inFence = !inFence;
      out.push(line);
      continue;
    }
    if (inFence) {
      out.push(line);
      continue;
    }
    // Split inline `code` segments out of transformation.
    const parts = line.split(/(`[^`]*`)/);
    out.push(
      parts
        .map((p) => (p.startsWith('`') ? p : fn(p)))
        .join(''),
    );
  }
  return out.join('\n');
}

function transform(md, currentFile) {
  // 0. Map Shiki-unsupported fence languages to closest equivalent.
  //    Fences may be indented (inside lists), so allow leading whitespace.
  md = md.replace(/^(\s*)```([a-z+_-]+)/gm, (m, ws, lang) => {
    const map = { irb: 'ruby', 'html+erb': 'erb' };
    return ws + '```' + (map[lang] ?? lang);
  });

  // 1. Setext H1 (text\n===) → ATX (# text) AND capture title
  let title = fileToTitle.get(currentFile) ?? null;
  let description = null;

  // Normalise CRLF
  md = md.replace(/\r\n/g, '\n');

  const lines = md.split('\n');
  const out = [];
  let firstParagraph = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const next = lines[i + 1] ?? '';

    // Setext H1
    if (next.match(/^=+\s*$/) && line.trim()) {
      if (!title) title = line.trim();
      out.push(`# ${line.trim()}`);
      i++;
      continue;
    }
    // Setext H2
    if (next.match(/^-{3,}\s*$/) && line.trim() && !line.startsWith('|')) {
      out.push(`## ${line.trim()}`);
      i++;
      continue;
    }
    out.push(line);
  }
  let body = out.join('\n');

  // 2. Strip explicit anchor prefix in headings: "### (anchor-id) Title" → "### Title"
  body = body.replace(/^(#{1,6}\s+)\(([^)]+)\)\s+/gm, '$1');

  // 3. Convert NOTE:/INFO:/TIP:/WARNING: blocks (paragraph-level) into <Callout>
  //    A callout block starts with "KEYWORD:" at the beginning of a line and
  //    continues until a blank line.
  body = body.replace(
    /^(NOTE|INFO|TIP|WARNING):[ \t]*([\s\S]*?)(?=\n\s*\n|$)/gm,
    (m, kw, content) => {
      const type = CALLOUT_MAP[kw] ?? 'info';
      const text = content.trim();
      return `<Callout type="${type}">\n${text}\n</Callout>`;
    },
  );

  // 3b. CommonMark autolinks <http://...> would be parsed as JSX by MDX.
  //     Convert them to [text](url) outside fenced code blocks.
  body = transformOutsideCode(body, (chunk) =>
    chunk
      .replace(
        /<((?:https?|mailto):[^\s<>]+)>/g,
        (_, url) => `[${url}](${url})`,
      )
      // 3c. Void HTML tags must be self-closed in MDX.
      .replace(/<(br|hr)>/gi, '<$1 />')
      // 3d. Escape { and } outside code blocks — MDX parses them as
      //     JSX expressions. Done *before* Callout substitution so our own
      //     <Callout> JSX (added below) is not double-escaped.
      .replace(/[{}]/g, (c) => '\\' + c),
  );

  // 4. Image paths: ![alt](foo/bar.png) → ![alt](/images/foo/bar.png)
  //    Skip absolute URLs and already-prefixed.
  body = body.replace(
    /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g,
    (m, alt, url) => {
      if (/^(https?:|data:|\/)/.test(url)) return m;
      return `![${alt}](/images/${url})`;
    },
  );

  // 5. Rewrite internal slug links: (/foo-bar) or (/foo_bar) → (/docs/foo-bar)
  //    The source sometimes uses underscores; normalise to dashes.
  const rewriteHref = (href) => {
    const [pathPart, hash] = href.split('#');
    const normalised = pathPart.replace(/_/g, '-');
    if (slugSet.has(normalised)) {
      return '/docs' + normalised + (hash ? '#' + hash : '');
    }
    return null;
  };
  body = body.replace(
    /\]\((\/[a-z0-9_-]+(?:#[\w-]+)?)\)/g,
    (m, href) => {
      const r = rewriteHref(href);
      return r ? `](${r})` : m;
    },
  );
  // Reference-style link defs: [foo]: /bar
  body = body.replace(
    /^\[([^\]]+)\]:\s+(\/[a-z0-9_-]+(?:#[\w-]+)?)\s*$/gm,
    (m, label, href) => {
      const r = rewriteHref(href);
      return r ? `[${label}]: ${r}` : m;
    },
  );

  // 6. Pick description as the first non-empty paragraph after the H1.
  const afterH1 = body.split('\n').slice(1);
  for (const l of afterH1) {
    const t = l.trim();
    if (!t) continue;
    if (t.startsWith('#') || t.startsWith('<') || t.startsWith('*') || t.startsWith('-') || t.startsWith('|')) break;
    description = t.replace(/[`*_]/g, '').slice(0, 200);
    break;
  }

  // 7. Drop the H1 from body — fumadocs renders title from frontmatter.
  body = body.replace(/^#\s+.+\n+/, '');

  // 8. Special landing pages: turn rusrails' "- [Title](url) := description"
  //    into "**[Title](url)**\ndescription" so the index renders like a
  //    proper guides directory rather than raw markdown.
  if (currentFile === 'index.md' || currentFile === 'menu.md') {
    body = body.replace(
      /^-\s+(\[[^\]]+\]\([^)]+\))\s+:=\s+(.+)$/gm,
      '**$1**\\\n$2\n',
    );
  }

  // 8. Build frontmatter
  const fm = ['---'];
  fm.push(`title: ${yamlString(title ?? currentFile)}`);
  if (description) fm.push(`description: ${yamlString(description)}`);
  fm.push('---');
  return fm.join('\n') + '\n\n' + body.trimEnd() + '\n';
}

function yamlString(s) {
  if (/[:#'"\n]/.test(s)) {
    return `"${s.replace(/"/g, '\\"')}"`;
  }
  return s;
}

function copyDir(from, to) {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(src, dst);
    else fs.copyFileSync(src, dst);
  }
}

// === main ===
fs.rmSync(OUT_DOCS, { recursive: true, force: true });
fs.mkdirSync(OUT_DOCS, { recursive: true });

let written = 0;
let skipped = 0;
for (const entry of [...special, ...pages]) {
  const srcPath = path.join(SRC, 'source', entry.file);
  if (!fs.existsSync(srcPath)) {
    console.warn(`! missing: ${entry.file}`);
    skipped++;
    continue;
  }
  const raw = fs.readFileSync(srcPath, 'utf8');
  const converted = transform(raw, entry.file);
  const outPath = path.join(OUT_DOCS, `${entry.path}.mdx`);
  fs.writeFileSync(outPath, converted);
  written++;
}

// meta.json with sidebar order
const meta = {
  title: 'Руководства',
  pages: pages.map((p) => p.path),
};
fs.writeFileSync(
  path.join(OUT_DOCS, 'meta.json'),
  JSON.stringify(meta, null, 2) + '\n',
);

// images
fs.rmSync(OUT_IMAGES, { recursive: true, force: true });
copyDir(path.join(SRC, 'app/assets/images'), OUT_IMAGES);

console.log(`✓ wrote ${written} pages, skipped ${skipped}`);
console.log(`✓ meta.json with ${meta.pages.length} entries`);
console.log(`✓ copied images → public/images`);
