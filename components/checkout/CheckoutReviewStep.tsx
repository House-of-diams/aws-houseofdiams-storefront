import Link from 'next/link';
import { useState } from 'react';
import CheckoutSectionCard from '@/components/checkout/CheckoutSectionCard';
import { useCurrency } from '@/context/CurrencyContext';
import { getCollectionHref } from '@/lib/browse-context';
import { getLoveLetterOccasionLabel, type LoveLetterDraft } from '@/lib/love-letter';
import { formatMoney } from '@/lib/currency';
import type { CheckoutChargeQuote, CheckoutProfileForm } from '@/components/checkout/types';

export default function CheckoutReviewStep({
  onPayNow,
  isProcessingPayment,
  continueHref,
  loveLetter,
  totalAmount,
  chargeQuote,
  isPaymentDisabled,
  paymentAvailabilityMessage,
  customer,
  onEditShipping,
}: {
  onPayNow: () => void
  isProcessingPayment: boolean
  continueHref?: string
  loveLetter?: LoveLetterDraft | null
  totalAmount: number
  chargeQuote?: CheckoutChargeQuote | null
  isPaymentDisabled?: boolean
  paymentAvailabilityMessage?: string
  customer: CheckoutProfileForm
  onEditShipping: () => void
}) {
  const { format } = useCurrency();
  const [selectedPaymentButton, setSelectedPaymentButton] = useState<'razorpay' | 'apple-pay' | null>(null);

  const paymentBlocked = isProcessingPayment || isPaymentDisabled;
  const loadingIndicator = (
    <span
      aria-hidden="true"
      className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
    />
  );

  return (
    <CheckoutSectionCard
      title="Review"
      description="Review your order, then continue into secure Razorpay payment."
    >
      <div className="mb-4 border border-black/10 bg-[#faf9f7] p-4 font-[family-name:var(--font-family-secondary)]">
        <div className="flex items-start justify-between gap-4">
          <div><div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-black/45">Shipping Information</div><div className="mt-2 text-[12px] font-medium text-black">{customer.email}</div></div>
          <button type="button" onClick={onEditShipping} className="border-0 bg-transparent p-0 text-[11px] text-black/55 underline underline-offset-4 hover:text-black">Edit</button>
        </div>
        <div className="mt-4 border-t border-black/10 pt-4 text-[12px] leading-5 text-black/60">
          <div className="font-medium text-black">{customer.first_name} {customer.last_name}</div>
          <div>{customer.address_line_1}</div>
          {customer.address_line_2 ? <div>{customer.address_line_2}</div> : null}
          <div>{[customer.city, customer.district, customer.state, customer.postal_code].filter(Boolean).join(', ')}</div>
          <div>{customer.country}</div>
          <div className="mt-1">{customer.phone}</div>
        </div>
      </div>
      {loveLetter ? (
        <div className="mb-4 border border-[#d8dde5] bg-[#faf9f7] p-4">
          <div className="text-sm font-medium text-[#344054]">Love letter</div>
          {loveLetter.wantsLetter ? (
            <div className="mt-2 space-y-1 text-sm leading-6 text-[#292727]">
              <div className="text-[#101828]">
                {loveLetter.letterType === 'write_myself' ? 'A custom written letter will be printed with this order.' : 'A generated love letter will be printed with this order.'}
              </div>
              {loveLetter.recipientName ? <div>Recipient: {loveLetter.recipientName}</div> : null}
              {loveLetter.occasionKey ? <div>Occasion: {getLoveLetterOccasionLabel(loveLetter.occasionKey)}</div> : null}
            </div>
          ) : (
            <p className="mt-2 text-sm leading-6 text-[#292727]">No letter will be included with this order.</p>
          )}
        </div>
      ) : null}
      <div className="border border-[#eaecf0] bg-white p-4">
        <div className="text-sm font-medium text-[#344054]">Ready to place your order</div>
        <p className="mt-2 text-sm leading-6 text-[#292727]">
          We will create your pending order first, then open Razorpay so the payment can be completed securely.
        </p>
        <div className="mt-3 space-y-1 text-sm text-[#292727]">
          <div>
            Catalog total: <span className="font-medium text-[#101828]">{format(totalAmount, { maximumFractionDigits: 2 })}</span>
          </div>
          <div>
            Amount to pay now:{' '}
            <span className="font-medium text-[#101828]">
              {formatMoney(chargeQuote?.totalCharged ?? totalAmount, chargeQuote?.chargeCurrency || 'USD', { maximumFractionDigits: 2 })}
            </span>
          </div>
          {chargeQuote ? (
            <div>
              Checkout is charged in {chargeQuote.chargeCurrency} using the latest USD exchange rate locked for this payment.
            </div>
          ) : null}
        </div>
        <div className="mt-5 border-t border-[#eaecf0] pt-5">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#292727]">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#b8964e]" />
            Secure payment options
          </div>
          {paymentAvailabilityMessage ? (
            <p role="status" className="mb-3 text-sm leading-6 text-[#b54708]">{paymentAvailabilityMessage}</p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setSelectedPaymentButton('razorpay');
                onPayNow();
              }}
              disabled={paymentBlocked}
              className="inline-flex min-h-[58px] items-center justify-center bg-black px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(0,0,0,0.12)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none disabled:hover:brightness-100"
            >
              {isProcessingPayment && selectedPaymentButton === 'razorpay' ? (
                <span className="inline-flex items-center gap-2" role="status">
                  {loadingIndicator}
                  Opening secure payment…
                </span>
              ) : 'Proceed to Pay'}
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedPaymentButton('apple-pay');
                onPayNow();
              }}
              disabled={paymentBlocked}
              aria-describedby="apple-pay-availability"
              className="inline-flex min-h-[58px] items-center justify-center gap-2.5 bg-[#050505] px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(5,5,5,0.2)] transition hover:bg-[#1a1a1a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#667085] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none"
            >
              {isProcessingPayment && selectedPaymentButton === 'apple-pay' ? (
                <span className="inline-flex items-center gap-2" role="status">
                  {loadingIndicator}
                  Opening secure payment…
                </span>
              ) : (
                <>
                  <span aria-hidden="true" className="text-[22px] leading-none"></span>
                  Pay with Apple Pay
                </>
              )}
            </button>
          </div>
          <p id="apple-pay-availability" className="mt-3 text-xs leading-5 text-[#292727]">
            Both payment options open the same secure Razorpay Checkout.
          </p>
          <Link
            href={continueHref || getCollectionHref()}
            className="mt-4 inline-flex min-h-10 items-center text-sm font-medium text-[#475467] underline decoration-[#b8bec8] underline-offset-4 transition hover:text-[#101828] focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b8964e]"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    </CheckoutSectionCard>
  );
}
