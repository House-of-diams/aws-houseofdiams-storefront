import CheckoutField from '@/components/checkout/CheckoutField'
import type { CheckoutPostalAreaOption, CheckoutPostalLookupState, CheckoutProfileForm } from '@/components/checkout/types'
import { sanitizePhoneInput } from '@/lib/validation'

export default function CheckoutInformationStep({ form, onChange, errors = {}, postalLookup, onPostalBlur, postalAreaOptions = [], onPostalAreaSelect, isGuest }: { form: CheckoutProfileForm; onChange: (field: keyof CheckoutProfileForm, value: string) => void; errors?: Partial<Record<keyof CheckoutProfileForm, string>>; postalLookup?: CheckoutPostalLookupState | null; onPostalBlur?: () => void; postalAreaOptions?: CheckoutPostalAreaOption[]; onPostalAreaSelect?: (id: string) => void; isGuest: boolean }) {
  return (
    <section className="border border-black/10 bg-white p-6 shadow-[0_8px_24px_rgba(0,0,0,0.04)] sm:p-8 lg:p-10">
      <h2 className="font-[family-name:var(--font-family-primary)] text-[20px] font-semibold uppercase text-black">{isGuest ? 'Guest Checkout' : 'Shipping Information'}</h2>
      <p className="mt-6 font-[family-name:var(--font-family-secondary)] text-[12px] font-semibold text-black">Shipping Information</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="md:col-span-2"><CheckoutField label="Email" value={form.email} onChange={(value) => onChange('email', value)} type="email" placeholder="Email" required error={errors.email} /></div>
        <CheckoutField label="First Name" value={form.first_name} onChange={(value) => onChange('first_name', value)} placeholder="First name" required error={errors.first_name} />
        <CheckoutField label="Last Name" value={form.last_name} onChange={(value) => onChange('last_name', value)} placeholder="Last name" required error={errors.last_name} />
        <div className="md:col-span-2"><CheckoutField label="Phone Number" value={form.phone} onChange={(value) => onChange('phone', sanitizePhoneInput(value))} inputMode="tel" type="tel" placeholder="Phone number with country code" required error={errors.phone} /></div>
        {isGuest ? <>
          <CheckoutField label="Birth Date" value={form.birth_date} onChange={(value) => onChange('birth_date', value)} type="date" placeholder="Birth date (optional)" error={errors.birth_date} />
          <CheckoutField label="Anniversary Date" value={form.anniversary_date} onChange={(value) => onChange('anniversary_date', value)} type="date" placeholder="Anniversary date (optional)" error={errors.anniversary_date} />
        </> : null}
        <div className="md:col-span-2"><CheckoutField label="Street Address" value={form.address_line_1} onChange={(value) => onChange('address_line_1', value)} placeholder="Street address" required error={errors.address_line_1} /></div>
        <div className="md:col-span-2"><CheckoutField label="Apartment / Suite / Floor" value={form.address_line_2} onChange={(value) => onChange('address_line_2', value)} placeholder="Apartment, suite, floor or landmark (optional)" /></div>
        <CheckoutField label="Postal Code / Pincode" value={form.postal_code} onChange={(value) => onChange('postal_code', value)} onBlur={onPostalBlur} placeholder="Postal code" required error={errors.postal_code} trailing={postalLookup?.status === 'loading' ? <span className="inline-flex h-4 w-4 animate-spin border-2 border-black/20 border-t-black" /> : postalLookup?.status === 'success' ? <span className="text-black">✓</span> : null} />
        <CheckoutField label="City" value={form.city} onChange={(value) => onChange('city', value)} placeholder="City" required error={errors.city} />
        <CheckoutField label="District" value={form.district} onChange={(value) => onChange('district', value)} placeholder="District (optional)" />
        <CheckoutField label="State / Province / Region" value={form.state} onChange={(value) => onChange('state', value)} placeholder="State" required error={errors.state} />
        <div className="md:col-span-2"><CheckoutField label="Country" value={form.country} onChange={(value) => onChange('country', value)} placeholder="Country" required error={errors.country} /></div>
      </div>
      {postalAreaOptions.length > 1 ? <label className="mt-3 block border border-black/20 bg-white px-4 py-3"><span className="block font-[family-name:var(--font-family-secondary)] text-[10px] uppercase text-black/50">Select Post Office / Area</span><select className="mt-2 h-10 w-full border-0 bg-transparent font-[family-name:var(--font-family-secondary)] text-[13px] outline-none" onChange={(event) => onPostalAreaSelect?.(event.target.value)} defaultValue={postalAreaOptions[0]?.id}>{postalAreaOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label> : null}
      {postalLookup?.message ? <p className={`mt-3 font-[family-name:var(--font-family-secondary)] text-[11px] ${postalLookup.status === 'error' ? 'text-red-700' : 'text-black/55'}`}>{postalLookup.message}</p> : null}
    </section>
  )
}
