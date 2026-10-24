'use client';

interface AnnouncementBarProps {
  show?: boolean;
}

export default function AnnouncementBar({ show = true }: AnnouncementBarProps) {
  if (!show) return null;

  return (
    <div className="bg-[#0A1628] text-[#FFFFFF] text-center py-[9px] px-5 text-[10px] tracking-[0.24em] uppercase font-light fixed top-0 left-0 right-0 z-[1001]">
      Free Worldwide Insured Shipping
      <span className="inline-block w-1 h-1 bg-[#0A1628] rounded-full mx-3.5 align-middle" />
      IGI &amp; GIA Certified
      <span className="inline-block w-1 h-1 bg-[#0A1628] rounded-full mx-3.5 align-middle" />
      Bespoke Orders Accepted
    </div>
  );
}