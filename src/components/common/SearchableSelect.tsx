import React, { useState, useEffect, useRef, useMemo, memo } from "react";

interface SearchableSelectProps<T extends { id: number; name: string }> {
  value: number | null;
  onChange: (value: number | null) => void;
  options: T[];
  placeholder: string;
  label: string;
  allOptionLabel: string;
}

/**
 * Searchable Select Component
 */
function SearchableSelectComponent<T extends { id: number; name: string }>({
  value,
  onChange,
  options,
  placeholder,
  label,
  allOptionLabel,
}: SearchableSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter options based on search term
  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    const term = searchTerm.toLowerCase();
    return options.filter((option) => option.name.toLowerCase().includes(term));
  }, [options, searchTerm]);

  // Get all options including "All" option
  const allOptions = useMemo(() => {
    return [{ id: null, name: allOptionLabel } as unknown as T & { id: number | null }, ...filteredOptions];
  }, [filteredOptions, allOptionLabel]);

  // Get selected option name
  const selectedOption = options.find((opt) => opt.id === value);
  const displayValue = selectedOption ? selectedOption.name : "";

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm("");
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reset search and highlight when dropdown closes
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm("");
      setHighlightedIndex(-1);
    }
  }, [isOpen]);

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Reset highlighted index when search term changes
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [searchTerm]);

  // Scroll highlighted option into view
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && dropdownRef.current) {
      const optionElement = dropdownRef.current.children[highlightedIndex] as HTMLElement;
      if (optionElement) {
        optionElement.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [highlightedIndex, isOpen]);

  const handleSelect = (optionId: number | null) => {
    onChange(optionId);
    setIsOpen(false);
    setSearchTerm("");
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && (e.key === "ArrowDown" || e.key === "Enter")) {
      setIsOpen(true);
      return;
    }

    if (!isOpen) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) => {
          const next = prev < allOptions.length - 1 ? prev + 1 : 0;
          return next;
        });
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => {
          const next = prev > 0 ? prev - 1 : allOptions.length - 1;
          return next;
        });
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < allOptions.length) {
          handleSelect(allOptions[highlightedIndex].id);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        setSearchTerm("");
        setHighlightedIndex(-1);
        break;
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-xs font-semibold text-slate-700 mb-1">
        {label}
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? searchTerm : displayValue}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
        >
          <svg
            className={`w-5 h-5 transition-transform ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
      {isOpen && (
        <div ref={dropdownRef} className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-auto">
          {allOptions.map((option, index) => (
            <div
              key={option.id ?? "all"}
              onClick={() => handleSelect(option.id)}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={`px-3 py-2 text-sm cursor-pointer ${
                index === highlightedIndex
                  ? "bg-blue-100 text-blue-900 font-medium"
                  : value === option.id
                  ? "bg-blue-50 text-blue-700 font-medium"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              {option.name}
            </div>
          ))}
          {filteredOptions.length === 0 && searchTerm.trim() && (
            <div className="px-3 py-2 text-sm text-slate-500">No results found</div>
          )}
        </div>
      )}
    </div>
  );
}

export const SearchableSelect = memo(SearchableSelectComponent) as <T extends { id: number; name: string }>(
  props: SearchableSelectProps<T>
) => React.ReactElement;

