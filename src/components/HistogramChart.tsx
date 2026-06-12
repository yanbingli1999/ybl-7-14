import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  ReferenceLine, Cell, LabelList,
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import type { SimulationResult } from '../../shared/types.js';
import { formatNumber } from '../../shared/monteCarlo.js';

interface Props {
  sim: SimulationResult;
  colorIndex?: number;
  showTitle?: boolean;
}

const PALETTE = [
  { from: '#6366F1', to: '#8B5CF6', name: '靛蓝' },
  { from: '#10B981', to: '#14B8A6', name: '青绿' },
  { from: '#F59E0B', to: '#F97316', name: '橙黄' },
  { from: '#EF4444', to: '#F43F5E', name: '红色' },
  { from: '#06B6D4', to: '#3B82F6', name: '蓝青' },
];

export default function HistogramChart({ sim, colorIndex = 0, showTitle = true }: Props) {
  const colors = PALETTE[colorIndex % PALETTE.length];

  const data = useMemo(() => {
    return sim.histogram.bins.map((bin, i) => ({
      index: i,
      mid: (bin.start + bin.end) / 2,
      label: `${formatNumber(bin.start, 0)}`,
      start: bin.start,
      end: bin.end,
      count: bin.count,
      pct: sim.iterations > 0 ? (bin.count / sim.iterations) * 100 : 0,
      belowThreshold: bin.end <= sim.threshold,
      crossesThreshold: bin.start < sim.threshold && bin.end > sim.threshold,
    }));
  }, [sim]);

  const maxCount = Math.max(...data.map(d => d.count), 1);

  return (
    <div className="card">
      {showTitle && (
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-monte-accent" />
            结果分布直方图
          </h3>
          <div className="text-xs text-monte-muted flex items-center gap-4">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm" style={{ background: `linear-gradient(180deg, ${colors.from}, ${colors.to})` }} />
              盈利区
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-monte-danger/60" />
              亏损区
            </span>
            <span className="flex items-center gap-1 text-monte-warn">
              ─── 阈值 {formatNumber(sim.threshold, 0)}
            </span>
          </div>
        </div>
      )}
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 30 }}>
            <defs>
              <linearGradient id={`grad-${colorIndex}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors.from} stopOpacity={0.95} />
                <stop offset="100%" stopColor={colors.to} stopOpacity={0.7} />
              </linearGradient>
              <linearGradient id={`grad-danger-${colorIndex}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#EF4444" stopOpacity={0.85} />
                <stop offset="100%" stopColor="#DC2626" stopOpacity={0.55} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: '#94A3B8', fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: '#374151' }}
              angle={-30}
              textAnchor="end"
              height={60}
              interval={Math.floor(data.length / 8)}
            />
            <YAxis
              tick={{ fill: '#94A3B8', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: '#374151' }}
              tickFormatter={(v) => `${v}`}
              width={45}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0F172A',
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#E2E8F0',
                fontSize: '12px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
              }}
              formatter={(value: number, _name: string, props: any) => {
                const d = props.payload;
                return [
                  <div key="c">
                    <div style={{ color: '#E2E8F0' }}>频数: <b>{value}</b> ({formatNumber(d.pct, 1)}%)</div>
                    <div style={{ color: '#94A3B8', fontSize: 11 }}>
                      区间: {formatNumber(d.start, 1)} ~ {formatNumber(d.end, 1)}
                    </div>
                    <div style={{ color: '#94A3B8', fontSize: 11 }}>
                      中值: {formatNumber(d.mid, 1)}
                    </div>
                  </div>,
                  '分布'
                ];
              }}
              cursor={{ fill: 'rgba(99,102,241,0.1)' }}
            />
            <ReferenceLine
              x={undefined}
              y={undefined}
              xAxis={undefined}
            />
            <Bar
              dataKey="count"
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
            >
              <LabelList
                dataKey="count"
                position="top"
                style={{ fill: '#94A3B8', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                formatter={(v: number) => v > maxCount * 0.15 ? v : ''}
              />
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.belowThreshold ? `url(#grad-danger-${colorIndex})` : `url(#grad-${colorIndex})`}
                  opacity={entry.crossesThreshold ? 0.75 : 1}
                />
              ))}
            </Bar>
            <ReferenceLine
              x={data.findIndex(d => d.start <= sim.threshold && d.end > sim.threshold) + 0.5}
              stroke="#F59E0B"
              strokeWidth={2}
              strokeDasharray="6 4"
              label={{
                value: `阈值=${formatNumber(sim.threshold, 0)}`,
                fill: '#F59E0B',
                fontSize: 11,
                position: 'top',
                fontFamily: 'JetBrains Mono',
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-5 gap-2 mt-4 text-center">
        <div className="p-2 rounded-lg bg-monte-bg/50">
          <div className="text-[10px] text-monte-muted mb-0.5">最小结果</div>
          <div className="text-sm font-mono font-bold text-monte-danger">{formatNumber(sim.min)}</div>
        </div>
        <div className="p-2 rounded-lg bg-monte-bg/50">
          <div className="text-[10px] text-monte-muted mb-0.5">5%分位数</div>
          <div className="text-sm font-mono font-bold text-monte-warn">{formatNumber(sim.percentiles.p5)}</div>
        </div>
        <div className="p-2 rounded-lg bg-monte-bg/50">
          <div className="text-[10px] text-monte-muted mb-0.5">中位结果</div>
          <div className="text-sm font-mono font-bold text-monte-accent">{formatNumber(sim.percentiles.p50)}</div>
        </div>
        <div className="p-2 rounded-lg bg-monte-bg/50">
          <div className="text-[10px] text-monte-muted mb-0.5">95%分位数</div>
          <div className="text-sm font-mono font-bold text-emerald-400">{formatNumber(sim.percentiles.p95)}</div>
        </div>
        <div className="p-2 rounded-lg bg-monte-bg/50">
          <div className="text-[10px] text-monte-muted mb-0.5">最大结果</div>
          <div className="text-sm font-mono font-bold text-monte-safe">{formatNumber(sim.max)}</div>
        </div>
      </div>
    </div>
  );
}
