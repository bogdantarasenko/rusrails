import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { Logo } from '@/components/logo';

export const baseOptions: BaseLayoutProps = {
  nav: {
    title: (
      <span className="flex items-center gap-2">
        <Logo />
      </span>
    ),
  },
  links: [
    {
      text: 'Документация',
      url: '/docs',
      active: 'nested-url',
    },
  ],
  githubUrl: 'https://github.com/rusrails/rusrails',
};
