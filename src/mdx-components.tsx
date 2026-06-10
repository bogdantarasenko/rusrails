import defaultMdxComponents from 'fumadocs-ui/mdx';
import { Callout } from 'fumadocs-ui/components/callout';
import type { MDXComponents } from 'mdx/types';
import {
  Hero,
  HomeSection,
  GuideGrid,
  GuideCard,
  HomeFooter,
} from '@/components/home';

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    Callout,
    Hero,
    HomeSection,
    GuideGrid,
    GuideCard,
    HomeFooter,
    ...components,
  };
}
