import DataNotice from '@/components/consent/DataNotice'
import type { CheckoutProfileForm } from '@/components/checkout/types'

export default function CheckoutConfirmationStep({ form, itemCount, onEdit, onPay, processing, disabled, message }: { form: CheckoutProfileForm; itemCount: number; onEdit: () => void; onPay: () => void; processing: boolean; disabled: boolean; message?: string }) {
  return (
    <section className="border border-black/10 bg-white p-6 shadow-[0_8px_24px_rgba(0,0,0,0.04)] sm:p-8 lg:p-10">
      <div className="flex items-start justify-between gap-5">
        <h2 className="font-[family-name:var(--font-family-primary)] text-[20px] font-semibold uppercase text-black">Shipping Information</h2>
        <button type="button" onClick={onEdit} className="border-0 bg-transparent p-0 font-[family-name:var(--font-family-secondary)] text-[11px] text-black underline underline-offset-4">Edit</button>
      </div>
      <div className="mt-6 font-[family-name:var(--font-family-secondary)] text-[12px] leading-5 text-black/65">
        <p className="font-semibold text-black">Email</p><p>{form.email}</p>
        <div className="mt-6 border-t border-black/10 pt-6">
          <p className="font-[family-name:var(--font-family-primary)] text-[15px] font-semibold uppercase text-black">Delivery <span className="font-[family-name:var(--font-family-secondary)] text-[11px] font-normal normal-case">({itemCount} {itemCount === 1 ? 'item' : 'items'})</span></p>
          <p className="mt-4 font-semibold text-black">Shipping Address</p>
          <p>{form.first_name} {form.last_name}</p><p>{form.address_line_1}</p>{form.address_line_2 ? <p>{form.address_line_2}</p> : null}<p>{[form.city, form.district, form.state, form.postal_code].filter(Boolean).join(', ')}</p><p>{form.country}</p><p>{form.phone}</p>
          <p className="mt-5 font-semibold text-black">Shipping Method</p><p>Complimentary insured shipping with signature</p>
        </div>
      </div>
      {message ? <p className="mt-5 font-[family-name:var(--font-family-secondary)] text-[11px] text-amber-700">{message}</p> : null}
      <DataNotice fields="order and contact details" purpose="take payment through our payment partner and fulfil your order" className="mt-5" />
      <button type="button" onClick={onPay} disabled={processing || disabled} className="mt-7 flex min-h-12 w-full items-center justify-center border border-black bg-black px-6 font-[family-name:var(--font-family-button)] text-[11px] font-semibold uppercase tracking-[0.1em] text-white transition hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-50">{processing ? 'Opening Secure Payment...' : 'Continue to Payment'}</button>
    </section>
  )
}
