"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { LogOut, ShoppingBag } from "lucide-react";
import { getCollectionHref } from "@/lib/browse-context";
import { formatUsd } from "@/lib/money";
import { formatMoney } from "@/lib/currency";
import WishlistClient from "@/components/pages/WishlistClient";

type Tab = "dashboard" | "account" | "orders" | "wishlist";
type Profile = Record<string, string>;
type Identity = { id: string; email: string; createdAt?: string | null };
type OrderItem = {
  product_name: string;
  quantity: number;
  line_total: number | null;
  selected_metal?: string | null;
  selected_purity?: string | null;
  selected_size_or_fit?: string | null;
  selected_gemstone?: string | null;
  selected_carat?: string | null;
};
type Order = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  total_amount: number | null;
  payment_amount?: number | null;
  payment_currency?: string | null;
  created_at: string;
  items: OrderItem[];
};

const BANNER = "/HOD%20specs/profile%20banner/wesfly-jzXYuYd-o00-unsplash.jpg";
const INPUT =
  "h-11 border border-[#b8b8b8] bg-white px-4 font-secondary text-[13px] text-[var(--theme-ink)] outline-none transition placeholder:text-[#4f5662] focus:border-[var(--theme-ink)]";
const FIELDS = [
  "first_name",
  "last_name",
  "phone",
  "birth_date",
  "anniversary_date",
  "country",
  "state",
  "district",
  "city",
  "postal_code",
  "address_line_1",
  "address_line_2",
] as const;
const TABS: Array<{ id: Tab; label: string }> = [
  { id: "dashboard", label: "Dashboard" },
  { id: "account", label: "Account Details" },
  { id: "orders", label: "Orders" },
  { id: "wishlist", label: "Wish List" },
];
const NAME = /^[\p{L}][\p{L}\p{M}' -]{0,79}$/u;
const PHONE = /^\+?[0-9(). -]{7,24}$/;
const parseTab = (value: string | null): Tab =>
  value === "account" || value === "orders" || value === "wishlist"
    ? value
    : "dashboard";

function friendlyDate(value: string | undefined) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
}
function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-center text-[clamp(1.35rem,2vw,1.75rem)] uppercase leading-none tracking-[0.04em] text-[#111111] font-bold!">
      {children}
    </h2>
  );
}
function BoxHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[16px] uppercase tracking-[0.06em] text-[#222222] font-bold!">
      {children}
    </h3>
  );
}
function Detail({
  label,
  value,
  onAdd,
}: {
  label: string;
  value?: string | null;
  onAdd?: () => void;
}) {
  return (
    <div>
      <p className="text-[13px] font-semibold text-[#222222]">{label}</p>
      {value ? (
        <p className="mt-1 break-words text-[13px] leading-[1.75] text-[#292727]">
          {value}
        </p>
      ) : onAdd ? (
        <button
          type="button"
          onClick={onAdd}
          className="mt-1 text-[13px] text-[#222222] underline underline-offset-4"
        >
          Add
        </button>
      ) : (
        <p className="mt-1 text-[13px] text-[#767676]">Not available</p>
      )}
    </div>
  );
}
function selection(metal?: string | null, purity?: string | null) {
  return !metal
    ? purity || ""
    : purity && !metal.toLowerCase().includes(purity.toLowerCase())
      ? `${purity} ${metal}`
      : metal;
}

export default function CustomerAccount({
  ordersEnabled = false,
}: {
  ordersEnabled?: boolean;
}) {
  const searchParams = useSearchParams();
  const [tab, setTabState] = useState<Tab>(() =>
    parseTab(searchParams.get("tab")),
  );
  const [loading, setLoading] = useState(true);
  const [signedOut, setSignedOut] = useState(false);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [profile, setProfile] = useState<Profile>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersPage, setOrdersPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");

  useEffect(
    () => setTabState(parseTab(searchParams.get("tab"))),
    [searchParams],
  );
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/customer-auth/profile", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 401) {
          setSignedOut(true);
          return;
        }
        const body = await response.json();
        if (!response.ok)
          throw new Error(body.error || "Unable to load your account.");
        setIdentity(body.identity);
        setProfile(
          Object.fromEntries(
            FIELDS.map((field) => [field, body.profile?.[field] || ""]),
          ),
        );
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load your account.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!ordersEnabled || !identity || tab !== "orders") return;
    const controller = new AbortController();
    setOrdersLoading(true);
    setOrdersError("");
    void fetch(`/api/profile/orders?page=${ordersPage}&pageSize=5`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok)
          throw new Error(body.error || "Unable to load your orders.");
        setOrders(Array.isArray(body.orders) ? body.orders : []);
        setTotalPages(Math.max(1, Number(body.pagination?.totalPages) || 1));
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setOrdersError(
            cause instanceof Error
              ? cause.message
              : "Unable to load your orders.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setOrdersLoading(false);
      });
    return () => controller.abort();
  }, [identity, ordersEnabled, ordersPage, tab]);

  const name =
    `${profile.first_name || ""} ${profile.last_name || ""}`.trim() ||
    identity?.email.split("@")[0] ||
    "Member";
  const address = useMemo(
    () =>
      [
        "address_line_1",
        "address_line_2",
        "city",
        "district",
        "state",
        "postal_code",
        "country",
      ]
        .map((key) => profile[key]?.trim())
        .filter(Boolean)
        .join(", "),
    [profile],
  );
  function setTab(next: Tab) {
    setTabState(next);
    if (next === "orders") setOrdersPage(1);
    window.history.replaceState(
      null,
      "",
      next === "dashboard" ? "/profile" : `/profile?tab=${next}`,
    );
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (
      !NAME.test((profile.first_name || "").trim()) ||
      !NAME.test((profile.last_name || "").trim())
    ) {
      setMessage("Enter valid first and last names.");
      return;
    }
    if (profile.phone && !PHONE.test(profile.phone.trim())) {
      setMessage("Enter a valid phone number.");
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    if (
      (profile.birth_date && profile.birth_date > today) ||
      (profile.anniversary_date && profile.anniversary_date > today)
    ) {
      setMessage("Dates cannot be in the future.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/customer-auth/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(profile),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || "Unable to save your profile.");
      setMessage("Profile and default checkout address saved.");
    } catch (cause) {
      setMessage(
        cause instanceof Error ? cause.message : "Unable to save your profile.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function signOut() {
    setSigningOut(true);
    try {
      const response = await fetch("/api/customer-auth/logout", {
        method: "POST",
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to sign out.");
      window.location.assign(body.redirect);
    } catch (cause) {
      setMessage(
        cause instanceof Error ? cause.message : "Unable to sign out.",
      );
      setSigningOut(false);
    }
  }
  const change =
    (key: string) => (event: React.ChangeEvent<HTMLInputElement>) =>
      setProfile((current) => ({ ...current, [key]: event.target.value }));

  if (loading || signedOut || error)
    return (
      <section className="min-h-[calc(100vh-111px)] bg-(--color-white) px-4 py-16 sm:px-7">
        <div className="mx-auto max-w-4xl border border-[#e4e4e4] bg-white px-6 py-12 text-center sm:px-10">
          <h1 className="text-[clamp(1.35rem,2vw,1.75rem)] uppercase tracking-[0.04em] text-[#111111] font-bold!">
            {signedOut
              ? "Sign in to view your account"
              : loading
                ? "Loading your account..."
                : "Your account is unavailable"}
          </h1>
          {signedOut || error ? (
            <>
              <p role="status" className="mt-4 text-[13px] text-[#292727]">
                {error ||
                  "Sign in to view your profile, orders, and wish list."}
              </p>
              <Link
                className="brand-button mt-8 inline-flex"
                href="/login?next=%2Fprofile"
                prefetch={false}
              >
                Sign In
              </Link>
            </>
          ) : null}
        </div>
      </section>
    );

  return (
    <section className="min-h-[calc(100vh-111px)] bg-(--color-white)">
      <div className="relative">
        <img
          src={BANNER}
          alt=""
          className="h-[240px] w-full object-cover object-center sm:h-[320px]"
        />
        <span
          className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent"
          aria-hidden="true"
        />
        <h1 className="absolute inset-x-0 bottom-7 px-4 text-center text-[clamp(1.5rem,2.4vw,1.875rem)] uppercase tracking-[0.04em] text-white font-bold! [text-shadow:0_1px_4px_rgba(0,0,0,0.8)]">
          Welcome, {name}
        </h1>
      </div>
      <div className="mx-auto max-w-6xl px-4 sm:px-7">
        <nav
          aria-label="Account sections"
          className="mt-8 flex items-center gap-6 overflow-x-auto border-b border-[#e4e4e4] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-8"
        >
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              aria-current={tab === item.id ? "page" : undefined}
              className={
                "shrink-0 border-b-2 pb-3 text-[14px] transition-colors " +
                (tab === item.id
                  ? "border-[#111111] font-semibold text-[#111111]"
                  : "border-transparent text-[#767676] hover:text-[#111111]")
              }
            >
              {item.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => void signOut()}
            disabled={signingOut}
            className="ml-auto inline-flex shrink-0 items-center gap-2 pb-3 text-[13px] text-[#767676] hover:text-[#111111] disabled:opacity-60"
          >
            <LogOut size={15} aria-hidden="true" />
            {signingOut ? "Signing Out..." : "Sign Out"}
          </button>
        </nav>
      </div>
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-7 sm:pb-24">
        {message ? (
          <p role="status" className="mb-5 text-[13px] text-[#292727]">
            {message}
          </p>
        ) : null}
        {tab === "dashboard" ? (
          <>
            <Heading>Dashboard</Heading>
            <div className="mt-8 border border-[#e4e4e4] bg-white px-6 py-6 sm:px-10 sm:py-8">
              <div className="flex items-center justify-between gap-4 border-b border-[#e4e4e4] pb-4">
                <BoxHeading>Account Details</BoxHeading>
                <button
                  type="button"
                  onClick={() => setTab("account")}
                  className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#222222] underline underline-offset-4"
                >
                  Edit
                </button>
              </div>
              <div className="mt-6 grid gap-6 sm:grid-cols-2">
                <Detail label="Name" value={name} />
                <Detail label="Email Address" value={identity?.email} />
                <Detail
                  label="Phone"
                  value={profile.phone}
                  onAdd={() => setTab("account")}
                />
                {identity?.createdAt ? (
                  <Detail
                    label="Member Since"
                    value={new Date(identity.createdAt).toLocaleDateString(
                      undefined,
                      { year: "numeric", month: "long", day: "numeric" },
                    )}
                  />
                ) : null}
                <Detail
                  label="Birth Date"
                  value={friendlyDate(profile.birth_date)}
                  onAdd={() => setTab("account")}
                />
                <Detail
                  label="Anniversary Date"
                  value={friendlyDate(profile.anniversary_date)}
                  onAdd={() => setTab("account")}
                />
                <div className="sm:col-span-2">
                  <Detail
                    label="Default Checkout Address"
                    value={address}
                    onAdd={() => setTab("account")}
                  />
                </div>
              </div>
            </div>
          </>
        ) : null}
        {tab === "account" ? (
          <>
            <Heading>Account Details</Heading>
            <div className="mt-8 border border-[#e4e4e4] bg-white px-6 py-6 sm:px-10 sm:py-8">
              <BoxHeading>Personal Information</BoxHeading>
              <form onSubmit={save} className="mt-6 grid gap-3 sm:grid-cols-2">
                <input
                  value={profile.first_name || ""}
                  onChange={change("first_name")}
                  type="text"
                  placeholder="First Name*"
                  aria-label="First name"
                  autoComplete="given-name"
                  maxLength={80}
                  required
                  className={INPUT}
                />
                <input
                  value={profile.last_name || ""}
                  onChange={change("last_name")}
                  type="text"
                  placeholder="Last Name*"
                  aria-label="Last name"
                  autoComplete="family-name"
                  maxLength={80}
                  required
                  className={INPUT}
                />
                <input
                  value={profile.phone || ""}
                  onChange={change("phone")}
                  type="tel"
                  placeholder="Phone"
                  aria-label="Phone"
                  autoComplete="tel"
                  inputMode="tel"
                  maxLength={24}
                  className={INPUT + " sm:col-span-2"}
                />
                <label className="grid gap-1.5 text-[12px] font-semibold text-[#222222]">
                  Birth Date{" "}
                  <span className="font-normal text-[#767676]">Optional</span>
                  <input
                    value={profile.birth_date || ""}
                    onChange={change("birth_date")}
                    type="date"
                    max={new Date().toISOString().slice(0, 10)}
                    className={INPUT}
                  />
                </label>
                <label className="grid gap-1.5 text-[12px] font-semibold text-[#222222]">
                  Anniversary Date{" "}
                  <span className="font-normal text-[#767676]">Optional</span>
                  <input
                    value={profile.anniversary_date || ""}
                    onChange={change("anniversary_date")}
                    type="date"
                    max={new Date().toISOString().slice(0, 10)}
                    className={INPUT}
                  />
                </label>
                <div className="mt-5 border-t border-[#e4e4e4] pt-6 sm:col-span-2">
                  <BoxHeading>Default Checkout Address</BoxHeading>
                  <p className="mt-2 text-[12px] leading-5 text-[#767676]">
                    Optional. Saved details will prefill checkout whenever you
                    are signed in.
                  </p>
                </div>
                {(
                  [
                    ["address_line_1", "Address Line 1", "address-line1"],
                    ["address_line_2", "Address Line 2", "address-line2"],
                    ["country", "Country", "country-name"],
                    ["state", "State / Province / Region", "address-level1"],
                    ["district", "District", "off"],
                    ["city", "City", "address-level2"],
                    ["postal_code", "Postal Code / Pincode", "postal-code"],
                  ] as const
                ).map(([key, label, autocomplete]) => (
                  <input
                    key={key}
                    value={profile[key] || ""}
                    onChange={change(key)}
                    type="text"
                    placeholder={label}
                    aria-label={label}
                    autoComplete={autocomplete}
                    maxLength={200}
                    className={
                      INPUT +
                      (key.startsWith("address_line") ? " sm:col-span-2" : "")
                    }
                  />
                ))}
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="brand-button"
                  >
                    {saving ? "Saving..." : "Save Profile"}
                  </button>
                </div>
              </form>
            </div>
            <div className="mt-6 border border-[#e4e4e4] bg-white px-6 py-6 sm:px-10 sm:py-8">
              <BoxHeading>Login Information</BoxHeading>
              <div className="mt-6 grid gap-6 sm:grid-cols-2">
                <Detail label="Email Address" value={identity?.email} />
                <div>
                  <p className="text-[13px] font-semibold text-[#222222]">
                    Password
                  </p>
                  <p className="mt-1 text-[13px] text-[#292727]">
                    Managed securely by House of Diams account service.
                  </p>
                  <Link
                    href="/api/customer-auth/start?flow=password&next=%2Fprofile"
                    prefetch={false}
                    className="mt-2 inline-block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#222222] underline underline-offset-4"
                  >
                    Change Password
                  </Link>
                </div>
              </div>
            </div>
          </>
        ) : null}
        {tab === "orders" ? (
          <>
            <Heading>Orders</Heading>
            <div className="mt-8">
              {!ordersEnabled ? (
                <div className="border border-[#e4e4e4] bg-white px-6 py-12 text-center text-[13px] text-[#292727]">
                  Order history is temporarily unavailable.
                </div>
              ) : ordersLoading ? (
                <div className="border border-[#e4e4e4] bg-white px-6 py-12 text-center text-[13px] text-[#292727]">
                  Loading your orders...
                </div>
              ) : ordersError ? (
                <div
                  role="alert"
                  className="border border-[#e4e4e4] bg-white px-6 py-12 text-center text-[13px] text-[#8f2f2f]"
                >
                  {ordersError}
                </div>
              ) : orders.length === 0 ? (
                <div className="border border-[#e4e4e4] bg-white px-6 py-12 text-center">
                  <ShoppingBag
                    size={22}
                    strokeWidth={1.5}
                    className="mx-auto text-[#222222]"
                    aria-hidden="true"
                  />
                  <p className="mt-4 text-[13px] text-[#292727]">
                    You have no orders yet.
                  </p>
                  <Link
                    href={getCollectionHref()}
                    className="mt-5 inline-block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#222222] underline underline-offset-4"
                  >
                    Shop The Collection
                  </Link>
                </div>
              ) : (
                <>
                  <div className="grid gap-4">
                    {orders.map((order) => (
                      <article
                        key={order.id}
                        className="border border-[#e4e4e4] bg-white px-6 py-5"
                      >
                        <div className="flex flex-col gap-4 border-b border-[#e4e4e4] pb-4 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-[13px] font-semibold text-[#222222]">
                              {order.order_number}
                            </p>
                            <p className="mt-1 text-[12px] text-[#292727]">
                              {order.created_at
                                ? new Date(order.created_at).toLocaleDateString(
                                    undefined,
                                    {
                                      year: "numeric",
                                      month: "long",
                                      day: "numeric",
                                    },
                                  )
                                : ""}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-start gap-6">
                            {(
                              [
                                ["Status", order.status],
                                ["Payment", order.payment_status],
                              ] as const
                            ).map(([label, value]) => (
                              <div key={label}>
                                <p className="text-[11px] uppercase tracking-[0.08em] text-[#767676]">
                                  {label}
                                </p>
                                <p className="mt-1 text-[13px] font-semibold capitalize text-[#222222]">
                                  {value || "Pending"}
                                </p>
                              </div>
                            ))}
                            <div>
                              <p className="text-[11px] uppercase tracking-[0.08em] text-[#767676]">
                                Total (USD)
                              </p>
                              <p className="mt-1 text-[13px] font-semibold text-[#222222]">
                                {order.total_amount == null
                                  ? "—"
                                  : formatUsd(order.total_amount)}
                              </p>
                              {order.payment_amount != null && order.payment_currency ? (
                                <p className="mt-1 text-[11px] text-[#767676]">
                                  Charged: {formatMoney(order.payment_amount, order.payment_currency)} {order.payment_currency}
                                </p>
                              ) : null}
                            </div>
                            <Link
                              href={`/checkout/success?order=${encodeURIComponent(order.order_number)}`}
                              className="inline-flex h-9 items-center border border-black bg-black px-4 font-[family-name:var(--font-family-button)] text-[10px] font-semibold uppercase tracking-[0.1em] text-white no-underline transition hover:bg-white hover:text-black"
                            >
                              View Order
                            </Link>
                          </div>
                        </div>
                        <div className="divide-y divide-[#e4e4e4]">
                          {(order.items || []).map((item, index) => (
                            <div
                              key={`${order.id}-${index}`}
                              className="flex items-start justify-between gap-4 py-4"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[13px] font-semibold text-[#222222]">
                                  {item.product_name}
                                </p>
                                <p className="mt-1 text-[12px] uppercase tracking-[0.08em] text-[#767676]">
                                  Qty {item.quantity}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-[#292727]">
                                  {selection(
                                    item.selected_metal,
                                    item.selected_purity,
                                  ) ? (
                                    <span>
                                      Metal:{" "}
                                      {selection(
                                        item.selected_metal,
                                        item.selected_purity,
                                      )}
                                    </span>
                                  ) : null}
                                  {item.selected_size_or_fit ? (
                                    <span>
                                      Size/Fit: {item.selected_size_or_fit}
                                    </span>
                                  ) : null}
                                  {item.selected_gemstone ? (
                                    <span>Stone: {item.selected_gemstone}</span>
                                  ) : null}
                                  {item.selected_carat ? (
                                    <span>Carat: {item.selected_carat}</span>
                                  ) : null}
                                </div>
                              </div>
                              <p className="shrink-0 text-[13px] font-semibold text-[#222222]">
                                {item.line_total == null
                                  ? "—"
                                  : formatUsd(item.line_total)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>
                  <div className="mt-6 flex flex-col gap-3 border-t border-[#e4e4e4] pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-[13px] text-[#292727]">
                      Page {ordersPage} of {totalPages}
                    </p>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          setOrdersPage((page) => Math.max(1, page - 1))
                        }
                        disabled={ordersPage <= 1}
                        className="brand-button"
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setOrdersPage((page) =>
                            Math.min(totalPages, page + 1),
                          )
                        }
                        disabled={ordersPage >= totalPages}
                        className="brand-button"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        ) : null}
        {tab === "wishlist" ? (
          <>
            <Heading>Wish List</Heading>
            <div className="mt-8">
              <WishlistClient embedded />
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
