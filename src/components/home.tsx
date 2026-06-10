import Link from 'next/link';
import type { ReactNode } from 'react';

export function Hero({
  title = 'Руководства Ruby on Rails',
  version,
  children,
}: {
  title?: string;
  version?: string;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-fd-border pb-8 mb-10">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2 mb-4">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight m-0">
          {title}
        </h1>
        {version ? (
          <span className="inline-flex items-center rounded-full bg-fd-primary/10 text-fd-primary px-3 py-1 text-sm font-medium">
            {version}
          </span>
        ) : null}
      </div>
      <div className="text-fd-muted-foreground text-base leading-relaxed space-y-3">
        {children}
      </div>
    </section>
  );
}

export function HomeSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-12 first:mt-0">
      <h2 className="text-2xl font-semibold tracking-tight mb-5 pb-2 border-b border-fd-border">
        {title}
      </h2>
      <GuideGrid>{children}</GuideGrid>
    </section>
  );
}

export function GuideGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
  );
}

export function GuideCard({
  title,
  href,
  children,
}: {
  title: string;
  href: string;
  children?: ReactNode;
}) {
  const isExternal = /^https?:\/\//.test(href);
  const className =
    'group flex flex-col gap-2 rounded-lg border border-fd-border bg-fd-card p-4 transition-colors hover:border-fd-primary/50 hover:bg-fd-accent/50 no-underline';

  const content = (
    <>
      <span className="font-semibold text-fd-foreground group-hover:text-fd-primary">
        {title}
      </span>
      {children ? (
        <span className="text-sm text-fd-muted-foreground leading-relaxed">
          {children}
        </span>
      ) : null}
    </>
  );

  if (isExternal) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        className={className}
      >
        {content}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {content}
    </Link>
  );
}

export function HomeFooter({ children }: { children: ReactNode }) {
  return (
    <footer className="mt-16 pt-8 border-t border-fd-border text-sm text-fd-muted-foreground space-y-3 leading-relaxed">
      {children}
    </footer>
  );
}
