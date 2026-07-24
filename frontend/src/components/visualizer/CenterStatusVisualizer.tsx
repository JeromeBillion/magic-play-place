'use client';

import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { Mode, NeurologicalProfile, BackendReachability } from '../../lib/types';

const NODES = [
  { cx: 50, cy: 18, r: 3.5 },
  { cx: 25, cy: 32, r: 3 },
  { cx: 75, cy: 32, r: 3 },
  { cx: 15, cy: 52, r: 2.5 },
  { cx: 50, cy: 50, r: 5 },
  { cx: 85, cy: 52, r: 2.5 },
  { cx: 25, cy: 70, r: 3 },
  { cx: 75, cy: 70, r: 3 },
  { cx: 50, cy: 85, r: 3.5 },
  { cx: 38, cy: 40, r: 2 },
  { cx: 62, cy: 40, r: 2 },
  { cx: 38, cy: 62, r: 2 },
  { cx: 62, cy: 62, r: 2 },
];

const CONNECTIONS = [
  [0, 1], [0, 2], [0, 4], [1, 3], [1, 4], [1, 9],
  [2, 5], [2, 4], [2, 10], [3, 6], [3, 4],
  [4, 5], [4, 6], [4, 7], [4, 9], [4, 10], [4, 11], [4, 12],
  [5, 7], [6, 8], [7, 8], [9, 11], [10, 12], [11, 12],
];

function getModeColor(mode: Mode) {
  switch (mode) {
    case 'discovery': return { primary: '#06d6a0', glow: 'rgba(6,214,160,0.4)' };
    case 'therapeutics': return { primary: '#8b5cf6', glow: 'rgba(139,92,246,0.4)' };
    case 'conditioning': return { primary: '#f59e0b', glow: 'rgba(245,158,11,0.4)' };
  }
}

type Props = {
  profile: NeurologicalProfile;
  isProcessing: boolean;
  mode: Mode;
  backendReachability: BackendReachability;
};

export function CenterStatusVisualizer({ profile, isProcessing, mode, backendReachability }: Props) {
  const colors = useMemo(() => getModeColor(mode), [mode]);

  const statusLabel = isProcessing ? 'Processing' : 'Ready';
  const statusColor = isProcessing ? colors.primary : 'rgba(255,255,255,0.7)';
  const reachDot = backendReachability === 'online' ? 'online' : backendReachability === 'offline' ? 'offline' : 'checking';

  return (
    <div className="w-full max-w-xl space-y-6">
      {/* Status Bar */}
      <div className="flex flex-wrap gap-4 justify-between items-center text-[10px] uppercase tracking-widest">
        <div className="flex items-center gap-2 text-white/50">
          <span className={`status-dot ${reachDot}`} />
          Model: <span style={{ color: colors.primary }} className="font-semibold">Tribe v2</span>
        </div>
        <div className="text-white/50">
          Profile: <span className="text-white/80 font-medium">{profile}</span>
        </div>
        <div className="text-white/50">
          Status: <span style={{ color: statusColor }} className="font-semibold">{statusLabel}</span>
        </div>
      </div>

      {/* Neural Network Visualization */}
      <div className="relative aspect-square max-w-md mx-auto">
        {/* Outer glow ring */}
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            background: `radial-gradient(circle, ${colors.glow} 0%, transparent 70%)`,
          }}
          animate={{
            opacity: isProcessing ? [0.3, 0.7, 0.3] : 0.15,
            scale: isProcessing ? [0.95, 1.05, 0.95] : 1,
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        {/* SVG Neural Network */}
        <svg viewBox="0 0 100 100" className="w-full h-full relative z-10">
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <radialGradient id="centerGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={colors.primary} stopOpacity="0.15" />
              <stop offset="100%" stopColor={colors.primary} stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Background glow */}
          <circle cx="50" cy="50" r="42" fill="url(#centerGrad)" />

          {/* Connections */}
          {CONNECTIONS.map(([from, to], i) => (
            <motion.line
              key={`conn-${i}`}
              x1={NODES[from].cx}
              y1={NODES[from].cy}
              x2={NODES[to].cx}
              y2={NODES[to].cy}
              stroke={colors.primary}
              strokeWidth="0.3"
              initial={{ opacity: 0.1 }}
              animate={{
                opacity: isProcessing ? [0.08, 0.35, 0.08] : 0.12,
                strokeWidth: isProcessing ? [0.3, 0.6, 0.3] : 0.3,
              }}
              transition={{
                duration: 2 + (i % 3) * 0.5,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: (i % 5) * 0.2,
              }}
            />
          ))}

          {/* Data flow pulses on connections during processing */}
          {isProcessing && CONNECTIONS.slice(0, 12).map(([from, to], i) => (
            <motion.circle
              key={`pulse-${i}`}
              r="0.8"
              fill={colors.primary}
              filter="url(#glow)"
              initial={{
                cx: NODES[from].cx,
                cy: NODES[from].cy,
                opacity: 0,
              }}
              animate={{
                cx: [NODES[from].cx, NODES[to].cx],
                cy: [NODES[from].cy, NODES[to].cy],
                opacity: [0, 0.9, 0],
              }}
              transition={{
                duration: 1.5 + (i % 4) * 0.3,
                repeat: Infinity,
                ease: 'linear',
                delay: i * 0.35,
              }}
            />
          ))}

          {/* Nodes */}
          {NODES.map((node, i) => (
            <motion.circle
              key={`node-${i}`}
              cx={node.cx}
              cy={node.cy}
              r={node.r}
              fill={i === 4 ? colors.primary : 'transparent'}
              stroke={colors.primary}
              strokeWidth={i === 4 ? 0.8 : 0.5}
              filter="url(#glow)"
              animate={{
                opacity: isProcessing
                  ? [0.4, 1, 0.4]
                  : i === 4 ? 0.8 : 0.35,
                r: isProcessing && i === 4
                  ? [node.r, node.r * 1.3, node.r]
                  : node.r,
              }}
              transition={{
                duration: 2 + (i % 3) * 0.4,
                repeat: isProcessing ? Infinity : 0,
                ease: 'easeInOut',
                delay: (i % 4) * 0.15,
              }}
            />
          ))}

          {/* Center label */}
          <text
            x="50"
            y="50"
            textAnchor="middle"
            dominantBaseline="central"
            fill={colors.primary}
            fontSize="3.5"
            fontWeight="600"
            letterSpacing="0.15em"
            opacity={0.85}
          >
            {isProcessing ? 'ACTIVE' : mode.toUpperCase()}
          </text>
        </svg>

        {/* Floating particles during processing */}
        {isProcessing && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-full">
            {Array.from({ length: 6 }).map((_, i) => (
              <motion.div
                key={`particle-${i}`}
                className="absolute w-1 h-1 rounded-full"
                style={{
                  background: colors.primary,
                  left: `${20 + (i * 12)}%`,
                  bottom: '30%',
                  boxShadow: `0 0 6px ${colors.glow}`,
                }}
                animate={{
                  y: [0, -80],
                  x: [0, (i % 2 === 0 ? 15 : -15)],
                  opacity: [0, 0.8, 0],
                  scale: [0.5, 1, 0.3],
                }}
                transition={{
                  duration: 2 + i * 0.3,
                  repeat: Infinity,
                  ease: 'easeOut',
                  delay: i * 0.4,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Progress indicator — indeterminate during processing, done bar on complete */}
      {isProcessing ? (
        <div className="space-y-2">
          <div className="progress-indeterminate" />
          <div className="text-[10px] text-center tracking-widest uppercase" style={{ color: colors.primary }}>
            Processing neural inference...
          </div>
        </div>
      ) : null}
    </div>
  );
}
