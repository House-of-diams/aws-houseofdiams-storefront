"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { MaterialIcon, getMaterialParts } from "@/components/product/ConfiguratorMaterialButtons";

function Chevron({ open }) {
  return <svg width="16" height="10" viewBox="0 0 16 10" fill="none" aria-hidden="true" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s ease" }}><path d="m1 1 7 7 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export default function CategoryQuickFilters({ metalOptions, shapeOptions, selectedMetal, selectedShape, onChange }) {
  const [openPanel, setOpenPanel] = useState(null);
  const rootRef = useRef(null);

  useEffect(() => {
    const closeOnOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpenPanel(null);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpenPanel(null);
    };
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const selectedMetalLabel = metalOptions.find((option) => option.value === selectedMetal)?.label;
  const selectedShapeLabel = shapeOptions.find((option) => option.value === selectedShape)?.label;

  const trigger = (id, label, selectedLabel) => (
    <button
      type="button"
      className="category-filter-trigger"
      onClick={() => setOpenPanel((current) => current === id ? null : id)}
      aria-expanded={openPanel === id}
      aria-controls={`category-${id}-panel`}
    >
      <span className="category-filter-trigger-label">{selectedLabel || label}</span><Chevron open={openPanel === id} />
    </button>
  );

  return (
    <div className="category-quick-filters" ref={rootRef}>
      <style>{`
        .category-quick-filters { position: relative; display: flex; gap: 10px; z-index: 30; }
        .category-filter-trigger { min-width: 138px; height: 42px; padding: 0 20px; border: 1px solid rgba(10,22,40,.14); border-radius: 0; background: #fff; color: #0A1628; display:flex; align-items:center; justify-content:space-between; gap:18px; font-family:var(--font-family-montserrat); font-size:12px; font-weight:600; letter-spacing:.08em; text-transform:uppercase; cursor:pointer; }
        .category-filter-trigger-label { min-width:0; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; text-align:left; }
        .category-filter-trigger svg { flex:none; }
        .category-filter-trigger:focus-visible { outline: 2px solid #0A1628; outline-offset: 2px; }
        .category-filter-panel { position:absolute; left:0; top:62px; width:min(420px, calc(100vw - 20px)); max-height:min(520px, 70vh); overflow:auto; padding:28px; border:1px solid rgba(10,22,40,.07); border-radius:0; background:#fff; box-shadow:0 22px 60px rgba(10,22,40,.16); }
        .category-filter-panel h3 { margin:0 0 22px; color:#0A1628; font-family:var(--font-family-montserrat); font-size:20px; font-weight:600; }
        .category-filter-options { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
        .category-filter-option { min-width:0; height:102px; padding:8px 4px; border:1px solid #D7D9DC; border-radius:0; background:#fff; color:#0A1628; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:5px; cursor:pointer; transition:border-color .18s ease, background .18s ease, transform .18s ease; }
        .category-filter-option:hover { background:#F7F8FA; transform:translateY(-1px); }
        .category-filter-option[aria-pressed="true"] { border:2px solid #0A1628; background:#F7F8FA; }
        .category-filter-option-icon { width:46px; height:46px; display:flex; align-items:center; justify-content:center; position:relative; }
        .category-filter-option-label { font-family:var(--font-family-montserrat); font-size:12px; font-weight:600; line-height:1.15; text-align:center; }
        @media(max-width:768px){
          .category-quick-filters { width:100%; gap:8px; }
          .category-filter-trigger { flex:1; min-width:0; height:40px; padding:0 12px; gap:8px; font-size:11px; }
          .category-filter-panel { top:54px; padding:20px; border-radius:0; }
          .category-filter-panel h3 { font-size:20px; margin-bottom:16px; }
          .category-filter-options { gap:9px; }
          .category-filter-option { height:91px; }
          .category-filter-option-icon { width:40px; height:40px; }
          .category-filter-option-label { font-size:11px; }
        }
      `}</style>
      {trigger("metal", "Metal", selectedMetalLabel)}
      {trigger("shape", "Shape", selectedShapeLabel)}

      {openPanel === "metal" && (
        <section id="category-metal-panel" className="category-filter-panel" aria-label="Select Metal">
          <h3>Select Metal</h3>
          <div className="category-filter-options">
            {metalOptions.map((option, index) => {
              const active = selectedMetal === option.value;
              return <button key={option.value} type="button" className="category-filter-option" aria-pressed={active} aria-label={`${active ? "Clear" : "Select"} ${option.label}`} onClick={() => { onChange("metal", active ? "" : option.value); setOpenPanel(null); }}>
                <span className="category-filter-option-icon"><MaterialIcon label={option.label} color={option.color} id={`grid-${index}-${option.value}`.replace(/[^a-zA-Z0-9_-]/g, "")} /></span>
                <span className="category-filter-option-label">{getMaterialParts(option.label, option.color).baseName}</span>
              </button>;
            })}
          </div>
        </section>
      )}

      {openPanel === "shape" && (
        <section id="category-shape-panel" className="category-filter-panel" aria-label="Select Shape">
          <h3>Select Shape</h3>
          <div className="category-filter-options">
            {shapeOptions.map((option) => {
              const active = selectedShape === option.value;
              return <button key={option.value} type="button" className="category-filter-option" aria-pressed={active} aria-label={`${active ? "Clear" : "Select"} ${option.label}`} onClick={() => { onChange("shape", active ? "" : option.value); setOpenPanel(null); }}>
                <span className="category-filter-option-icon">{option.iconUrl ? <Image src={option.iconUrl} alt="" fill sizes="46px" style={{ objectFit:"contain" }} /> : <span style={{ width:32, height:32, border:"1px solid #0A1628", borderRadius: option.value.includes("round") ? "50%" : "8px", transform: option.value.includes("princess") ? "rotate(45deg) scale(.72)" : "none" }} />}</span>
                <span className="category-filter-option-label">{option.label}</span>
              </button>;
            })}
          </div>
        </section>
      )}
    </div>
  );
}
