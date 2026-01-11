import React, { useState, useEffect, useRef, useCallback, type ReactNode, memo } from "react";

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  position?: 'above' | 'below' | 'auto';
  maxWidth?: string;
  minWidth?: string;
  className?: string;
  copyText?: string; // Text to copy when copy button is clicked
}

/**
 * Generic reusable tooltip component with smart positioning
 */
export const Tooltip = memo(function Tooltip({
  content,
  children,
  position = 'auto',
  maxWidth = 'max-w-lg',
  minWidth = 'min-w-[300px]',
  className = '',
  copyText,
}: TooltipProps) {
  const [computedPosition, setComputedPosition] = useState<'above' | 'below'>('below');
  const [isHovered, setIsHovered] = useState(false);
  const [copied, setCopied] = useState(false);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!copyText) return;
    
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  // Position checking function - using the same logic as AccountTooltip
  const checkPosition = useCallback(() => {
    if (!containerRef.current || !tooltipRef.current || position !== 'auto' || !isHovered) return;
    
    const containerElement = containerRef.current;
    const tooltipElement = tooltipRef.current;
    
    // Use requestAnimationFrame to ensure tooltip is rendered
    requestAnimationFrame(() => {
      if (!containerElement || !tooltipElement) return;
      
      const containerRect = containerElement.getBoundingClientRect();
      const tooltipHeight = tooltipElement.offsetHeight || 200; // Approximate height if not measured yet
      const spaceBelow = window.innerHeight - containerRect.bottom;
      const spaceAbove = containerRect.top;
      
      // Position above if there's not enough space below, or if there's more space above
      // Same logic as AccountTooltip
      const shouldPositionAbove = spaceBelow < tooltipHeight || spaceAbove > spaceBelow;
      
      setComputedPosition(shouldPositionAbove ? 'above' : 'below');
    });
  }, [position, isHovered]);

  // Set up event listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseEnter = () => {
      // Clear any pending hide timeout
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
      setIsHovered(true);
      if (position !== 'auto') {
        setComputedPosition(position);
      }
    };
    
    const handleMouseLeave = () => {
      // Add a small delay before hiding to allow moving mouse to tooltip
      hideTimeoutRef.current = setTimeout(() => {
        setIsHovered(false);
        hideTimeoutRef.current = null;
      }, 100);
    };
    
    container.addEventListener('mouseenter', handleMouseEnter);
    container.addEventListener('mouseleave', handleMouseLeave);
    
    return () => {
      container.removeEventListener('mouseenter', handleMouseEnter);
      container.removeEventListener('mouseleave', handleMouseLeave);
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [position]);

  // Check position when tooltip becomes visible and on scroll/resize
  useEffect(() => {
    if (!isHovered || position !== 'auto') return;

    // Check position immediately
    checkPosition();
    
    // Check again after delays to ensure accurate measurement
    const timeout1 = setTimeout(checkPosition, 10);
    const timeout2 = setTimeout(checkPosition, 50);
    
    // Also check on scroll and resize
    window.addEventListener('scroll', checkPosition, true);
    window.addEventListener('resize', checkPosition);
    
    return () => {
      clearTimeout(timeout1);
      clearTimeout(timeout2);
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
      window.removeEventListener('scroll', checkPosition, true);
      window.removeEventListener('resize', checkPosition);
    };
  }, [isHovered, position, checkPosition]);

  const finalPosition = position === 'auto' ? computedPosition : position;

  return (
    <div ref={containerRef} className="relative group inline-block">
      {children}
      {isHovered && (
        <div
          ref={tooltipRef}
          className={`absolute left-0 z-[100] bg-white border border-slate-200 rounded-lg shadow-xl p-3 ${minWidth} ${maxWidth} whitespace-normal select-text ${className} ${
            finalPosition === 'above' ? 'bottom-full mb-2' : 'top-full mt-2'
          }`}
          onMouseEnter={() => {
            // Clear any pending hide timeout
            if (hideTimeoutRef.current) {
              clearTimeout(hideTimeoutRef.current);
              hideTimeoutRef.current = null;
            }
            setIsHovered(true);
          }}
          onMouseLeave={() => {
            // Add a delay before hiding to allow text selection
            hideTimeoutRef.current = setTimeout(() => {
              setIsHovered(false);
              hideTimeoutRef.current = null;
            }, 200);
          }}
          onMouseDown={(e) => e.stopPropagation()} // Prevent hiding when clicking to select
          style={{
            maxHeight: `${Math.min(window.innerHeight - 40, 400)}px`,
            overflowY: 'auto',
            overflowX: 'visible',
            userSelect: 'text',
            WebkitUserSelect: 'text',
          }}
        >
          {copyText && (
            <button
              onClick={handleCopy}
              className="absolute top-2 right-2 p-1 rounded hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-700 z-10"
              title={copied ? "Copied!" : "Copy"}
              type="button"
            >
              {copied ? (
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>
          )}
          <div className={copyText ? "pr-8" : ""}>
            {content}
          </div>
        </div>
      )}
    </div>
  );
});
