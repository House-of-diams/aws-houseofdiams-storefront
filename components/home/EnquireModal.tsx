'use client';
import DataNotice from '@/components/consent/DataNotice'

import { useEffect, useState } from 'react';
import { useToast } from './Toast';

interface EnquireModalProps {
  open: boolean;
  piece?: string;
  onClose: () => void;
}

export default function EnquireModal({ open, piece = 'General Enquiry', onClose }: EnquireModalProps) {
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    message: '',
  });

  useEffect(() => {
    document.body.classList.toggle('modal-open', open);
    return () => document.body.classList.remove('modal-open');
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch('/api/public/contact/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          full_name: form.name,
          email: form.email,
          phone: form.phone,
          topic: `Product Enquiry: ${piece}`,
          message: form.message,
        }),
      });

      if (!response.ok) {
        throw new Error((await response.json().catch(() => null))?.error ?? 'Unable to submit enquiry.');
      }

      const text = `Hi, new enquiry from the website:\n\nPiece: ${piece}\nName: ${form.name}\nEmail: ${form.email}\nPhone: ${form.phone}\nMessage: ${form.message}`;
      window.open(`https://wa.me/919328536178?text=${encodeURIComponent(text)}`, '_blank');
      showToast("Enquiry sent — we'll reply within 24 hours");
      setForm({ name: '', email: '', phone: '', message: '' });
      setTimeout(onClose, 800);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to submit enquiry right now.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10,22,40,0.6)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 10002,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        overflowY: 'auto',
        overscrollBehavior: 'contain',
        WebkitOverflowScrolling: 'touch',
        touchAction: 'pan-y',
        animation: 'fadeUpModal 0.3s ease',
        fontFamily: 'var(--sans)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: '#fff',
          width: '100%',
          maxWidth: '540px',
          padding: '48px 44px',
          position: 'relative',
          maxHeight: '90vh',
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-y',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            border: '1px solid var(--border)',
            background: 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s',
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget;
            el.style.background = 'var(--ink)';
            el.style.borderColor = 'var(--ink)';
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget;
            el.style.background = 'transparent';
            el.style.borderColor = 'var(--border)';
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 1L13 13M13 1L1 13" stroke="var(--ink2)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        <div
          style={{
            fontSize: '10px',
            fontWeight: 400,
            letterSpacing: '0.3em',
            color: 'var(--theme-ink)',
            textTransform: 'uppercase',
            marginBottom: '12px',
          }}
        >
          {piece}
        </div>

        <h3
          style={{
            fontFamily: 'var(--serif)',
            fontSize: '32px',
            fontWeight: 400,
            color: 'var(--ink)',
            marginBottom: '8px',
            letterSpacing: '0.02em',
          }}
        >
          Request a <em style={{ fontStyle: 'normal', color: 'var(--theme-ink)' }}>Quote</em>
        </h3>

        <p
          style={{
            fontSize: '11px',
            color: 'var(--ink3)',
            letterSpacing: '0.04em',
            marginBottom: '28px',
            lineHeight: 1.8,
          }}
        >
          Tell us what you&apos;re looking for — our team responds within 24 hours.
        </p>

        <form onSubmit={handleSubmit}>
          <FormGroup label="Full Name" htmlFor="enquire-name">
            <input
              id="enquire-name"
              className="form-input"
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              style={inputStyle}
            />
          </FormGroup>

          <FormGroup label="Email" htmlFor="enquire-email">
            <input id="enquire-email" type="email" name="email" value={form.email} onChange={handleChange} required style={inputStyle} />
          </FormGroup>

          <FormGroup label="Phone / WhatsApp (Optional)" htmlFor="enquire-phone">
            <input id="enquire-phone" type="tel" name="phone" value={form.phone} onChange={handleChange} style={inputStyle} />
          </FormGroup>

          <FormGroup label="Your Message" htmlFor="enquire-message">
            <textarea
              id="enquire-message"
              name="message"
              value={form.message}
              onChange={handleChange}
              rows={3}
              required
              style={{ ...inputStyle, resize: 'vertical', minHeight: '100px' }}
            />
          </FormGroup>

          <DataNotice fields="name, contact details and message" purpose="respond to your enquiry about this piece" className="mb-3" />
          <button
            type="submit"
            disabled={submitting}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              fontSize: '10px',
              fontWeight: 400,
              letterSpacing: '0.28em',
              color: 'var(--bg)',
              background: 'var(--ink)',
              padding: '16px 34px',
              border: 'none',
              cursor: submitting ? 'wait' : 'pointer',
              textTransform: 'uppercase',
              width: '100%',
              marginTop: '10px',
              fontFamily: 'var(--sans)',
              transition: 'background 0.3s',
              opacity: submitting ? 0.72 : 1,
            }}
            onMouseEnter={(e) => {
              if (!submitting) (e.currentTarget as HTMLElement).style.background = 'var(--theme-ink)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'var(--ink)';
            }}
          >
            {submitting ? 'Submitting…' : 'Submit Enquiry'}
          </button>
        </form>
      </div>

      <style>{`
        @keyframes fadeUpModal {
          from { opacity: 0; transform-origin: center; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '14px 16px',
  fontFamily: 'var(--sans)',
  fontSize: '13px',
  fontWeight: 300,
  color: 'var(--ink)',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  transition: 'all 0.3s',
  letterSpacing: '0.02em',
  outline: 'none',
};

function FormGroup({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <label
        htmlFor={htmlFor}
        style={{
          display: 'block',
          fontSize: '9px',
          fontWeight: 400,
          letterSpacing: '0.28em',
          color: 'var(--ink3)',
          textTransform: 'uppercase',
          marginBottom: '8px',
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}
