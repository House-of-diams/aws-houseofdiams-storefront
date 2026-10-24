import type { Metadata } from 'next'
import { createFixedPageMetadata } from '@/lib/page-seo'
import { getDocsPageContent } from '@/lib/docs-pages'
import { sanitizeRichText } from '@/lib/sanitize-html'

export function generateMetadata(): Promise<Metadata> {
  return createFixedPageMetadata('shipping', {
  title: 'Shipping',
  description: 'Shipping timelines and delivery details from House of Diams.',
  path: '/shipping',
})
}

export default async function ShippingPage() {
  const { page, blocks } = await getDocsPageContent('shipping')
  const content = blocks.length ? blocks : [{ heading: 'Shipping', description: 'Shipping timelines and delivery details.', body: 'We aim to dispatch orders quickly and keep you informed throughout the process.' }]

  return (
    <main className="min-h-screen bg-(--color-white) px-4 pb-16 pt-12 sm:px-7 sm:pb-24 sm:pt-16">
      <h1 className="text-center text-[clamp(1.5rem,2.4vw,1.875rem)] uppercase leading-none tracking-[0.04em] text-[#111111] font-bold!">
        {page?.title ?? 'Shipping'}
      </h1>
      <div className="mx-auto mt-10 max-w-4xl bg-(--color-white) px-6 py-8 shadow-(--theme-shadow-card) sm:px-10 sm:py-10">
        <div className="space-y-8">
          {content.map((block, index) => (
            <section key={`${block.heading}-${index}`} className="space-y-3">
              {block.heading ? <h2 className="text-[13px] uppercase tracking-[0.06em] text-[#222222] font-bold!">{block.heading}</h2> : null}
              {block.description ? <p className="text-[13px] leading-[1.75] text-[#292727]">{block.description}</p> : null}
              {block.body ? <div className="text-[13px] leading-[1.75] text-[#292727] [&_a]:text-[#0000EE] [&_a]:underline [&_:is(h2,h3,h4,h5,h6)]:mt-7 [&_:is(h2,h3,h4,h5,h6)]:mb-2 [&_:is(h2,h3,h4,h5,h6)]:text-[13px] [&_:is(h2,h3,h4,h5,h6)]:uppercase [&_:is(h2,h3,h4,h5,h6)]:tracking-[0.06em] [&_:is(h2,h3,h4,h5,h6)]:text-[#222222] [&_:is(h2,h3,h4,h5,h6)]:font-bold! [&_li]:text-[13px] [&_li]:leading-[1.7] [&_li]:text-[#292727] [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-4 [&_strong]:font-bold [&_strong]:text-[#222222] [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5" dangerouslySetInnerHTML={{ __html: sanitizeRichText(block.body) }} /> : null}
            </section>
          ))}
        </div>
      </div>
    </main>
  )
}
