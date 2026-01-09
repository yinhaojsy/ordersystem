import React, { useRef, useEffect, useState } from "react";

export interface ActionMenuItem {
  key: string;
  label: string;
  onClick: () => void;
  color?: "blue" | "amber" | "rose" | "slate" | "green";
  disabled?: boolean;
  hidden?: boolean;
  separator?: boolean; // Show separator line before this item
}

interface ActionsMenuProps {
  actions: ActionMenuItem[];
  entityId: number;
  t: (key: string) => string;
  buttonAriaLabel?: string;
}

/**
 * Reusable action menu component with 3 vertical dots button
 * Used across Orders, Expenses, and Transfers pages
 */
export function ActionsMenu({
  actions,
  entityId,
  t,
  buttonAriaLabel = "Actions",
}: ActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [positionAbove, setPositionAbove] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuElementRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isOpen]);

  // Calculate menu position when it opens
  useEffect(() => {
    if (isOpen && menuRef.current) {
      requestAnimationFrame(() => {
        if (!menuRef.current) return;
        
        const buttonRect = menuRef.current.getBoundingClientRect();
        const menuHeight = menuElementRef.current?.offsetHeight || 200;
        const spaceBelow = window.innerHeight - buttonRect.bottom;
        const spaceAbove = buttonRect.top;

        const shouldPositionAbove =
          spaceBelow < menuHeight + 10 && spaceAbove > spaceBelow;

        setPositionAbove(shouldPositionAbove);
      });
    }
  }, [isOpen]);

  const visibleActions = actions.filter((action) => !action.hidden);

  if (visibleActions.length === 0) {
    return null;
  }

  const getColorClasses = (color?: string) => {
    switch (color) {
      case "blue":
        return "text-blue-600 hover:bg-blue-50";
      case "amber":
        return "text-amber-600 hover:bg-amber-50";
      case "rose":
        return "text-rose-600 hover:bg-rose-50";
      case "green":
        return "text-green-600 hover:bg-green-50";
      case "slate":
      default:
        return "text-slate-600 hover:bg-slate-50";
    }
  };

  return (
    <div className="relative inline-block" ref={menuRef}>
      <button
        className="flex items-center justify-center p-1 hover:bg-slate-100 rounded transition-colors"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={buttonAriaLabel}
      >
        <svg
          className="w-5 h-5 text-slate-600"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </button>

      {isOpen && (
        <div
          ref={menuElementRef}
          className={`absolute right-0 w-40 bg-white border border-slate-200 rounded-lg shadow-lg z-[9999] ${
            positionAbove ? "bottom-full mb-1" : "top-0"
          }`}
        >
          {visibleActions.map((action, index) => (
            <React.Fragment key={action.key}>
              {action.separator && index > 0 && (
                <div className="border-t border-slate-200" />
              )}
              <button
                className={`w-full text-left px-4 py-2 text-sm ${getColorClasses(
                  action.color
                )} first:rounded-t-lg last:rounded-b-lg disabled:opacity-60 disabled:cursor-not-allowed`}
                onClick={() => {
                  if (!action.disabled) {
                    action.onClick();
                    setIsOpen(false);
                  }
                }}
                disabled={action.disabled}
              >
                {action.label}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
