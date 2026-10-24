'use client'

import { useEffect, useRef } from 'react'
import { cinzelFont } from '@/app/fonts'

function RevealDiv({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          entries[0].target.classList.add('opacity-100', 'translate-y-0')
          entries[0].target.classList.remove('opacity-0', 'translate-y-6')
          obs.disconnect()
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -50px' }
    )
    obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={`translate-y-6 opacity-0 transition-[opacity,transform] duration-[900ms] ease-[cubic-bezier(0.2,0.7,0.3,1)] ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

function FreeResizingIcon() {
  return (
    <svg width="49" height="48" viewBox="0 0 49 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M28.0325 16.3885C33.3877 17.9096 37.3098 22.8374 37.3098 28.6955C37.3098 35.7729 31.5775 41.5052 24.5001 41.5052C17.4226 41.5052 11.6903 35.7729 11.6903 28.6955C11.6903 22.8374 15.6124 17.9096 20.9676 16.3885" stroke="#0A1628" strokeMiterlimit="10" strokeLinecap="round"/>
      <path d="M14.4819 28.6925H34.518" stroke="#0A1628" strokeMiterlimit="10"/>
      <path d="M32.08 26.0244L34.5179 28.6925L32.08 31.3606" stroke="#0A1628" strokeMiterlimit="10"/>
      <path d="M16.9199 31.3606L14.4819 28.6925L16.9199 26.0244" stroke="#0A1628" strokeMiterlimit="10"/>
      <path d="M17.8824 10.2998L21.0989 7.02747H27.901L31.1174 10.2998L24.4967 16.2724L17.8824 10.2998Z" fill="white" stroke="#0A1628" strokeMiterlimit="10"/>
      <path d="M23.2948 12.2568L21.1497 10.3203L22.3988 9.0498" fill="white"/>
      <path d="M23.2948 12.2568L21.1497 10.3203L22.3988 9.0498" stroke="#0A1628" strokeMiterlimit="10" strokeLinecap="round"/>
      <path d="M24.4968 16.1901L27.4429 10.3287L25.1839 7.03735" fill="white"/>
      <path d="M24.4968 16.1901L27.4429 10.3287L25.1839 7.03735" stroke="#0A1628" strokeMiterlimit="10"/>
    </svg>
  )
}

function OvernightShippingIcon() {
  return (
    <svg width="49" height="48" viewBox="0 0 49 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M40.2694 8.22979C39.0161 6.97417 35.4358 9.05918 32.6988 11.7962L28.5649 15.9301L9.85688 12.0324C9.68755 11.9978 9.50324 12.0404 9.36501 12.1522C9.22677 12.2639 9.14729 12.4321 9.14729 12.6095V15.1634C9.14729 15.3822 9.26824 15.5838 9.46292 15.6852L18.0714 20.2066L20.8342 23.6608L16.6822 27.8129L9.86494 26.2981C9.57465 26.2336 9.27284 26.3994 9.17723 26.6874L8.38468 29.065C8.29253 29.3438 8.41809 29.6479 8.68073 29.7793L13.0286 31.9533C11.9212 33.7425 11.7 35.2187 12.4902 36.009C12.8059 36.3246 13.2321 36.479 13.7447 36.479C14.5093 36.479 15.4687 36.1317 16.5439 35.4664L18.72 39.8185C18.8225 40.0224 19.0298 40.1445 19.2476 40.1445C19.3098 40.1445 19.372 40.1353 19.4342 40.1145L21.8118 39.322C22.0986 39.2264 22.2668 38.9292 22.2011 38.6343L20.6863 31.817L24.8388 27.6646L28.2961 30.4301L32.9949 39.0443C33.0974 39.2344 33.2967 39.3519 33.5121 39.3519H35.8897C36.0671 39.3519 36.2353 39.2724 36.347 39.1342C36.4588 38.996 36.5037 38.8151 36.4668 38.6423L32.5691 19.9343L36.703 15.8004C39.44 13.0633 41.5227 9.48311 40.2694 8.22979Z" fill="white" stroke="white" strokeWidth="2" strokeMiterlimit="10"/>
      <path d="M28.7561 16.5733L9.73615 12.6108V15.1651L18.4536 19.7433L21.6236 23.7058L28.7561 16.5733Z" fill="white" stroke="#0A1628" strokeLinejoin="round"/>
      <path d="M35.8882 38.7632H33.5107L28.7557 30.0457L24.7932 26.8758L31.9257 19.7433L35.8882 38.7632Z" fill="white" stroke="#0A1628" strokeLinejoin="round"/>
      <path d="M20.039 31.6307L21.624 38.7632L19.2465 39.5557L16.869 34.8007L20.039 31.6307Z" fill="white" stroke="#0A1628" strokeLinejoin="round"/>
      <path d="M16.8697 28.4607L9.73726 26.8757L8.94476 29.2532L13.6997 31.6307L16.8697 28.4607Z" fill="white" stroke="#0A1628" strokeLinejoin="round"/>
      <path d="M14.8868 30.442C14.8868 30.442 30.3405 14.9883 33.1142 12.2146C35.888 9.44083 39.058 7.85584 39.8505 8.64834C40.643 9.44084 39.058 12.6108 36.2842 15.3846C32.718 18.9508 24.1326 27.5361 18.0568 33.612C15.783 35.5757 13.6981 36.3857 12.9056 35.5932C12.1131 34.8007 12.9231 32.7158 14.8868 30.442Z" fill="white" stroke="#0A1628" strokeMiterlimit="10"/>
    </svg>
  )
}

function FreeReturnIcon() {
  return (
    <svg width="49" height="48" viewBox="0 0 49 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M15.8732 36.869C21.8977 40.9279 30.1355 40.2844 35.46 34.9598C40.7844 29.6354 41.428 21.3976 37.3691 15.373" stroke="#0A1628" strokeMiterlimit="10" strokeLinecap="round"/>
      <path d="M16.3361 42.1123L17.311 41.886L16.1909 37.0843L21.0623 36.3179L20.9058 35.3293L14.9731 36.2639L16.3361 42.1123Z" fill="#0A1628"/>
      <path d="M11.6305 32.6263C7.57176 26.6018 8.2152 18.364 13.5397 13.0395C18.8642 7.71507 27.102 7.07151 33.1264 11.1303" stroke="#0A1628" strokeMiterlimit="10" strokeLinecap="round"/>
      <path d="M28.0934 12.6709L27.9369 11.6824L32.8076 10.9167L31.6882 6.11426L32.6631 5.88794L34.0254 11.7371L28.0934 12.6709Z" fill="#0A1628"/>
      <path d="M15.3755 23.0725L19.8104 18.6241H29.1894L33.6243 23.0725L24.4955 31.1916L15.3755 23.0725Z" fill="white" stroke="#0A1628" strokeMiterlimit="10"/>
      <path d="M22.8381 25.7328L19.8804 23.1004L21.6027 21.3733" fill="white"/>
      <path d="M22.8381 25.7328L19.8804 23.1004L21.6027 21.3733" stroke="#0A1628" strokeMiterlimit="10" strokeLinecap="round"/>
      <path d="M24.4955 31.0799L28.5577 23.112L25.443 18.6377" fill="white"/>
      <path d="M24.4955 31.0799L28.5577 23.112L25.443 18.6377" stroke="#0A1628" strokeMiterlimit="10"/>
    </svg>
  )
}

function CertificateIcon() {
  return (
    <svg width="49" height="48" viewBox="0 0 49 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M40.2613 39.807H36.2466C36.2466 38.7426 36.6699 37.7208 37.4225 36.9681C38.1751 36.2155 39.197 35.7922 40.2613 35.7922V39.807Z" stroke="#0A1628" strokeLinejoin="round"/>
      <path d="M8.73865 39.807V35.7922C9.80302 35.7922 10.8249 36.2155 11.5775 36.9681C12.3301 37.7208 12.7534 38.7426 12.7534 39.807H8.73865Z" stroke="#0A1628" strokeLinejoin="round"/>
      <path d="M40.2613 8.19299V12.2078C39.197 12.2078 38.1751 11.7845 37.4225 11.0319C36.6699 10.2792 36.2466 9.25736 36.2466 8.19299H40.2613Z" stroke="#0A1628" strokeLinejoin="round"/>
      <path d="M8.73865 8.19299H12.7534C12.7534 9.25736 12.3301 10.2792 11.5775 11.0319C10.8249 11.7845 9.80302 12.2078 8.73865 12.2078V8.19299Z" stroke="#0A1628" strokeLinejoin="round"/>
      <path d="M40.2613 8.19299H8.73865V39.8071H40.2613V8.19299Z" stroke="#0A1628" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M34.7791 30.537H14.2208" stroke="#0A1628" strokeLinejoin="round"/>
      <path d="M28.6116 34.2922H20.3883" stroke="#0A1628" strokeLinejoin="round"/>
      <path d="M31.6116 26.7817H17.3883" stroke="#0A1628" strokeLinejoin="round"/>
      <path d="M17.6064 16.3137L20.957 12.953H28.0428L31.3934 16.3137L24.4966 22.4477L17.6064 16.3137Z" fill="white" stroke="#0A1628" strokeMiterlimit="10"/>
      <path d="M23.2445 18.3235L21.0099 16.3347L22.3111 15.0299" fill="white"/>
      <path d="M23.2445 18.3235L21.0099 16.3347L22.3111 15.0299" stroke="#0A1628" strokeMiterlimit="10" strokeLinecap="round"/>
      <path d="M24.4966 22.3633L27.5655 16.3436L25.2123 12.9633" fill="white"/>
      <path d="M24.4966 22.3633L27.5655 16.3436L25.2123 12.9633" stroke="#0A1628" strokeMiterlimit="10"/>
    </svg>
  )
}

function ConflictFreeIcon() {
  return (
    <svg width="49" height="48" viewBox="0 0 49 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M15.4414 18.6961L19.8441 14.2802H29.1548L33.5575 18.6961L24.4951 26.7562L15.4414 18.6961Z" fill="white" stroke="#0A1628" strokeMiterlimit="10"/>
      <path d="M22.851 21.3371L19.9148 18.7238L21.6246 17.0093" fill="white"/>
      <path d="M22.851 21.3371L19.9148 18.7238L21.6246 17.0093" stroke="#0A1628" strokeMiterlimit="10" strokeLinecap="round"/>
      <path d="M24.4965 26.6453L28.5291 18.7353L25.437 14.2936" fill="white"/>
      <path d="M24.4965 26.6453L28.5291 18.7353L25.437 14.2936" stroke="#0A1628" strokeMiterlimit="10"/>
      <path d="M24.5007 3.58362L28.9218 5.63863L33.7064 6.57474L36.0753 10.8359L39.3959 14.4056L38.8076 19.2454L39.3959 24.0851L36.0753 27.6548L33.7064 31.916L28.9218 32.8521L24.5007 34.9071L20.0796 32.8521L15.2949 31.916L12.9261 27.6548L9.60547 24.0851L10.1937 19.2454L9.60547 14.4056L12.9261 10.8359L15.2949 6.57474L20.0796 5.63863L24.5007 3.58362Z" stroke="#0A1628" strokeMiterlimit="10"/>
      <path d="M31.1817 36.1914L29.393 33.0216" stroke="#0A1628" strokeMiterlimit="10" strokeLinecap="round"/>
      <path d="M26.0594 34.3899L29.7304 42.6121L32.7719 38.7981L37.6432 39.4043L34.4463 33.6522" stroke="#0A1628" strokeMiterlimit="10" strokeLinecap="round"/>
      <path d="M15.4964 31.9552L11.3593 39.4043L16.2306 38.7982L19.2721 42.6122L22.2369 35.9716" stroke="#0A1628" strokeMiterlimit="10" strokeLinecap="round"/>
      <path d="M17.6857 35.9129L19.3162 32.9989" stroke="#0A1628" strokeMiterlimit="10" strokeLinecap="round"/>
    </svg>
  )
}

function PackagingIcon() {
  return (
    <svg width="49" height="48" viewBox="0 0 49 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M35.4511 5.93481H14.2992C12.4255 5.93481 10.9066 7.45377 10.9066 9.32749V30.5442C10.9066 32.418 12.4255 33.9369 14.2992 33.9369H35.4511C37.3248 33.9369 38.8437 32.418 38.8437 30.5442V9.32749C38.8437 7.45377 37.3248 5.93481 35.4511 5.93481Z" fill="white" stroke="#0A1628" strokeMiterlimit="10"/>
      <path d="M27.324 19.9484C31.0373 21.0055 33.757 24.4304 33.757 28.5018C33.757 33.4208 29.7821 37.4048 24.8746 37.4048C19.9671 37.4048 15.9923 33.4208 15.9923 28.5018C15.9923 24.4304 18.7119 21.0055 22.4252 19.9484" stroke="white" strokeWidth="3" strokeMiterlimit="10" strokeLinecap="round"/>
      <path d="M27.9152 20.1436C31.3192 21.3762 33.7506 24.6445 33.7506 28.5008C33.7506 33.4202 29.7812 37.4009 24.8731 37.4009C19.965 37.4009 15.9956 33.4202 15.9956 28.5008C15.9956 24.6445 18.427 21.3762 21.831 20.1436" stroke="#0A1628" strokeMiterlimit="10" strokeLinecap="round"/>
      <path d="M19.4844 14.8176L22.1051 12.2637H27.6473L30.268 14.8176L24.8736 19.479L19.4844 14.8176Z" fill="white" stroke="#0A1628" strokeWidth="0.75" strokeMiterlimit="10"/>
      <path d="M23.8926 16.345L22.1448 14.8336L23.1626 13.842" fill="white"/>
      <path d="M23.8926 16.345L22.1448 14.8336L23.1626 13.842" stroke="#0A1628" strokeWidth="0.75" strokeMiterlimit="10" strokeLinecap="round"/>
      <path d="M24.8748 19.4147L27.2752 14.8402L25.4347 12.2714" fill="white"/>
      <path d="M24.8748 19.4147L27.2752 14.8402L25.4347 12.2714" stroke="#0A1628" strokeWidth="0.75" strokeMiterlimit="10"/>
      <path d="M8.47803 33.5427H41.2739V37.5415C41.2739 40.0382 39.2469 42.0651 36.7503 42.0651H13.0016C10.505 42.0651 8.47803 40.0382 8.47803 37.5415V33.5427Z" fill="white" stroke="#0A1628" strokeMiterlimit="10"/>
    </svg>
  )
}

const certificationItems = [
  { title: ['Free', 'Resizing'], icon: <FreeResizingIcon /> },
  { title: ['Overnight', 'Shipping'], icon: <OvernightShippingIcon /> },
  { title: ['15 Days', 'Free Return'], icon: <FreeReturnIcon /> },
  { title: ['Certificate', '& Appraisal'], icon: <CertificateIcon /> },
  { title: ['Conflict Free', 'Diamonds'], icon: <ConflictFreeIcon /> },
  { title: ['Elegant', 'Packaging'], icon: <PackagingIcon /> },
]

export default function Certifications() {
  return (
    <section className="mx-auto max-w-[1400px] px-[52px] py-[110px] max-lg:px-7 max-md:px-4 max-md:py-[56px]">
      <RevealDiv className="mb-[var(--space-section-block)] flex flex-col items-center text-center">
          <h2
            className={`${cinzelFont.variable} font-primary-display section-title font-light leading-[1.08] tracking-[0.01em] text-[#0A0A0A] max-md:text-[28px]`}
            style={{ fontSize: 'clamp(24px, 4.5vw, 54px)', fontWeight: 400 }}
          >
          Why Choose{' '}
          <em className="not-italic font-normal italic text-[#0A1628]">
            House of Diams
          </em>
        </h2>
      </RevealDiv>

      <RevealDiv delay={150}>
        <div className="grid grid-cols-6 max-xl:grid-cols-3 max-md:grid-cols-3">
          {certificationItems.map((item) => (
            <div
              key={item.title.join('-')}
              className={[
                'relative flex min-h-[220px] flex-col items-center justify-center px-6 py-10 text-center max-md:min-h-[132px] max-md:px-2 max-md:py-4',
              ].join(' ')}
            >
              <div className="mb-6 flex h-14 w-14 items-center justify-center text-[#0A1628] max-md:mb-3 max-md:scale-[0.68]">
                {item.icon}
              </div>

              <p
                className="font-display-title max-w-[16ch] whitespace-pre-line text-[18px] font-normal leading-[1.5] tracking-[0.02em] text-[#0A0A0A] max-md:text-[11px] max-md:leading-[1.28]"
                style={{ fontWeight: 400 }}
              >
                {item.title.map((line, index) => (
                  <span key={`${line}-${index}`} className="block">
                    {line}
                  </span>
                ))}
              </p>
            </div>
          ))}
        </div>
      </RevealDiv>
    </section>
  )
}
