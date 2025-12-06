/**
 * SpinningRecord - Animated vinyl record loading indicator
 * Perfect for a record store theme!
 */

export function SpinningRecord({ size = 64 }: { size?: number }) {
  return (
    <div className="flex items-center justify-center">
      <style>{`
        @keyframes spin-record {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        .spinning-record {
          animation: spin-record 2s linear infinite;
          transform-origin: center center;
        }
      `}</style>
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        className="spinning-record"
      >
        {/* Outer ring */}
        <circle
          cx="50"
          cy="50"
          r="48"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-slate-600"
        />
        
        {/* Grooves */}
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.5"
          className="text-slate-500"
          opacity="0.3"
        />
        <circle
          cx="50"
          cy="50"
          r="35"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.5"
          className="text-slate-500"
          opacity="0.3"
        />
        <circle
          cx="50"
          cy="50"
          r="30"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.5"
          className="text-slate-500"
          opacity="0.3"
        />
        <circle
          cx="50"
          cy="50"
          r="25"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.5"
          className="text-slate-500"
          opacity="0.3"
        />
        <circle
          cx="50"
          cy="50"
          r="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.5"
          className="text-slate-500"
          opacity="0.3"
        />
        
        {/* Center label area */}
        <circle
          cx="50"
          cy="50"
          r="12"
          fill="currentColor"
          className="text-slate-400"
        />
        
        {/* Center hole */}
        <circle
          cx="50"
          cy="50"
          r="3"
          fill="currentColor"
          className="text-slate-800"
        />
        
        {/* Label text lines (subtle) */}
        <line
          x1="50"
          y1="42"
          x2="50"
          y2="46"
          stroke="currentColor"
          strokeWidth="0.5"
          className="text-slate-600"
          opacity="0.5"
        />
        <line
          x1="50"
          y1="54"
          x2="50"
          y2="58"
          stroke="currentColor"
          strokeWidth="0.5"
          className="text-slate-600"
          opacity="0.5"
        />
      </svg>
    </div>
  )
}

