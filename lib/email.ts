import nodemailer from 'nodemailer'
import { formatMoney as formatCurrencyAmount } from '@/lib/currency'
import { escapeHtml } from '@/lib/escape-html'
import { getEmailSiteUrl } from '@/lib/site-url'

type OrderEmailItem = {
  product_name: string
  quantity: number
  line_total: number
}

type BaseOrderEmailInput = {
  customerEmail: string
  customerName: string
  orderNumber: string
  orderDate?: string | null
  currency?: string | null
  subtotalAmount?: number
  gstAmount?: number
  gstLabel?: string
  gstPercentage?: number
  shippingAmount?: number
  couponCode?: string | null
  couponDiscountAmount?: number
  totalAmount: number
  items: OrderEmailItem[]
}

type OrderConfirmationInput = BaseOrderEmailInput

type OrderStatusUpdateInput = BaseOrderEmailInput & {
  status: string
}

const emailHost = process.env.EMAIL_HOST
const emailPort = Number(process.env.EMAIL_PORT || 587)
const emailUser = process.env.EMAIL_USER
const emailPass = process.env.EMAIL_PASS
const emailFrom = process.env.EMAIL_FROM
const siteUrl = getEmailSiteUrl()
const logoUrl = `${siteUrl.replace(/\/$/, '')}/logo.jpeg`

let cachedTransporter: ReturnType<typeof nodemailer.createTransport> | null = null

function formatMoney(amount: number, currency?: string | null) {
  return formatCurrencyAmount(amount, currency || 'USD')
}

function getTransporter() {
  if (!emailHost || !emailUser || !emailPass || !emailFrom) return null

  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: emailHost,
      port: emailPort,
      secure: emailPort === 465,
      auth: {
        user: emailUser,
        pass: emailPass,
      },
    })
  }

  return cachedTransporter
}

function renderItems(items: OrderEmailItem[], currency?: string | null) {
  return items
    .map(
      (item) => `
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid #e5e5e5;color:#000000;font-size:14px;line-height:1.5;">
            <div style="font-weight:600;">${escapeHtml(item.product_name)}</div>
            <div style="font-size:12px;color:#666666;text-transform:uppercase;letter-spacing:.16em;margin-top:4px;">Qty ${escapeHtml(item.quantity)}</div>
          </td>
          <td style="padding:14px 0;border-bottom:1px solid #e5e5e5;color:#000000;font-size:14px;line-height:1.5;text-align:right;font-weight:600;">
            ${formatMoney(item.line_total, currency)}
          </td>
        </tr>
      `
    )
    .join('')
}

function renderTotals({
  subtotalAmount = 0,
  gstAmount = 0,
  gstLabel = 'Taxes',
  gstPercentage,
  shippingAmount = 0,
  couponCode,
  couponDiscountAmount = 0,
  totalAmount,
  currency,
}: {
  subtotalAmount?: number
  gstAmount?: number
  gstLabel?: string
  gstPercentage?: number
  shippingAmount?: number
  couponCode?: string | null
  couponDiscountAmount?: number
  totalAmount: number
  currency?: string | null
}) {
  const taxLabel =
    gstAmount > 0 && gstPercentage
      ? `${gstLabel} (${gstPercentage}%)`
      : gstLabel

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top:18px;border-top:1px solid #e5e5e5;border-collapse:collapse;">
      <tr>
        <td style="padding-top:18px;padding-bottom:10px;font-size:14px;color:#555555;">Subtotal</td>
        <td style="padding-top:18px;padding-bottom:10px;text-align:right;font-size:14px;color:#000000;font-weight:600;">${formatMoney(subtotalAmount, currency)}</td>
      </tr>
      <tr>
        <td style="padding-bottom:10px;font-size:14px;color:#555555;">Shipping</td>
        <td style="padding-bottom:10px;text-align:right;font-size:14px;color:#000000;font-weight:600;">${shippingAmount > 0 ? formatMoney(shippingAmount, currency) : 'Free'}</td>
      </tr>
      <tr>
        <td style="padding-bottom:10px;font-size:14px;color:#555555;">${escapeHtml(taxLabel)}</td>
        <td style="padding-bottom:10px;text-align:right;font-size:14px;color:#000000;font-weight:600;">${gstAmount > 0 ? formatMoney(gstAmount, currency) : 'Free'}</td>
      </tr>
      ${
        couponDiscountAmount > 0
          ? `
      <tr>
        <td style="padding-bottom:10px;font-size:14px;color:#237a4b;">Coupon${couponCode ? ` (${escapeHtml(couponCode)})` : ''}</td>
        <td style="padding-bottom:10px;text-align:right;font-size:14px;color:#237a4b;font-weight:600;">-${formatMoney(couponDiscountAmount, currency)}</td>
      </tr>
      `
          : ''
      }
      <tr>
        <td style="padding-top:10px;border-top:1px solid #e5e5e5;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#000000;">Total</td>
        <td style="padding-top:10px;border-top:1px solid #e5e5e5;text-align:right;font-family:'Montserrat','Helvetica Neue',Arial,sans-serif;font-size:22px;font-weight:600;color:#000000;">${formatMoney(totalAmount, currency)}</td>
      </tr>
    </table>
  `
}

function renderShell({
  pretitle,
  title,
  body,
  badge,
  ctaLabel,
  ctaHref,
  orderNumber,
  orderDate,
  subtotalAmount,
  gstAmount,
  gstLabel,
  gstPercentage,
  shippingAmount,
  couponCode,
  couponDiscountAmount,
  totalAmount,
  items,
  currency,
}: {
  pretitle: string
  title: string
  body: string
  badge?: string
  ctaLabel: string
  ctaHref: string
  orderNumber: string
  orderDate?: string | null
  subtotalAmount?: number
  gstAmount?: number
  gstLabel?: string
  gstPercentage?: number
  shippingAmount?: number
  couponCode?: string | null
  couponDiscountAmount?: number
  totalAmount: number
  items: OrderEmailItem[]
  currency?: string | null
}) {
  const itemRows = renderItems(items, currency)
  const totalsMarkup = renderTotals({
    subtotalAmount,
    gstAmount,
    gstLabel,
    gstPercentage,
    shippingAmount,
    couponCode,
    couponDiscountAmount,
    totalAmount,
    currency,
  })
  const orderDateLabel = orderDate
    ? new Date(orderDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })
    : new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })

  return `
    <div style="margin:0;padding:32px 16px;background:#f9f9f9;font-family:'Inter','Helvetica Neue',Arial,sans-serif;color:#000000;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #dedede;border-radius:0;overflow:hidden;">
        <tr>
          <td style="padding:30px 28px;background:#000000;color:#ffffff;text-align:center;">
            <img src="${escapeHtml(logoUrl)}" width="58" alt="House of Diams" style="display:block;width:58px;height:auto;margin:0 auto 18px;border:0;" /><div style="font-family:'Montserrat','Helvetica Neue',Arial,sans-serif;font-size:12px;font-weight:600;letter-spacing:.28em;text-transform:uppercase;color:#ffffff;">House of Diams</div>
            <div style="margin-top:14px;font-family:'Montserrat','Helvetica Neue',Arial,sans-serif;font-size:28px;line-height:1.18;font-weight:600;letter-spacing:.02em;">${escapeHtml(title)}</div>
            <div style="margin-top:10px;font-size:14px;line-height:1.7;color:#e5e5e5;">${escapeHtml(body)}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;">
            <div style="font-size:11px;letter-spacing:.3em;text-transform:uppercase;color:#000000;">${escapeHtml(pretitle)}</div>
            ${
              badge
                ? `<div style="display:inline-block;margin-top:14px;padding:8px 14px;border-radius:0;border:1px solid #dedede;background:#f9f9f9;color:#000000;font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;">${escapeHtml(badge)}</div>`
                : ''
            }

            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top:22px;border-collapse:collapse;">
              <tr>
                <td style="padding:0 0 8px;color:#000000;font-size:11px;letter-spacing:.18em;text-transform:uppercase;">Order Number</td>
                <td style="padding:0 0 8px;color:#000000;font-size:11px;letter-spacing:.18em;text-transform:uppercase;text-align:right;">Order Date</td>
              </tr>
              <tr>
                <td style="padding:0 0 18px;font-size:17px;font-weight:600;color:#000000;">${escapeHtml(orderNumber)}</td>
                <td style="padding:0 0 18px;font-size:14px;color:#555555;text-align:right;">${escapeHtml(orderDateLabel)}</td>
              </tr>
            </table>

            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
              ${itemRows}
            </table>

            ${totalsMarkup}

            <div style="margin-top:28px;">
              <a href="${escapeHtml(ctaHref)}" style="display:inline-block;min-width:190px;padding:15px 24px;text-align:center;font-family:'Montserrat','Helvetica Neue',Arial,sans-serif;border-radius:0;background:#000000;color:#ffffff;text-decoration:none;font-size:12px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;">
                ${escapeHtml(ctaLabel)}
              </a>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 28px;border-top:1px solid #e5e5e5;background:#f9f9f9;color:#666666;font-size:13px;line-height:1.7;">
            Questions about your order? Reply to this email and our team will help you.
          </td>
        </tr>
      </table>
    </div>
  `
}

export async function sendOrderConfirmationEmail(input: OrderConfirmationInput) {
  const transporter = getTransporter()
  if (!transporter || !emailFrom || !input.customerEmail) return

  const customerName = input.customerName || 'Client'
  const html = renderShell({
    pretitle: 'Order Confirmation',
    title: `Thank you, ${customerName}`,
    body: 'Your House of Diams order has been received successfully. We will keep you updated as it moves through the next steps.',
    ctaLabel: 'View Account',
    ctaHref: `${siteUrl}/profile?tab=orders`,
    orderNumber: input.orderNumber,
    orderDate: input.orderDate,
    subtotalAmount: input.subtotalAmount,
    gstAmount: input.gstAmount,
    gstLabel: input.gstLabel,
    gstPercentage: input.gstPercentage,
    shippingAmount: input.shippingAmount,
    couponCode: input.couponCode,
    couponDiscountAmount: input.couponDiscountAmount,
    totalAmount: input.totalAmount,
    items: input.items,
    currency: input.currency,
  })

  await transporter.sendMail({
    from: emailFrom,
    to: input.customerEmail,
    subject: `Order confirmed: ${input.orderNumber}`,
    html,
  })
}

export async function sendOrderStatusUpdateEmail(input: OrderStatusUpdateInput) {
  const transporter = getTransporter()
  if (!transporter || !emailFrom || !input.customerEmail) return

  const customerName = input.customerName || 'Client'
  const statusLabel = input.status.replace(/_/g, ' ')
  const html = renderShell({
    pretitle: 'Order Status Update',
    title: `Your order is now ${statusLabel}`,
    body: `Hello ${customerName}, your House of Diams order has been updated. You can review the latest status in your account.`,
    badge: statusLabel,
    ctaLabel: 'View My Orders',
    ctaHref: `${siteUrl}/profile?tab=orders`,
    orderNumber: input.orderNumber,
    orderDate: input.orderDate,
    subtotalAmount: input.subtotalAmount,
    gstAmount: input.gstAmount,
    gstLabel: input.gstLabel,
    gstPercentage: input.gstPercentage,
    shippingAmount: input.shippingAmount,
    couponCode: input.couponCode,
    couponDiscountAmount: input.couponDiscountAmount,
    totalAmount: input.totalAmount,
    items: input.items,
    currency: input.currency,
  })

  await transporter.sendMail({
    from: emailFrom,
    to: input.customerEmail,
    subject: `Order update: ${input.orderNumber}`,
    html,
  })
}
