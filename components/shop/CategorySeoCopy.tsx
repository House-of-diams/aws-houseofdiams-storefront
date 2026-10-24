import Link from 'next/link'

// Editor-written category copy. The HTML is sanitised on the server before it gets here.
const copyStyles = `font-[family-name:var(--font-family-secondary)] text-[14px] leading-[1.8] text-[#292727]
  [&_p]:mb-4 [&_p:last-child]:mb-0
  [&_h2]:mb-3 [&_h2]:mt-8 [&_h2]:font-[family-name:var(--font-family-primary)] [&_h2]:text-[16px] [&_h2]:font-bold [&_h2]:uppercase [&_h2]:tracking-[0.06em] [&_h2]:text-[#222222]
  [&_h3]:mb-2 [&_h3]:mt-6 [&_h3]:text-[15px] [&_h3]:font-semibold [&_h3]:text-[#222222]
  [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:py-0.5
  [&_a]:underline [&_a]:underline-offset-2`

export function CategorySeoIntro({ html, wideGutter }: { html: string; wideGutter?: boolean }) {
  return (
    <div className={`bg-white px-4 pt-6 sm:px-7 ${wideGutter ? 'lg:px-[50px]' : 'lg:px-[52px]'}`}>
      <div className={`max-w-3xl ${copyStyles}`} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}

export function CategorySeoBody({
  html,
  guide,
}: {
  html: string | null
  guide: { href: string; title: string } | null
}) {
  if (!html && !guide) return null
  return (
    <section className="section-rhythm border-t border-[#e4e4e4] bg-(--color-white) px-4 sm:px-7" aria-label="About this collection">
      <div className="mx-auto max-w-3xl">
        {html ? <div className={copyStyles} dangerouslySetInnerHTML={{ __html: html }} /> : null}
        {guide ? (
          <p className={`${html ? 'mt-6' : ''} font-[family-name:var(--font-family-secondary)] text-[14px] text-[#292727]`}>
            Read our guide:{' '}
            <Link href={guide.href} className="font-semibold text-[#222222] underline underline-offset-2">
              {guide.title}
            </Link>
          </p>
        ) : null}
      </div>
    </section>
  )
}
