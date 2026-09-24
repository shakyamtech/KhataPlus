import React, { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";

interface AnimatedCartIconProps {
  itemCount: number;
  className?: string;
  size?: number;
}

export const AnimatedCartIcon: React.FC<AnimatedCartIconProps> = ({
  itemCount,
  className,
  size = 22,
}) => {
  const [isBouncing, setIsBouncing] = useState(false);
  const prevCountRef = useRef(itemCount);

  useEffect(() => {
    // Trigger animation when items are added
    if (itemCount > prevCountRef.current) {
      setIsBouncing(true);
      const timer = setTimeout(() => {
        setIsBouncing(false);
      }, 700);
      prevCountRef.current = itemCount;
      return () => clearTimeout(timer);
    }
    prevCountRef.current = itemCount;
  }, [itemCount]);

  const hasItems = itemCount > 0;

  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center select-none",
        className
      )}
      style={{ width: size, height: size }}
    >
      <style>{`
        @keyframes cartItemDrop {
          0% {
            transform: translateY(-10px) scale(0.6);
            opacity: 0;
          }
          30% {
            opacity: 1;
            transform: translateY(-4px) scale(1);
          }
          75% {
            transform: translateY(6px) scale(0.9);
            opacity: 1;
          }
          100% {
            transform: translateY(11px) scale(0.3);
            opacity: 0;
          }
        }

        @keyframes cartSpringRoll {
          0% {
            transform: translateX(0) rotate(0deg) scale(1);
          }
          20% {
            transform: translateX(-2px) rotate(-6deg) scale(0.95);
          }
          45% {
            transform: translateX(3px) rotate(4deg) scale(1.12);
          }
          65% {
            transform: translateX(-1px) rotate(-2deg) scale(1.04);
          }
          85% {
            transform: translateX(1px) rotate(1deg) scale(1.01);
          }
          100% {
            transform: translateX(0) rotate(0deg) scale(1);
          }
        }

        @keyframes wheelSpin {
          0% {
            transform: rotate(0deg);
          }
          50% {
            transform: rotate(240deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

        .animate-cart-drop {
          animation: cartItemDrop 0.55s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }

        .animate-cart-spring {
          animation: cartSpringRoll 0.65s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        .animate-wheel-spin-left {
          transform-origin: 9px 21px;
          animation: wheelSpin 0.65s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }

        .animate-wheel-spin-right {
          transform-origin: 20px 21px;
          animation: wheelSpin 0.65s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }
      `}</style>

      {/* Dropping Item / Parcel Animation */}
      {isBouncing && (
        <svg
          viewBox="0 0 24 24"
          className="absolute top-0 left-0 w-full h-full pointer-events-none z-10 animate-cart-drop text-primary"
          fill="none"
        >
          <rect
            x="11"
            y="2"
            width="5"
            height="5"
            rx="1.2"
            fill="currentColor"
            className="shadow-sm"
          />
        </svg>
      )}

      {/* Main Cart SVG */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn(
          "transition-transform duration-300 transform",
          isBouncing && "animate-cart-spring",
          hasItems ? "text-primary drop-shadow-xs" : "text-primary opacity-80"
        )}
      >
        {/* Cart Basket Body */}
        <path
          d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"
          className={cn(
            "transition-all duration-300 ease-out",
            hasItems ? "fill-primary/90 stroke-primary" : "fill-transparent stroke-primary"
          )}
        />

        {/* Left Wheel */}
        <g className={cn(isBouncing && "animate-wheel-spin-left")}>
          <circle
            cx="9"
            cy="21"
            r="1.75"
            className={cn(
              "transition-all duration-300",
              hasItems ? "fill-primary stroke-primary" : "fill-primary/20 stroke-primary"
            )}
          />
          {isBouncing && (
            <line x1="9" y1="19.5" x2="9" y2="22.5" stroke="currentColor" strokeWidth="1" opacity="0.6" />
          )}
        </g>

        {/* Right Wheel */}
        <g className={cn(isBouncing && "animate-wheel-spin-right")}>
          <circle
            cx="20"
            cy="21"
            r="1.75"
            className={cn(
              "transition-all duration-300",
              hasItems ? "fill-primary stroke-primary" : "fill-primary/20 stroke-primary"
            )}
          />
          {isBouncing && (
            <line x1="20" y1="19.5" x2="20" y2="22.5" stroke="currentColor" strokeWidth="1" opacity="0.6" />
          )}
        </g>
      </svg>
    </div>
  );
};
