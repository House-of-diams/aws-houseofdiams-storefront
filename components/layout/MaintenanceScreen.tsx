type MaintenanceScreenProps = { message: string }

const maintenanceImage = '/produc page svgs/login page image/WhatsApp Image 2026-09-19 at 6.12.16 PM.jpeg';

export default function MaintenanceScreen({ message }: MaintenanceScreenProps) {
  return (
    <main className="fixed inset-0 z-[9999] grid min-h-screen bg-white md:grid-cols-2">
      <div className="relative min-h-[42vh] overflow-hidden border-b border-[var(--theme-border)] md:min-h-screen md:border-b-0 md:border-r">
        <img src={maintenanceImage} alt="House of Diams jewelry" className="absolute inset-0 h-full w-full object-cover object-center" />
      </div>
      <div className="flex items-center justify-center px-8 py-16 text-center md:px-14 lg:px-20">
        <div className="max-w-[460px]">
          <p className="font-primary-display text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--theme-muted)]">House of Diams</p>
          <h1 className="mt-5 font-primary-display text-[clamp(34px,5vw,64px)] font-medium leading-[1.02] text-[var(--theme-ink)]">We&apos;ll Be Back Shortly</h1>
          <p className="mt-7 font-secondary text-[13px] leading-7 text-[var(--theme-muted)]">{message}</p>
        </div>
      </div>
    </main>
  )
}