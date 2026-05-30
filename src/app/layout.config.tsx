import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { Logo } from '@/components/logo';

export const baseOptions: BaseLayoutProps = {
  nav: {
    title: <Logo />,
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
