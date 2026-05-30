import { source } from '@/lib/source';
import { getMDXComponents } from '@/mdx-components';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const page = source.getPage([]);
  if (!page) notFound();
  const { body: MDXContent } = await page.data.load();

  return (
    <main className="flex-1">
      <article className="mx-auto w-full max-w-4xl px-6 py-12 prose prose-neutral dark:prose-invert">
        <h1>{page.data.title}</h1>
        <MDXContent components={getMDXComponents()} />
      </article>
    </main>
  );
}

export function generateMetadata() {
  const page = source.getPage([]);
  return {
    title: page?.data.title ?? 'Rusrails',
    description: page?.data.description,
  };
}
