import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Search } from 'lucide-react';

interface LibrarySearchInputProps {
  value: string;
  onDebouncedChange: (value: string) => void;
  isSearching?: boolean;
  debounceMs?: number;
}

export const LibrarySearchInput: React.FC<LibrarySearchInputProps> = React.memo(
  ({ value, onDebouncedChange, isSearching = false, debounceMs = 200 }) => {
    const [localValue, setLocalValue] = useState(value);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastEmittedRef = useRef(value);

    // Sync external resets (e.g., "সব দেখান" button) without overriding active typing
    useEffect(() => {
      if (value !== lastEmittedRef.current) {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        lastEmittedRef.current = value;
        setLocalValue(value);
      }
    }, [value]);

    useEffect(() => {
      return () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
      };
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value;
      setLocalValue(next);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        lastEmittedRef.current = next;
        onDebouncedChange(next);
      }, debounceMs);
    };

    const handleClear = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setLocalValue('');
      lastEmittedRef.current = '';
      onDebouncedChange('');
    };

    const showBusy = Boolean(localValue.trim()) && (isSearching || localValue !== value);

    return (
      <div className="relative flex-1">
        <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
        <input
          type="text"
          value={localValue}
          onChange={handleChange}
          placeholder="বাংলা বা ইংরেজিতে ওষুধ, জেনেরিক বা কোম্পানি লিখুন (যেমন: নাপা, Paracetamol)..."
          className="min-h-[48px] w-full bg-surface-2 border border-border rounded-xl pl-11 pr-36 py-2.5 text-base text-text placeholder:text-text-muted focus:outline-hidden focus:ring-2 focus:ring-primary font-medium"
          aria-label="ওষুধ খুঁজুন"
        />
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {showBusy && (
            <span
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary px-2 py-1 rounded-lg bg-primary-soft/80"
              role="status"
              aria-live="polite"
            >
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>খুঁজছি…</span>
            </span>
          )}
          {localValue && (
            <button
              type="button"
              onClick={handleClear}
              className="min-h-[40px] px-2.5 text-sm font-semibold text-text-muted hover:text-text cursor-pointer"
            >
              মুছুন
            </button>
          )}
        </div>
      </div>
    );
  }
);

LibrarySearchInput.displayName = 'LibrarySearchInput';
