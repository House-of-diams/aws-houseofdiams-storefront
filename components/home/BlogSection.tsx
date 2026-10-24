'use client';

import { useEffect, useRef } from 'react';

const GLOW_RGB = '184,146,42';

const ArrowIcon = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
    <path d="M1 5H9M6 2L9 5L6 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const posts = [
  {
    cat: 'Diamond Guide',
    title: 'Natural vs Lab-Grown Diamonds: The Complete Guide',
    excerpt: 'Everything you need to know about choosing between natural and lab-grown diamonds. We break down the science, the value, and the emotional weight behind each choice.',
    date: 'April 12, 2025',
    featured: true,
    icon: (
      <svg width="140" height="140" viewBox="0 0 140 140" fill="none">
        <polygon points="70,15 110,35 100,115 40,115 30,35" stroke="#0A1628" strokeWidth="1.2" fill="rgba(10,22,40,0.06)" />
        <polygon points="70,30 95,44 89,95 51,95 45,44" stroke="#0A1628" strokeWidth=".6" fill="rgba(10,22,40,0.03)" />
      </svg>
    ),
  },
  {
    cat: 'Engagement',
    title: 'How to Choose the Perfect Ring Setting',
    excerpt: 'Solitaire, halo, pavé, bezel — which setting suits your stone?',
    date: 'Mar 28',
    icon: (
      <svg width="70" height="70" viewBox="0 0 70 70" fill="none">
        <circle cx="35" cy="35" r="22" stroke="#0A1628" strokeWidth=".8" fill="rgba(10,22,40,0.05)" />
        <circle cx="35" cy="35" r="14" stroke="#0A1628" strokeWidth=".4" fill="none" />
      </svg>
    ),
  },
  {
    cat: 'Care Guide',
    title: 'Caring for Your Diamond Jewelry',
    excerpt: 'Keep your pieces sparkling for decades with these tips.',
    date: 'Mar 10',
    icon: (
      <svg width="70" height="70" viewBox="0 0 70 70" fill="none">
        <rect x="15" y="25" width="40" height="20" rx="10" stroke="#0A1628" strokeWidth=".8" fill="rgba(10,22,40,0.05)" />
        <circle cx="25" cy="35" r="3" fill="rgba(32,48,74,0.2)" />
        <circle cx="35" cy="35" r="3" fill="rgba(32,48,74,0.2)" />
        <circle cx="45" cy="35" r="3" fill="rgba(32,48,74,0.2)" />
      </svg>
    ),
  },
  {
    cat: 'Education',
    title: 'Understanding the 4Cs of Diamonds',
    excerpt: 'Cut, color, clarity, carat — decoded simply.',
    date: 'Feb 22',
    icon: (
      <svg width="70" height="70" viewBox="0 0 70 70" fill="none">
        <polygon points="35,10 55,20 50,55 20,55 15,20" stroke="#0A1628" strokeWidth=".8" fill="rgba(10,22,40,0.05)" />
      </svg>
    ),
  },
  {
    cat: 'Trends',
    title: '2025 Engagement Ring Trends',
    excerpt: 'Oval is king, hidden halos are rising, and coloured stones are back.',
    date: 'Feb 10',
    icon: (
      <svg width="70" height="70" viewBox="0 0 70 70" fill="none">
        <ellipse cx="35" cy="35" rx="14" ry="20" stroke="#0A1628" strokeWidth=".8" fill="rgba(10,22,40,0.05)" />
      </svg>
    ),
  },
  {
    cat: 'Hip Hop',
    title: 'Cuban Links: Why Real Gold Matters',
    excerpt: 'The difference between plated, solid, and iced — and why your chain should never turn green.',
    date: 'Jan 28',
    icon: (
      <svg width="90" height="90" viewBox="0 0 90 90" fill="none">
        <path d="M45 10Q60 25 58 50Q52 72 45 75Q38 72 32 50Q30 25 45 10Z" stroke="#0A1628" strokeWidth=".8" fill="rgba(10,22,40,0.05)" />
      </svg>
    ),
  },
  {
    cat: 'Bespoke',
    title: 'Inside Our Surat Workshop: From Rough to Radiant',
    excerpt: 'A behind-the-scenes look at how 5 master craftsmen spend 60+ hours creating a single tennis bracelet.',
    date: 'Jan 15',
    icon: (
      <svg width="90" height="90" viewBox="0 0 90 90" fill="none">
        <circle cx="45" cy="45" r="28" stroke="#0A1628" strokeWidth=".8" fill="none" />
        <circle cx="45" cy="45" r="20" stroke="#0A1628" strokeWidth=".4" fill="rgba(10,22,40,0.04)" />
      </svg>
    ),
  },
];

// Grid position classes for each card (desktop 4-col)
const cardGridClasses = [
  'col-span-2 row-span-2 min-h-[420px]',  // 1
  'col-span-1 row-span-1',                 // 2
  'col-span-1 row-span-1',                 // 3
  'col-span-1 row-span-1',                 // 4
  'col-span-1 row-span-1',                 // 5
  'col-span-2 row-span-1',                 // 6
  'col-span-2 row-span-1',                 // 7
];

function BentoCard({
  post,
  gridClass,
  cardRef,
}: {
  post: (typeof posts)[number];
  gridClass: string;
  cardRef: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div
      ref={cardRef}
      className={`relative overflow-hidden cursor-pointer bg-[#0A0A0A] border border-white/[0.06] rounded-2xl
                  flex flex-col justify-end
                  transition-[transform,box-shadow] duration-[400ms] ease-[cubic-bezier(0.2,0.7,0.3,1)]
                  hover:-translate-y-[3px] hover:shadow-[0_12px_40px_rgba(10,22,40,0.12)]
                  ${gridClass}`}
      style={
        {
          '--glow-x': '50%',
          '--glow-y': '50%',
          '--glow-intensity': '0',
          '--glow-radius': '250px',
        } as React.CSSProperties
      }
    >
      {/* SVG background icon */}
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
        <div className="opacity-[0.08] transition-[transform,opacity] duration-[800ms] ease-[cubic-bezier(0.2,0.7,0.3,1)] group-hover:scale-[1.15] group-hover:opacity-[0.14]">
          {post.icon}
        </div>
      </div>

      {/* Gradient overlay */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[70%] pointer-events-none z-[2]"
        style={{ background: 'linear-gradient(transparent, rgba(10,10,10,0.95))' }}
      />

      {/* Border glow — using pseudo element via inline style trick with a wrapper */}
      <div
        className="absolute inset-0 rounded-2xl pointer-events-none z-10"
        style={{
          padding: '1px',
          background: `radial-gradient(
            var(--glow-radius, 250px) circle at var(--glow-x, 50%) var(--glow-y, 50%),
            rgba(${GLOW_RGB}, calc(var(--glow-intensity, 0) * 0.7)) 0%,
            rgba(${GLOW_RGB}, calc(var(--glow-intensity, 0) * 0.3)) 30%,
            transparent 60%
          )`,
          WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
        }}
      />

      {/* Content */}
      <div className="relative z-[3] p-7" style={{ fontFamily: 'Manrope, sans-serif' }}>
        <div className="font-numeric text-[8px] font-semibold tracking-[0.3em] uppercase text-[#0A1628] mb-[10px]
                        inline-flex items-center gap-2
                        before:content-[''] before:w-1 before:h-1 before:bg-[#0A1628] before:rounded-full">
          {post.cat}
        </div>
        <h3
          className={`font-numeric font-normal text-white tracking-[0.02em] leading-[1.25] mb-2
                      transition-colors duration-300 hover:text-[#FFFFFF]
                      ${post.featured ? 'text-[28px]' : 'text-[18px]'}`}
        >
          {post.title}
        </h3>
        <p
          className={`font-numeric text-[12px] font-light leading-[1.8] text-white/45 tracking-[0.02em]
                      overflow-hidden
                      ${post.featured ? 'line-clamp-3' : 'line-clamp-2'}`}
        >
          {post.excerpt}
        </p>
        <div className="flex justify-between items-center mt-[14px] pt-3 border-t border-white/[0.06]">
          <span className="font-numeric text-[10px] text-white/30 tracking-[0.1em]">{post.date}</span>
          <span className="font-numeric text-[9px] font-medium tracking-[0.24em] uppercase text-[#0A1628]
                           inline-flex items-center gap-1.5 transition-[gap] duration-300 hover:gap-2.5">
            Read <ArrowIcon />
          </span>
        </div>
      </div>
    </div>
  );
}

export default function BlogSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const spotlightRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined' || window.innerWidth <= 768) return;

    const section = sectionRef.current;
    const spotlight = spotlightRef.current;
    const cards = cardRefs.current.filter(Boolean) as HTMLDivElement[];

    const SPOTLIGHT_RADIUS = 300;
    const prox = SPOTLIGHT_RADIUS * 0.5;
    const fade = SPOTLIGHT_RADIUS * 0.75;

    // ── Mouse move: spotlight + border glow ──
    const handleMouseMove = (e: MouseEvent) => {
      if (!section || !spotlight) return;
      const sRect = section.getBoundingClientRect();
      const inside =
        e.clientX >= sRect.left && e.clientX <= sRect.right &&
        e.clientY >= sRect.top && e.clientY <= sRect.bottom;

      if (!inside) {
        spotlight.style.opacity = '0';
        cards.forEach((c) => c.style.setProperty('--glow-intensity', '0'));
        return;
      }

      spotlight.style.left = `${e.clientX}px`;
      spotlight.style.top = `${e.clientY}px`;

      let minDist = Infinity;
      cards.forEach((card) => {
        const r = card.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dist = Math.max(0, Math.hypot(e.clientX - cx, e.clientY - cy) - Math.max(r.width, r.height) / 2);
        minDist = Math.min(minDist, dist);

        const relX = ((e.clientX - r.left) / r.width) * 100;
        const relY = ((e.clientY - r.top) / r.height) * 100;
        const glow = dist <= prox ? 1 : dist <= fade ? (fade - dist) / (fade - prox) : 0;

        card.style.setProperty('--glow-x', `${relX}%`);
        card.style.setProperty('--glow-y', `${relY}%`);
        card.style.setProperty('--glow-intensity', glow.toString());
      });

      const op = minDist <= prox ? 0.7 : minDist <= fade ? ((fade - minDist) / (fade - prox)) * 0.7 : 0;
      spotlight.style.opacity = op.toString();
    };

    document.addEventListener('mousemove', handleMouseMove);

    // ── Particles + click ripple per card ──
    const cleanups: (() => void)[] = [];

    cards.forEach((card) => {
      let particles: HTMLDivElement[] = [];

      const onEnter = () => {
        const r = card.getBoundingClientRect();
        for (let i = 0; i < 8; i++) {
          setTimeout(() => {
            const p = document.createElement('div');
            p.style.cssText = `
              position:absolute;width:4px;height:4px;border-radius:50%;
              background:rgba(${GLOW_RGB},0.8);
              box-shadow:0 0 6px rgba(${GLOW_RGB},0.5);
              pointer-events:none;z-index:20;
              left:${Math.random() * r.width}px;
              top:${Math.random() * r.height}px;
              opacity:0;transform:scale(0)
            `;
            card.appendChild(p);
            particles.push(p);
            requestAnimationFrame(() => {
              p.style.transition = 'opacity .3s, transform .3s';
              p.style.opacity = '0.7';
              p.style.transform = 'scale(1)';
            });
            const dx = (Math.random() - 0.5) * 80;
            const dy = (Math.random() - 0.5) * 80;
            setTimeout(() => {
              p.style.transition = 'left 3s ease, top 3s ease, opacity 1.5s ease';
              p.style.left = `${parseFloat(p.style.left) + dx}px`;
              p.style.top = `${parseFloat(p.style.top) + dy}px`;
              p.style.opacity = '0.2';
            }, 350);
          }, i * 80);
        }
      };

      const onLeave = () => {
        particles.forEach((p) => {
          p.style.transition = 'opacity .25s, transform .25s';
          p.style.opacity = '0';
          p.style.transform = 'scale(0)';
          setTimeout(() => p.remove(), 300);
        });
        particles = [];
      };

      const onClick = (e: MouseEvent) => {
        const r = card.getBoundingClientRect();
        const x = e.clientX - r.left;
        const y = e.clientY - r.top;
        const maxD = Math.max(
          Math.hypot(x, y),
          Math.hypot(x - r.width, y),
          Math.hypot(x, y - r.height),
          Math.hypot(x - r.width, y - r.height)
        );
        const ripple = document.createElement('div');
        ripple.style.cssText = `
          position:absolute;width:${maxD * 2}px;height:${maxD * 2}px;border-radius:50%;
          background:radial-gradient(circle,rgba(${GLOW_RGB},0.3) 0%,rgba(${GLOW_RGB},0.1) 30%,transparent 70%);
          left:${x - maxD}px;top:${y - maxD}px;
          pointer-events:none;z-index:30;
          transform:scale(0);opacity:1;
          transition:transform .6s ease-out, opacity .6s ease-out
        `;
        card.appendChild(ripple);
        requestAnimationFrame(() => {
          ripple.style.transform = 'scale(1)';
          ripple.style.opacity = '0';
        });
        setTimeout(() => ripple.remove(), 700);
      };

      card.addEventListener('mouseenter', onEnter);
      card.addEventListener('mouseleave', onLeave);
      card.addEventListener('click', onClick);
      cleanups.push(() => {
        card.removeEventListener('mouseenter', onEnter);
        card.removeEventListener('mouseleave', onLeave);
        card.removeEventListener('click', onClick);
      });
    });

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      cleanups.forEach((fn) => fn());
    };
  }, []);

  return (
    <>
      {/* Global spotlight */}
      <div
        ref={spotlightRef}
        className="fixed w-[600px] h-[600px] rounded-full pointer-events-none z-[200] opacity-0
                   -translate-x-1/2 -translate-y-1/2 mix-blend-screen will-change-[transform,opacity]
                   transition-opacity duration-300"
        style={{
          background: `radial-gradient(circle, rgba(${GLOW_RGB},0.1) 0%, rgba(${GLOW_RGB},0.04) 25%, transparent 65%)`,
        }}
      />

      <section
        ref={sectionRef}
        className="py-[120px] px-[52px] max-w-[1400px] mx-auto max-[700px]:py-[80px] max-[700px]:px-5"
      >
        {/* Header */}
        <div className="flex justify-between items-end mb-14 flex-wrap gap-5 max-md:justify-center">
          <div className="max-md:text-center">
            <div className="text-[10px] font-medium tracking-[0.32em] uppercase text-[#0A1628] mb-[14px]
                            inline-flex items-center gap-3
                            before:content-[''] before:w-6 before:h-px before:bg-[#0A1628]">
              From the Atelier
            </div>
            <h2
              className="font-numeric section-title font-light text-[#0A1628] leading-[1.05]"
              style={{ fontSize: 'clamp(40px, 5vw, 64px)', fontFamily: 'Manrope, sans-serif' }}
            >
              Our Jewelry <span className="text-[#0A1628]">Blog</span>
            </h2>
          </div>
          <a
            href="#"
            className="hidden font-[family-name:var(--font-family-button)] text-[10px] font-medium tracking-[0.28em] uppercase text-[#0A1628] no-underline cursor-pointer
                       inline-flex items-center gap-[10px] pb-1 border-b border-[#0A1628]
                       transition-[color,border-color,gap] duration-300
                       hover:text-[#0A1628] hover:border-[#0A1628] hover:gap-4 md:inline-flex"
          >
            View All Articles →
          </a>
        </div>

        {/* Bento grid */}
        <div
          ref={gridRef}
          className="hidden gap-3 select-none md:grid
                     grid-cols-4 grid-rows-[auto_auto_auto]
                     max-[1100px]:grid-cols-2
                     max-[700px]:grid-cols-1"
        >
          {posts.map((post, i) => (
            <BentoCard
              key={post.title}
              post={post}
              gridClass={cardGridClasses[i]}
              cardRef={(el) => { cardRefs.current[i] = el; }}
            />
          ))}
        </div>

        <div className="md:hidden -mx-1 mt-2 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {posts.map((post, i) => (
            <div key={`${post.title}-mobile`} className="min-w-[84%] snap-center">
              <BentoCard
                post={post}
                gridClass={i === 0 ? 'min-h-[400px]' : 'min-h-[320px]'}
                cardRef={(el) => { cardRefs.current[i] = el; }}
              />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
