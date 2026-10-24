"use client";

import Breadcrumb from "./Breadcrumb";
import Badge from "./Badge";
import ButtonPrimary from "./ButtonPrimary";
import ButtonOutline from "./ButtonOutline";

export default function B2BHero() {
  return (
    <section
      className="pt-[100px] pb-[70px] px-5 sm:px-7 lg:px-[52px] text-center relative overflow-hidden"
      style={{
        background: "linear-gradient(180deg, #FAFBFD 0%, #F5F7FC 100%)",
      }}
    >
      <div className="max-w-[1100px] mx-auto">
        <div className="flex justify-center mb-5">
          <Breadcrumb
            items={[{ label: "Home", href: "/" }, { label: "B2B" }]}
          />
        </div>

        <div className="flex justify-center mb-6">
          <Badge>Wholesale & Supply</Badge>
        </div>

        <h1
          className="font-numeric font-light leading-[0.95] tracking-[-0.02em] text-[#0A1628] mb-6"
          style={{ fontSize: "clamp(46px, 7vw, 96px)" }}
        >
          B2B Diamonds.
          <br />
          Jewellery Supply.
        </h1>

        <p className="text-[13px] font-light leading-[2] text-[#292727] tracking-[0.06em] max-w-[720px] mx-auto mb-10">
          Lab-grown diamonds, consistent parcels, and fast global
          fulfillment from Surat. Built for retailers, designers, and wholesalers
          who need reliable quality at scale.
        </p>

        <div className="flex gap-[18px] justify-center flex-wrap max-md:flex-col max-md:w-full max-md:items-stretch">
          <ButtonPrimary href="#b2b-cta">
            Request Wholesale Catalogue
          </ButtonPrimary>
          <ButtonOutline href="https://wa.me/919328536178?text=Hi%2C%20I%27d%20like%20to%20enquire%20about%20B2B%20wholesale%20with%20House%20of%20Diams">
            WhatsApp Us
          </ButtonOutline>
        </div>
      </div>
    </section>
  );
}
