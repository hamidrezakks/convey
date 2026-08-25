import { Accordion, Accordions } from 'fumadocs-ui/components/accordion';
import { Callout } from 'fumadocs-ui/components/callout';
import { Card, Cards } from 'fumadocs-ui/components/card';
import { Step, Steps } from 'fumadocs-ui/components/steps';
import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/page';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type React from 'react';
import { source } from '@/lib/source';

interface DocData {
  title?: string;
  description?: string;
  body?: React.ComponentType<{ components?: Record<string, unknown> }>;
  toc?: unknown;
  full?: boolean;
  _exports?: {
    default?: React.ComponentType<{ components?: Record<string, unknown> }>;
  };
}

export default async function Page(props: { params: Promise<{ slug?: string[] }> }) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const data = page.data as unknown as DocData;
  const MDX = data.body || data._exports?.default;

  return (
    <DocsPage toc={data.toc as never} full={data.full}>
      <DocsTitle>{data.title || page.slugs[page.slugs.length - 1]}</DocsTitle>
      {data.description && <DocsDescription>{data.description}</DocsDescription>}
      <DocsBody>
        {typeof MDX === 'function' ? (
          <MDX
            components={{
              ...defaultMdxComponents,
              Tabs,
              Tab,
              Callout,
              Card,
              Cards,
              Step,
              Steps,
              Accordion,
              Accordions,
            }}
          />
        ) : (
          <div className="text-fd-muted-foreground">{/* Rendered documentation content */}</div>
        )}
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: { params: Promise<{ slug?: string[] }> }): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const data = page.data as unknown as DocData;

  return {
    title: data.title || 'Convey Documentation',
    description: data.description || 'High-Performance Communication Infrastructure',
  };
}
