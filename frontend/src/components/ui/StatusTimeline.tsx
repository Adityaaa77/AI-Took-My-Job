import React from 'react';
import { CheckCircle2, CircleDot, Circle } from 'lucide-react';

export interface TimelineStep {
  label: string;
  sublabel?: string;
  status: 'completed' | 'current' | 'upcoming';
  timestamp?: string;
}

interface StatusTimelineProps {
  steps: TimelineStep[];
  className?: string;
}

export const StatusTimeline: React.FC<StatusTimelineProps> = ({ steps, className = '' }) => {
  return (
    <div className={`w-full py-3 ${className}`}>
      <div className="flex items-center justify-between relative">
        {steps.map((step, idx) => {
          const isLast = idx === steps.length - 1;
          const isCompleted = step.status === 'completed';
          const isCurrent = step.status === 'current';

          return (
            <React.Fragment key={idx}>
              <div className="flex flex-col items-center relative z-10 text-center max-w-[120px]">
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center transition-all ${
                    isCompleted
                      ? 'bg-emerald-600 text-white ring-4 ring-emerald-50'
                      : isCurrent
                      ? 'bg-blue-600 text-white ring-4 ring-blue-50 animate-pulse'
                      : 'bg-slate-100 text-slate-400 border border-slate-300'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : isCurrent ? (
                    <CircleDot className="h-4 w-4" />
                  ) : (
                    <Circle className="h-4 w-4" />
                  )}
                </div>
                <p
                  className={`mt-2 text-xs font-semibold ${
                    isCompleted ? 'text-emerald-700' : isCurrent ? 'text-blue-700' : 'text-slate-500'
                  }`}
                >
                  {step.label}
                </p>
                {step.timestamp && <p className="text-[10px] text-slate-400 font-mono mt-0.5">{step.timestamp}</p>}
                {step.sublabel && <p className="text-[10px] text-slate-500 leading-tight">{step.sublabel}</p>}
              </div>

              {!isLast && (
                <div
                  className={`flex-1 h-0.5 mx-2 -mt-5 transition-all ${
                    isCompleted ? 'bg-emerald-500' : 'bg-slate-200'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
