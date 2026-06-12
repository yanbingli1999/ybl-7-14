import {
  BarChart2, Sigma, ArrowRightLeft, Maximize2, Minimize2, Activity,
} from 'lucide-react';
import type { SimulationResult } from '../../shared/types.js';
import { formatNumber } from '../../shared/monteCarlo.js';

interface Props {
  sim: SimulationResult;
}

const CARD_CONFIG = [
  {
    key: 'mean',
    label: '平均值',
    icon: BarChart2,
    color: 'from-indigo-500/20 to-indigo-500/5',
    textColor: 'text-indigo-300',
    borderColor: 'border-indigo-500/30',
    iconColor: 'text-indigo-400',
    accessor: (s: SimulationResult) => s.mean,
  },
  {
    key: 'median',
    label: '中位数值',
    icon: ArrowRightLeft,
    color: 'from-purple-500/20 to-purple-500/5',
    textColor: 'text-purple-300',
    borderColor: 'border-purple-500/30',
    iconColor: 'text-purple-400',
    accessor: (s: SimulationResult) => s.median,
  },
  {
    key: 'stddev',
    label: '标准差',
    icon: Sigma,
    color: 'from-cyan-500/20 to-cyan-500/5',
    textColor: 'text-cyan-300',
    borderColor: 'border-cyan-500/30',
    iconColor: 'text-cyan-400',
    accessor: (s: SimulationResult) => s.stdDev,
  },
  {
    key: 'range',
    label: '极差区间',
    icon: Maximize2,
    color: 'from-rose-500/20 to-rose-500/5',
    textColor: 'text-rose-300',
    borderColor: 'border-rose-500/30',
    iconColor: 'text-rose-400',
    accessor: (s: SimulationResult) => s.max - s.min,
  },
  {
    key: 'cv',
    label: '变异系数',
    icon: Activity,
    color: 'from-amber-500/20 to-amber-500/5',
    textColor: 'text-amber-300',
    borderColor: 'border-amber-500/30',
    iconColor: 'text-amber-400',
    accessor: (s: SimulationResult) => s.mean !== 0 ? (s.stdDev / Math.abs(s.mean)) * 100 : NaN,
    suffix: '%',
  },
  {
    key: 'iter',
    label: '模拟抽样数',
    icon: Minimize2,
    color: 'from-emerald-500/20 to-emerald-500/5',
    textColor: 'text-emerald-300',
    borderColor: 'border-emerald-500/30',
    iconColor: 'text-emerald-400',
    accessor: (s: SimulationResult) => s.iterations,
    decimals: 0,
  },
];

export default function StatsCards({ sim }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {CARD_CONFIG.map((cfg) => {
        const Icon = cfg.icon;
        const rawValue = cfg.accessor(sim);
        const decimals = (cfg as any).decimals ?? 2;
        const suffix = (cfg as any).suffix ?? '';
        const display = isFinite(rawValue) ? formatNumber(rawValue, decimals) + suffix : 'N/A';
        return (
          <div
            key={cfg.key}
            className={`p-3 rounded-xl bg-gradient-to-br ${cfg.color} border ${cfg.borderColor} transition-all hover:scale-[1.02]`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <Icon className={`w-4 h-4 ${cfg.iconColor}`} />
              <span className="text-[9px] text-monte-muted uppercase tracking-wider">
                {cfg.key.toUpperCase()}
              </span>
            </div>
            <div className={`text-xl font-bold font-mono ${cfg.textColor} truncate`}>{display}</div>
            <div className="text-[10px] text-monte-muted mt-0.5">{cfg.label}</div>
          </div>
        );
      })}
    </div>
  );
}
