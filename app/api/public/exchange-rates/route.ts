import { NextResponse } from 'next/server'
import { CURRENCIES, normalizeCurrency, type SupportedCurrency } from '@/lib/currency'
import { getUsdExchangeRates } from '@/lib/exchange-rates'

// HOD-050: computed per request (rates are cached in memory for 30 minutes), so a
// build without the Fixer key no longer serves prerendered fallback rates.
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supportedCurrencies = CURRENCIES.map((currency) => normalizeCurrency(currency.code)) as SupportedCurrency[]
    const exchanges = await getUsdExchangeRates(supportedCurrencies)
    const sources = Object.fromEntries(
      supportedCurrencies.map((currencyCode) => [currencyCode, exchanges[currencyCode]?.source || 'fallback'])
    )
    const conversionAvailable = supportedCurrencies
      .filter((currencyCode) => currencyCode !== 'USD')
      .every((currencyCode) => exchanges[currencyCode]?.source === 'fixer')

    return NextResponse.json({
      rates: conversionAvailable
        ? Object.fromEntries(supportedCurrencies.map((currencyCode) => [currencyCode, exchanges[currencyCode]?.rate || 1]))
        : { USD: 1 },
      sources,
      conversionAvailable,
      fetchedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Public exchange rates lookup failed:', error)
    return NextResponse.json(
      {
        rates: { USD: 1 },
        fetchedAt: new Date().toISOString(),
        sources: { USD: 'fallback' },
        conversionAvailable: false,
      },
      { status: 200 }
    )
  }
}
