import CheckoutField from '@/components/checkout/CheckoutField';
import CheckoutSectionCard from '@/components/checkout/CheckoutSectionCard';
import type { CheckoutProfileForm } from '@/components/checkout/types';
import { sanitizePhoneInput } from '@/lib/validation'

export default function CheckoutCustomerStep({
  form,
  onChange,
  errors = {},
}: {
  form: CheckoutProfileForm
  onChange: (field: keyof CheckoutProfileForm, value: string) => void
  errors?: Partial<Record<keyof CheckoutProfileForm, string>>
}) {
  return (
    <CheckoutSectionCard
      title="Customer"
      description="These details are prefilled when available, and you can edit or add anything missing."
    >
      <div className="grid gap-3 md:grid-cols-2">
        <CheckoutField label="First Name" value={form.first_name} onChange={(value) => onChange('first_name', value)} placeholder="Enter first name" required error={errors.first_name} />
        <CheckoutField label="Last Name" value={form.last_name} onChange={(value) => onChange('last_name', value)} placeholder="Enter last name" required error={errors.last_name} />
        <CheckoutField label="Email" value={form.email} onChange={(value) => onChange('email', value)} type="email" placeholder="Enter email" required error={errors.email} />
        <CheckoutField label="Mobile Number" value={form.phone} onChange={(value) => onChange('phone', sanitizePhoneInput(value))} inputMode="tel" type="tel" placeholder="Enter mobile number with country code" required error={errors.phone} />
      </div>
    </CheckoutSectionCard>
  );
}
