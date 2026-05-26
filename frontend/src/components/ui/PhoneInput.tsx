'use client';
import { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';

// ── Country data ──────────────────────────────────────────────────────────────

interface Country {
  code: string;
  name: string;
  dial: string;
  flag: string;
}

/** East African countries appear first, then rest of Africa, then international. */
const COUNTRIES: Country[] = [
  // ── East Africa ────────────────────────────────────────────────────────────
  { code: 'KE', name: 'Kenya',           dial: '+254', flag: '🇰🇪' },
  { code: 'TZ', name: 'Tanzania',        dial: '+255', flag: '🇹🇿' },
  { code: 'UG', name: 'Uganda',          dial: '+256', flag: '🇺🇬' },
  { code: 'RW', name: 'Rwanda',          dial: '+250', flag: '🇷🇼' },
  { code: 'ET', name: 'Ethiopia',        dial: '+251', flag: '🇪🇹' },
  { code: 'SS', name: 'South Sudan',     dial: '+211', flag: '🇸🇸' },
  { code: 'BI', name: 'Burundi',         dial: '+257', flag: '🇧🇮' },
  { code: 'DJ', name: 'Djibouti',        dial: '+253', flag: '🇩🇯' },
  { code: 'ER', name: 'Eritrea',         dial: '+291', flag: '🇪🇷' },
  { code: 'SO', name: 'Somalia',         dial: '+252', flag: '🇸🇴' },
  // ── Rest of Africa ─────────────────────────────────────────────────────────
  { code: 'NG', name: 'Nigeria',         dial: '+234', flag: '🇳🇬' },
  { code: 'GH', name: 'Ghana',           dial: '+233', flag: '🇬🇭' },
  { code: 'ZA', name: 'South Africa',    dial: '+27',  flag: '🇿🇦' },
  { code: 'EG', name: 'Egypt',           dial: '+20',  flag: '🇪🇬' },
  { code: 'MA', name: 'Morocco',         dial: '+212', flag: '🇲🇦' },
  { code: 'SD', name: 'Sudan',           dial: '+249', flag: '🇸🇩' },
  { code: 'ZM', name: 'Zambia',          dial: '+260', flag: '🇿🇲' },
  { code: 'ZW', name: 'Zimbabwe',        dial: '+263', flag: '🇿🇼' },
  { code: 'AO', name: 'Angola',          dial: '+244', flag: '🇦🇴' },
  { code: 'CM', name: 'Cameroon',        dial: '+237', flag: '🇨🇲' },
  { code: 'SN', name: 'Senegal',         dial: '+221', flag: '🇸🇳' },
  { code: 'CI', name: "Côte d'Ivoire",   dial: '+225', flag: '🇨🇮' },
  { code: 'MZ', name: 'Mozambique',      dial: '+258', flag: '🇲🇿' },
  { code: 'CD', name: 'DR Congo',        dial: '+243', flag: '🇨🇩' },
  { code: 'TN', name: 'Tunisia',         dial: '+216', flag: '🇹🇳' },
  { code: 'DZ', name: 'Algeria',         dial: '+213', flag: '🇩🇿' },
  { code: 'TZ', name: 'Tanzania',        dial: '+255', flag: '🇹🇿' },
  // ── International ──────────────────────────────────────────────────────────
  { code: 'US', name: 'United States',   dial: '+1',   flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom',  dial: '+44',  flag: '🇬🇧' },
  { code: 'AE', name: 'UAE',             dial: '+971', flag: '🇦🇪' },
  { code: 'IN', name: 'India',           dial: '+91',  flag: '🇮🇳' },
  { code: 'CN', name: 'China',           dial: '+86',  flag: '🇨🇳' },
  { code: 'DE', name: 'Germany',         dial: '+49',  flag: '🇩🇪' },
  { code: 'FR', name: 'France',          dial: '+33',  flag: '🇫🇷' },
  { code: 'AU', name: 'Australia',       dial: '+61',  flag: '🇦🇺' },
  { code: 'CA', name: 'Canada',          dial: '+1',   flag: '🇨🇦' },
  { code: 'SA', name: 'Saudi Arabia',    dial: '+966', flag: '🇸🇦' },
  { code: 'ZA', name: 'South Africa',    dial: '+27',  flag: '🇿🇦' },
].filter((v, i, a) => a.findIndex(t => t.code === v.code) === i); // deduplicate

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Split a stored full phone string ("+254712345678") into { dialCode, local }. */
function parsePhone(value: string): { dialCode: string; local: string } {
  if (!value) return { dialCode: '+254', local: '' };
  // Try longest dial codes first to avoid "+1" matching "+12…"
  const sorted = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
  for (const c of sorted) {
    if (value.startsWith(c.dial)) {
      return { dialCode: c.dial, local: value.slice(c.dial.length) };
    }
  }
  // No match — treat raw value as local part, default to Kenya
  return { dialCode: '+254', local: value.replace(/^\+/, '') };
}

// ── Component ─────────────────────────────────────────────────────────────────

interface PhoneInputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  placeholder?: string;
}

export function PhoneInput({
  label,
  value,
  onChange,
  onBlur,
  error,
  placeholder = '712 345 678',
}: PhoneInputProps) {
  const parsed              = parsePhone(value);
  const [dialCode, setDialCode] = useState(parsed.dialCode);
  const [local,    setLocal]    = useState(parsed.local);
  const [open,     setOpen]     = useState(false);
  const wrapperRef              = useRef<HTMLDivElement>(null);

  // Sync when the parent resets or opens with an existing value
  useEffect(() => {
    const p = parsePhone(value);
    setDialCode(p.dialCode);
    setLocal(p.local);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const selected = COUNTRIES.find(c => c.dial === dialCode) ?? COUNTRIES[0];

  const selectCountry = (dial: string) => {
    setDialCode(dial);
    setOpen(false);
    onChange(dial + local);
  };

  const handleLocalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/[^\d\s\-()]/g, ''); // digits + formatting chars only
    setLocal(v);
    onChange(dialCode + v);
  };

  // East Africa / Africa / International separator indices
  const EA_END   = 10; // index after last East African entry
  const AFR_END  = 26; // index after last African entry

  return (
    <div className="flex flex-col gap-1" ref={wrapperRef}>
      {label && (
        <label className="text-sm font-medium text-gray-700">{label}</label>
      )}

      <div
        className={`flex rounded-lg border shadow-sm transition-colors focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-primary-500 ${
          error ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'
        }`}
      >
        {/* ── Country selector ── */}
        <div className="relative flex-shrink-0">
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            className={`flex items-center gap-1.5 h-full px-3 py-2 text-sm rounded-l-lg border-r transition-colors ${
              error ? 'border-red-300 bg-red-50 hover:bg-red-100' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
            }`}
          >
            <span className="text-base leading-none">{selected.flag}</span>
            <span className="text-gray-600 font-mono text-xs tracking-tight">{dialCode}</span>
            <ChevronDown
              size={11}
              className={`text-gray-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
            />
          </button>

          {/* Dropdown */}
          {open && (
            <div className="absolute top-full left-0 z-50 mt-1 w-64 max-h-72 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl">
              {COUNTRIES.map((c, i) => (
                <div key={`${c.code}-${c.dial}`}>
                  {/* Section dividers */}
                  {i === EA_END  && <div className="h-px bg-gray-100 my-1" />}
                  {i === AFR_END && <div className="h-px bg-gray-100 my-1" />}

                  <button
                    type="button"
                    onClick={() => selectCountry(c.dial)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors ${
                      c.dial === dialCode
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-base leading-none flex-shrink-0">{c.flag}</span>
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="text-xs text-gray-400 font-mono flex-shrink-0">{c.dial}</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Number input ── */}
        <input
          type="tel"
          value={local}
          onChange={handleLocalChange}
          onBlur={onBlur}
          placeholder={placeholder}
          className={`flex-1 px-3 py-2 text-sm rounded-r-lg focus:outline-none min-w-0 ${
            error ? 'bg-red-50' : 'bg-white'
          }`}
        />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
