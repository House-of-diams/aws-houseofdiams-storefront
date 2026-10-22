'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Gift, Minus, PackageCheck, Plus, RefreshCcw, X } from 'lucide-react'
import { useCart } from '@/lib/hooks/useCart'
import { MAX_CART_QUANTITY } from '@/lib/cart-limits'
import { useCurrency } from '@/context/CurrencyContext'
import { getProductKey, type CartProductSnapshot } from '@/lib/product-keys'

type SearchProduct = CartProductSnapshot

function selectedDetails(selection: ReturnType<typeof useCart>['items'][number]['selection']) {
  const values = [
    selection.metal,
    selection.purity,
    selection.sizeOrFit || selection.ringSize,
    selection.gemstone,
    selection.shape,
    selection.hiphopCarat ? `${selection.hiphopCarat} ct` : '',
  ].filter(Boolean)

  return values.join(', ')
}

export default function CartDrawer() {
  const { items, count, isHydrated, isOpen, closeCart, updateQuantity, removeItem } = useCart()
  const { format } = useCurrency()
  const [products, setProducts] = useState<SearchProduct[]>([])
  const panelRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!isHydrated) return
    const legacy = items.filter((item) => !item.snapshot)
    if (!legacy.length) return

    let ignore = false
    void fetch('/api/public/products/cart', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        slugs: legacy.map((item) => item.productSlug).filter(Boolean),
        ids: legacy.map((item) => item.productKey).filter(Boolean),
      }),
    })
      .then((response) => response.json().then((payload) => ({ ok: response.ok, payload })))
      .then(({ ok, payload }) => {
        if (!ignore && ok && Array.isArray(payload?.items)) setProducts(payload.items)
      })
      .catch(() => {})

    return () => {
      ignore = true
    }
  }, [isHydrated, items])

  const resolvedItems = useMemo(
    () =>
      items
        .map((item) => ({
          item,
          product:
            item.snapshot ||
            products.find((product) => getProductKey(product) === item.productKey || product.slug === item.productSlug),
        }))
        .filter((entry): entry is { item: typeof items[number]; product: SearchProduct } => Boolean(entry.product)),
    [items, products]
  )

  const subtotal = resolvedItems.reduce(
    (sum, { item, product }) =>
      sum + Number(item.selection.resolvedPrice ?? product.priceFrom ?? 0) * item.quantity,
    0
  )

  useEffect(() => {
    if (!isOpen) return
    window.dispatchEvent(new Event('hod:close-contact'))

    const previousBodyOverflow = document.body.style.overflow
    const previousHtmlOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'

    window.requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLElement>('[data-cart-close]')?.focus()
    })

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeCart()
        return
      }

      if (event.key !== 'Tab' || !panelRef.current) return
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      )
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousHtmlOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [closeCart, isOpen])

  return (
    <div
      className={`fixed inset-0 z-[3000] transition-[visibility] duration-300 ${isOpen ? 'visible' : 'invisible'}`}
      aria-hidden={!isOpen}
    >
      <button
        type="button"
        aria-label="Close cart"
        tabIndex={isOpen ? 0 : -1}
        onClick={closeCart}
        className={`absolute inset-0 h-full w-full border-0 bg-black/25 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      />

      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-drawer-title"
        className={`absolute inset-y-0 right-0 flex w-full max-w-[540px] flex-col bg-white text-[#111] shadow-[-16px_0_42px_rgba(0,0,0,0.16)] transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ fontFamily: 'var(--font-family-inter)' }}
      >
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-black/15 px-4 sm:px-5">
          <div className="flex items-center gap-2.5">
            <div id="cart-drawer-title" role="heading" aria-level={2} className="m-0 font-[family-name:var(--font-family-montserrat)] text-[16px] font-bold uppercase tracking-[0.04em] text-black">
              Your Bag
            </div>
            <span className="bg-[#F4F4F4] px-2 py-1 text-[10px] text-black/60">
              {count} {count === 1 ? 'item' : 'items'}
            </span>
          </div>
          <button
            data-cart-close
            type="button"
            onClick={closeCart}
            aria-label="Close cart"
            className="flex h-9 w-9 items-center justify-center border-0 bg-transparent text-black transition-colors hover:bg-black hover:text-white"
          >
            <X size={19} strokeWidth={1.4} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {!isHydrated ? (
            <div className="space-y-3 p-4" aria-label="Loading cart">
              <div className="h-32 animate-pulse bg-[#F4F4F4]" />
              <div className="h-32 animate-pulse bg-[#F4F4F4]" />
            </div>
          ) : resolvedItems.length ? (
            <>
              <div className="px-4 py-3 text-[11px] text-black/65 sm:px-5">Delivery</div>
              <div className="divide-y divide-black/10 px-4 sm:px-5">
                {resolvedItems.map(({ item, product }) => {
                  const imageUrl = item.selection.resolvedImageUrl || product.imageUrl
                  const details = selectedDetails(item.selection)
                  const unitPrice = Number(item.selection.resolvedPrice ?? product.priceFrom ?? 0)

                  return (
                    <article key={item.key} className="grid grid-cols-[112px_minmax(0,1fr)] gap-4 py-5">
                      <Link href={`/shop/${product.slug}`} onClick={closeCart} className="relative block aspect-[4/5] overflow-hidden bg-[#F6F6F6]">
                        {imageUrl ? <img src={imageUrl} alt={product.name} className="absolute inset-0 h-full w-full object-cover" /> : null}
                      </Link>

                      <div className="flex min-w-0 flex-col">
                        <div className="flex items-start justify-between gap-3">
                          <Link href={`/shop/${product.slug}`} onClick={closeCart} className="min-w-0 font-[family-name:var(--font-family-montserrat)] text-[14px] font-semibold leading-[1.4] text-black no-underline">
                            {product.name}
                          </Link>
                          <span className="shrink-0 text-[12px] font-semibold">{format(unitPrice)}</span>
                        </div>

                        <p className="mt-1 text-[13px] leading-[1.5] text-black">
                          {details || product.shortMeta}
                        </p>

                        <div className="mt-auto flex items-end justify-between gap-3 pt-3">
                          <button
                            type="button"
                            onClick={() => removeItem(item.key)}
                            className="border-0 bg-transparent p-0 text-[11px] text-black underline underline-offset-2 hover:text-black"
                          >
                            Remove
                          </button>

                          <div className="grid h-8 grid-cols-[30px_34px_30px] border border-black/25" aria-label={`Quantity for ${product.name}`}>
                            <button type="button" onClick={() => updateQuantity(item.key, item.quantity - 1)} aria-label="Decrease quantity" className="flex items-center justify-center border-0 bg-white hover:bg-black hover:text-white">
                              <Minus size={12} strokeWidth={1.5} />
                            </button>
                            <span className="flex items-center justify-center border-x border-black/15 text-[11px]">{item.quantity}</span>
                            <button type="button" onClick={() => updateQuantity(item.key, item.quantity + 1)} aria-label="Increase quantity" disabled={item.quantity >= MAX_CART_QUANTITY} title={item.quantity >= MAX_CART_QUANTITY ? `Maximum ${MAX_CART_QUANTITY} per item` : undefined} className="disabled:cursor-not-allowed disabled:opacity-40 flex items-center justify-center border-0 bg-white hover:bg-black hover:text-white">
                              <Plus size={12} strokeWidth={1.5} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            </>
          ) : (
            <div className="flex min-h-[320px] flex-col items-center justify-center px-8 text-center">
              <h3 className="font-[family-name:var(--font-family-montserrat)] text-[17px] font-semibold uppercase">Your bag is empty</h3>
              <p className="mt-2 max-w-[260px] text-[12px] leading-5 text-black/60">Discover pieces made to become part of your story.</p>
              <Link href="/shop" onClick={closeCart} className="mt-6 inline-flex h-11 items-center justify-center bg-black px-7 font-[family-name:var(--font-family-montserrat)] text-[10px] font-semibold uppercase tracking-[0.08em] text-white no-underline">
                Explore Products
              </Link>
            </div>
          )}
        </div>

        <footer className="shrink-0 border-t border-black/15 bg-white px-4 pb-4 pt-3 sm:px-5">
          <div className="flex items-center justify-between font-[family-name:var(--font-family-montserrat)] text-[14px] font-semibold">
            <span>Total</span>
            <span>{format(subtotal)}</span>
          </div>

          <div className="mt-3 grid gap-2">
            <Link href="/cart" onClick={closeCart} className="flex h-11 items-center justify-center border border-black bg-white font-[family-name:var(--font-family-montserrat)] text-[10px] font-semibold uppercase tracking-[0.08em] text-black no-underline">
              View Cart
            </Link>
            <Link href="/checkout?mode=cart" onClick={closeCart} className="flex h-11 items-center justify-center border border-black bg-black font-[family-name:var(--font-family-montserrat)] text-[10px] font-semibold uppercase tracking-[0.08em] text-white no-underline transition hover:bg-white hover:text-black">
              Checkout
            </Link>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-black/10 pt-4 text-center">
            <div className="flex flex-col items-center gap-1.5">
              <PackageCheck size={21} strokeWidth={1.25} />
              <span className="text-[9px] leading-[1.25]">Complimentary<br />Insured Shipping</span>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <RefreshCcw size={20} strokeWidth={1.25} />
              <span className="text-[9px] leading-[1.25]">Complimentary<br />15-Day Returns</span>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <Gift size={20} strokeWidth={1.25} />
              <span className="text-[9px] leading-[1.25]">Signature<br />Gift Packaging</span>
            </div>
          </div>
        </footer>
      </aside>
    </div>
  )
}
