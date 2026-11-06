import React from 'react';
import { clsx } from 'clsx';

interface ProgressBarProps {
  value: number;   // 0–100
  color?: string;
  className?: string;
  label?: string;
}

export default function ProgressBar({ value, color = '#292524', className, label }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, value));
  const isOverBudget = value > 100;

  return (
    <div className={clsx('progress-track', className)} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div
        className="progress-fill"
        style={{
          width: `${pct}%`,
          background: isOverBudget ? '#EF4444' : color,
        }}
      />
    </div>
  );
}
