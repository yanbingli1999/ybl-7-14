import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList,
} from 'recharts';
import { Target } from 'lucide-react';
import type { SimulationResult } from '../../shared/types.js';
import { formatNumber, formatPercentage } from '../../shared/monteCarlo.js';

interface Props {
  sim: SimulationResult;
}

export default function SensitivityChart({ sim }: Props) {
  const data = useMemo(() => {
    return [...sim.sensitivity].reverse().map(s => ({
      ...s,
      corrPct: Math.abs(s.correlation) * 100,
      isPositive: s.correlation >= 0,
      labelLen: Math.max(s.variableName.length * 8, 80),
    }));
  }, [sim]);

  const maxContribution = Math.max(...data.map(d => d.contribution), 1);

  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <Target className="w-5 h-5 text-monte-accent" />
        敏感性分析 (关键变量影响)
      </h3>
      {data.length === 0 ? (
        <div className="text-center py-16 text-monte-muted">无数据</div>
      ) : (
        <>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 5, bottom: 5 }}
              >
                <XAxis
                  type="number"
                  tick={{ fill: '#94A3B8', fontSize: 10 }}
                  tickLine={false}
                  axisLine={{ stroke: '#374151' }}
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                />
                <YAxis
                  type="category"
                  dataKey="variableName"
                  tick={{ fill: '#E2E8F0', fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={100}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0F172A',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#E2E8F0',
                    fontSize: '12px',
                  }}
                  formatter={(_v: any, _n: string, props: any) => {
                    const d = props.payload;
                    return [
                      <div key="s">
                        <div style={{ color: d.isPositive ? '#10B981' : '#EF4444' }}>
                          相关系数: <b>{formatNumber(d.correlation, 3)}</b> ({d.isPositive ? '正相关' : '负相关'})
                        </div>
                        <div style={{ color: '#E2E8F0' }}>
                          贡献度: <b>{formatNumber(d.contribution, 1)}%</b>
                        </div>
                      </div>,
                      d.variableName
                    ];
                  }}
                  cursor={{ fill: 'rgba(99,102,241,0.08)' }}
                />
                <Bar
                  dataKey="contribution"
                  radius={[0, 6, 6, 0]}
                  barSize={18}
                >
                  <LabelList
                    dataKey="contribution"
                    position="right"
                    style={{ fill: '#94A3B8', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                    formatter={(v: number) => `${formatNumber(v, 1)}%`}
                  />
                  {data.map((entry, index) => (
                    <Cell
                      key={`sc-${index}`}
                      fill={entry.isPositive ? '#10B981' : '#EF4444'}
                      fillOpacity={0.5 + (entry.contribution / maxContribution) * 0.5}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {[...sim.sensitivity].slice(0, 4).map((s, i) => (
              <div key={s.variableId} className="flex items-center justify-between p-2.5 rounded-lg bg-monte-bg/50 border border-monte-border/50">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    i === 0 ? 'bg-monte-warn/20 text-monte-warn' :
                    i === 1 ? 'bg-slate-400/20 text-slate-300' :
                    i === 2 ? 'bg-amber-700/30 text-amber-600' : 'bg-monte-border text-monte-muted'
                  }`}>
                    {i + 1}
                  </span>
                  <span className="text-sm text-white truncate">{s.variableName}</span>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className={`text-sm font-mono font-bold ${s.correlation >= 0 ? 'text-monte-safe' : 'text-monte-danger'}`}>
                    {s.correlation >= 0 ? '+' : ''}{formatNumber(s.correlation, 2)}
                  </div>
                  <div className="text-[10px] text-monte-muted">{formatNumber(s.contribution, 1)}% 影响</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
