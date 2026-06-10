# rusrails

Русский перевод официального руководства Ruby on Rails. Сайт собран на
[Next.js](https://nextjs.org/) и [fumadocs](https://fumadocs.dev/).

## Разработка

```bash
pnpm install
pnpm dev
```

Сайт будет доступен на `http://localhost:3000`.

## Проверки документации

В репозитории есть два скрипта, которые помогают поддерживать перевод в
согласованном состоянии. Оба запускаются на каждом pull request через
workflow [`.github/workflows/check-docs.yml`](.github/workflows/check-docs.yml)
и падают при ненулевом коде выхода.

### Сверка структуры с официальным индексом

Скрипт сравнивает локальный `content/docs/meta.json` с актуальным
[`documents.yaml`](https://raw.githubusercontent.com/rails/rails/main/guides/source/documents.yaml)
из репозитория Rails и сообщает о расхождениях по slug'ам и категориям.

```bash
pnpm run check:parity
```

Переменная окружения `RUSRAILS_DOCUMENTS_YAML_URL` позволяет указать
альтернативный URL (например, для проверки на конкретной версии Rails).

### Проверка внутренних ссылок

Скрипт обходит все MDX-файлы в `content/docs/`, извлекает внутренние ссылки
(включая anchor'ы заголовков) и проверяет, что цели существуют. Внешние ссылки
(`http://`, `https://`, `mailto:`, …) пропускаются.

```bash
pnpm run check:links
```

### Запуск обеих проверок локально

```bash
pnpm run check:parity && pnpm run check:links
```

Оба скрипта возвращают код выхода `1` при обнаружении проблем — это тот же
сигнал, по которому падает CI.
