"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { searchCities, City } from "@/app/actions/atlas";
import { THEME, type Tone } from "@/app/_components/ui/theme";

interface Props {
  onSelect: (city: City) => void;
  placeholder?: string;
  /** "dark" on the public /natal page, "light" in the dashboard. */
  tone?: Tone;
}

export function CityAutocomplete({ onSelect, placeholder = "Search city…", tone = "light" }: Props) {
  const theme = THEME[tone];
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<City[]>([]);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(-1);
  const [, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) { setResults([]); setOpen(false); return; }
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const cities = await searchCities(q);
        setResults(cities);
        setOpen(cities.length > 0);
        setFocused(-1);
      });
    }, 250);
  }, []);

  useEffect(() => { search(query); }, [query, search]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const select = (city: City) => {
    setQuery(city.name + (city.country ? `, ${city.country}` : ""));
    setOpen(false);
    onSelect(city);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setFocused(f => Math.min(f + 1, results.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setFocused(f => Math.max(f - 1, 0)); }
    if (e.key === "Enter" && focused >= 0) { e.preventDefault(); select(results[focused]); }
    if (e.key === "Escape") setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={handleKey}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
        className={theme.input}
      />
      {open && (
        <ul className={`absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg ${theme.dropdown}`}>
          {results.map((city, i) => (
            <li
              key={city.id}
              onMouseDown={() => select(city)}
              className={`flex cursor-pointer items-center justify-between px-3 py-2 text-sm ${
                i === focused ? theme.dropdownItemActive : theme.dropdownItem
              }`}
            >
              <span>
                <span className="font-medium">{city.name}</span>
                {city.region && <span className={`ml-1 text-xs ${theme.muted}`}>{city.region}</span>}
              </span>
              <span className={`ml-2 shrink-0 text-xs ${theme.muted}`}>{city.country}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
