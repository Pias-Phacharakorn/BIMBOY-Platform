import { Icon } from "./Icon";

interface SearchBoxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchBox({ value, onChange, placeholder = "Search projects..." }: SearchBoxProps) {
  return (
    <label className="search-container" aria-label={placeholder}>
      <Icon name="FILTER" size={16} style={{ color: "var(--muted)" }} />
      <input
        className="search-input"
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
