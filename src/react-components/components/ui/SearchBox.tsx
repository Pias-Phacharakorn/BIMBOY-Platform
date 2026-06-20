import { Icon } from "./Icon";

interface SearchBoxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchBox({ value, onChange, placeholder = "Search projects..." }: SearchBoxProps) {
  return (
    <label className="flex items-center bg-surface-alt border border-border rounded-radius px-3 w-[min(400px,34vw)] min-w-[220px] gap-2" aria-label={placeholder}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted shrink-0">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        className="bg-transparent border-none text-fg p-2 w-full outline-none placeholder-muted-2 font-ui text-sm"
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

