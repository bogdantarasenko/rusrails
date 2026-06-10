#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const PROJECT_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const META_JSON_PATH = join(PROJECT_ROOT, 'content', 'docs', 'meta.json');
const DOCUMENTS_YAML_URL =
  process.env.RUSRAILS_DOCUMENTS_YAML_URL ||
  'https://raw.githubusercontent.com/rails/rails/main/guides/source/documents.yaml';

const CATEGORY_RU_TO_EN = {
  'С чего начать?': 'Start Here',
  Модели: 'Models',
  Вью: 'Views',
  Контроллеры: 'Controllers',
  'Другие компоненты': 'Other Components',
  'Копаем глубже': 'Digging Deeper',
  'Запуск в продакшен': 'Going to Production',
  'Продвинутый Active Record': 'Advanced Active Record',
  'Расширяем Rails': 'Extending Rails',
  'Вносим вклад в Ruby on Rails': 'Contributing',
  'Политика поддержки Ruby on Rails': 'Policies',
  'Заметки о релизах': 'Release Notes',
};

const CATEGORY_EN_TO_RU = Object.fromEntries(
  Object.entries(CATEGORY_RU_TO_EN).map(([ru, en]) => [en, ru]),
);

async function fetchDocumentsYaml() {
  const res = await fetch(DOCUMENTS_YAML_URL);
  if (!res.ok) {
    throw new Error(
      `Не удалось скачать documents.yaml: HTTP ${res.status} ${res.statusText}`,
    );
  }
  return await res.text();
}

function parseOfficial(yamlText) {
  const data = yaml.load(yamlText);
  if (!Array.isArray(data)) {
    throw new Error('documents.yaml: ожидался массив категорий');
  }
  const categories = [];
  const slugs = [];
  for (const cat of data) {
    if (!cat || typeof cat.name !== 'string') {
      throw new Error('documents.yaml: категория без поля name');
    }
    categories.push(cat.name);
    for (const doc of cat.documents || []) {
      if (!doc || typeof doc.url !== 'string') continue;
      const slug = doc.url.replace(/\.html$/, '');
      slugs.push(slug);
    }
  }
  return { categories, slugs };
}

function parseLocal(metaPath) {
  const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
  if (!Array.isArray(meta.pages)) {
    throw new Error('meta.json: ожидалось поле pages с массивом');
  }
  const separatorRegex = /^---(?:\[[^\]]+\])?(.+)---$/;
  const categories = [];
  const slugs = [];
  for (const entry of meta.pages) {
    if (typeof entry !== 'string') continue;
    const sep = entry.match(separatorRegex);
    if (sep) {
      categories.push(sep[1].trim());
    } else if (entry !== '---') {
      slugs.push(entry);
    }
  }
  return { categories, slugs };
}

function setDiff(a, b) {
  const bSet = new Set(b);
  return a.filter((x) => !bSet.has(x));
}

function formatSection(title, items, marker) {
  const lines = [title];
  for (const item of items) lines.push(`  ${marker} ${item}`);
  return lines.join('\n');
}

async function main() {
  const yamlText = await fetchDocumentsYaml();
  const official = parseOfficial(yamlText);
  const local = parseLocal(META_JSON_PATH);

  const missingSlugs = setDiff(official.slugs, local.slugs);
  const extraSlugs = setDiff(local.slugs, official.slugs);

  const unknownOfficialCategories = official.categories.filter(
    (en) => !(en in CATEGORY_EN_TO_RU),
  );
  const unknownLocalCategories = local.categories.filter(
    (ru) => !(ru in CATEGORY_RU_TO_EN),
  );

  const sections = [];
  if (missingSlugs.length) {
    sections.push(
      formatSection(
        'Slug\'ы есть в официальном documents.yaml, но отсутствуют в meta.json (нужен перевод):',
        missingSlugs,
        '-',
      ),
    );
  }
  if (extraSlugs.length) {
    sections.push(
      formatSection(
        'Slug\'ы есть локально, но отсутствуют в официальном documents.yaml (исторические релиз-ноты или ушедшие гайды):',
        extraSlugs,
        '+',
      ),
    );
  }
  if (unknownOfficialCategories.length) {
    sections.push(
      formatSection(
        'Категории в официальном documents.yaml без перевода в карте CATEGORY_RU_TO_EN скрипта:',
        unknownOfficialCategories,
        '-',
      ),
    );
  }
  if (unknownLocalCategories.length) {
    sections.push(
      formatSection(
        'Сепараторы --- в meta.json без английского соответствия в карте CATEGORY_RU_TO_EN скрипта:',
        unknownLocalCategories,
        '+',
      ),
    );
  }

  if (sections.length === 0) {
    console.log(
      'Структура совпадает: все slug\'ы и категории учтены в meta.json.',
    );
    return;
  }

  console.error('Расхождения структуры meta.json и официального documents.yaml:');
  console.error('');
  console.error(sections.join('\n\n'));
  process.exitCode = 1;
}

main().catch((err) => {
  console.error('Ошибка при проверке структуры:', err.message);
  process.exit(2);
});
