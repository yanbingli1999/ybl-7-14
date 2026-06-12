import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, GitCompare, BarChart3, TrendingDown, TrendingUp, Minus, AlertCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { CompareRecord, SimulationResult } from '../../shared/types.js';
import { formatNumber, formatPercentage } from '../../shared/monteCarlo.js';
import HistogramChart from '@/components/HistogramChart';
import StatsCards from '@/components/StatsCards';

interface CompareDetail extends CompareRecord {
  simulations: SimulationResult[];
}

export default function ComparePage() {
  const { id = '', compareId = '' } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<CompareDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const d = await api.compare.get(compareId);
        setData(d as CompareDetail);
      } catch (err) {
        alert(err instanceof Error ? err.message : '加载失败');
        navigate(`/project/${id}`);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [compareId, id]);

  if (loading || !data) {
    return <div className="flex items-center justify-center h-screen"><div className="text-monte-muted">加载中...</div></div>;
  }

  const sims = data.simulations;

  const bestMean = Math.max(...sims.map(s => s.mean));
  const bestLoss = Math.min(...sims.map(s => s.lossProbability));
  const bestStd = Math.min(...sims.map(s => s.stdDev));

  const diffToBest = (idx: number, metric: 'mean' | 'loss' | 'std') => {
    const s = sims[idx];
    if (metric === 'mean') {
      const diff = s.mean - bestMean;
      return { value: diff, pct: bestMean !== 0 ? (diff / bestMean) * 100 : 0, isBest: diff === 0 };
    }
    if (metric === 'loss') {
      const diff = s.lossProbability - bestLoss;
      return { value: diff, pct: bestLoss !== 0 ? (diff / bestLoss) * 100 : 0, isBest: diff === 0 };
    }
    const diff = s.stdDev - bestStd;
    return { value: diff, pct: bestStd !== 0 ? (diff / bestStd) * 100 : 0, isBest: diff === 0 };
  };

  return (
    <div className="min-h-screen pb-16">
      <header className="sticky top-0 z-30 border-b border-monte-border bg-monte-bg/80 backdrop-blur-lg">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <Link to={`/project/${id}`} className="p-2 rounded-lg text-monte-muted hover:text-white hover:bg-monte-border transition-all">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <GitCompare className="w-4 h-4 text-monte-accent" />
                  <span className="text-xs text-monte-muted uppercase tracking-wider font-semibold">对比分析视图</span>
                </div>
                <h1 className="text-xl font-bold text-white truncate">{data.name}</h1>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              {sims.map((_, i) => (
                <span key={i} className="badge bg-monte-accent/20 text-monte-accent border border-monte-accent/30">
                  #{i + 1} {sims[i].runName.slice(0, 20)}
                </span>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 space-y-6">
        <div className="card border-monte-accent/30">
          <h2 className="text-lg font-semibold text-white mb-5 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-monte-accent" />
            核心指标对比
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="border-b border-monte-border">
                  <th className="th">指标</th>
                  {sims.map((s, i) => (
                    <th key={s.id} className="th text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="badge bg-monte-accent/20 text-monte-accent mb-1">#{i + 1}</span>
                        <span className="text-[11px] font-normal text-monte-muted max-w-[140px] truncate">{s.runName}</span>
                      </div>
                    </th>
                  ))}
                  {sims.length >= 2 && (
                    <th className="th text-center">
                      <span className="text-monte-warn">vs #{sims.length}</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-monte-border/50">
                {[
                  {
                    label: '期望净现值',
                    key: 'mean',
                    unit: '',
                    best: 'higher',
                    cells: sims.map((s, i) => {
                      const d = diffToBest(i, 'mean');
                      return {
                        display: `${s.mean >= 0 ? '+' : ''}${formatNumber(s.mean)}`,
                        color: s.mean >= 0 ? 'text-monte-safe' : 'text-monte-danger',
                        badge: d.isBest ? '🏆 最优' : null,
                      };
                    }),
                    diff: sims.length >= 2
                      ? formatNumber(sims[0].mean - sims[sims.length - 1].mean, 0)
                      : null,
                  },
                  {
                    label: '中位数 P50',
                    key: 'median',
                    unit: '',
                    best: 'higher',
                    cells: sims.map(s => ({
                      display: formatNumber(s.median),
                      color: s.median >= 0 ? 'text-monte-safe' : 'text-monte-danger',
                      badge: null,
                    })),
                    diff: sims.length >= 2
                      ? formatNumber(sims[0].median - sims[sims.length - 1].median, 0)
                      : null,
                  },
                  {
                    label: '亏损概率',
                    key: 'loss',
                    unit: '',
                    best: 'lower',
                    cells: sims.map((s, i) => {
                      const d = diffToBest(i, 'loss');
                      return {
                        display: formatPercentage(s.lossProbability),
                        color: s.lossProbability > 0.3 ? 'text-monte-danger' : 'text-monte-safe',
                        badge: d.isBest ? '🏆 最低' : null,
                      };
                    }),
                    diff: sims.length >= 2
                      ? formatPercentage(sims[0].lossProbability - sims[sims.length - 1].lossProbability)
                      : null,
                  },
                  {
                    label: '95% VaR',
                    key: 'var',
                    unit: '',
                    best: 'higher',
                    cells: sims.map(s => ({
                      display: formatNumber(s.var95),
                      color: s.var95 >= 0 ? 'text-monte-safe' : 'text-monte-warn',
                      badge: null,
                    })),
                    diff: sims.length >= 2
                      ? formatNumber(sims[0].var95 - sims[sims.length - 1].var95, 0)
                      : null,
                  },
                  {
                    label: '标准差',
                    key: 'std',
                    unit: '',
                    best: 'lower',
                    cells: sims.map((s, i) => {
                      const d = diffToBest(i, 'std');
                      return {
                        display: formatNumber(s.stdDev),
                        color: 'text-cyan-300',
                        badge: d.isBest ? '🏆 最稳' : null,
                      };
                    }),
                    diff: sims.length >= 2
                      ? formatNumber(sims[0].stdDev - sims[sims.length - 1].stdDev, 0)
                      : null,
                  },
                  {
                    label: '5%分位数 (悲观)',
                    key: 'p5',
                    unit: '',
                    best: 'higher',
                    cells: sims.map(s => ({
                      display: formatNumber(s.percentiles.p5),
                      color: 'text-monte-warn',
                      badge: null,
                    })),
                    diff: sims.length >= 2
                      ? formatNumber(sims[0].percentiles.p5 - sims[sims.length - 1].percentiles.p5, 0)
                      : null,
                  },
                  {
                    label: '95%分位数 (乐观)',
                    key: 'p95',
                    unit: '',
                    best: 'higher',
                    cells: sims.map(s => ({
                      display: formatNumber(s.percentiles.p95),
                      color: 'text-monte-safe',
                      badge: null,
                    })),
                    diff: sims.length >= 2
                      ? formatNumber(sims[0].percentiles.p95 - sims[sims.length - 1].percentiles.p95, 0)
                      : null,
                  },
                  {
                    label: '模拟次数',
                    key: 'iter',
                    unit: '',
                    best: 'na',
                    cells: sims.map(s => ({
                      display: formatNumber(s.iterations, 0),
                      color: 'text-monte-muted',
                      badge: null,
                    })),
                    diff: null,
                  },
                ].map((row: any) => (
                  <tr key={row.key} className="hover:bg-monte-bg/40 transition-colors">
                    <td className="td font-medium text-slate-300 whitespace-nowrap">{row.label}</td>
                    {row.cells.map((c: any, i: number) => (
                      <td key={i} className="td text-center">
                        <div className="flex flex-col items-center gap-1">
                          <div className={`font-mono font-bold text-lg ${c.color}`}>{c.display}</div>
                          {c.badge && <span className="text-[10px] text-amber-300">{c.badge}</span>}
                        </div>
                      </td>
                    ))}
                    {sims.length >= 2 && (
                      <td className="td text-center">
                        {row.diff !== null && (
                          <div className="flex items-center justify-center gap-1">
                            {parseFloat(String(row.diff).replace('%', '')) > 0 ? (
                              <TrendingUp className="w-3.5 h-3.5 text-monte-safe" />
                            ) : parseFloat(String(row.diff).replace('%', '')) < 0 ? (
                              <TrendingDown className="w-3.5 h-3.5 text-monte-danger" />
                            ) : (
                              <Minus className="w-3.5 h-3.5 text-monte-muted" />
                            )}
                            <span className={`font-mono font-semibold text-sm ${
                              (row.best === 'higher' && parseFloat(String(row.diff).replace('%', '')) > 0) ||
                              (row.best === 'lower' && parseFloat(String(row.diff).replace('%', '')) < 0)
                                ? 'text-monte-safe'
                                : (row.best === 'higher' && parseFloat(String(row.diff).replace('%', '')) < 0) ||
                                  (row.best === 'lower' && parseFloat(String(row.diff).replace('%', '')) > 0)
                                  ? 'text-monte-danger'
                                  : 'text-monte-muted'
                            }`}>
                              {typeof row.diff === 'string' && row.diff.startsWith('-') ? row.diff : (parseFloat(String(row.diff).replace('%', '')) > 0 ? `+${row.diff}` : row.diff)}
                            </span>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {sims.map((s, i) => (
            <div key={s.id} className="space-y-4">
              <div className="card border-monte-accent/30">
                <div className="flex items-center gap-2 mb-3">
                  <span className="badge bg-monte-accent/20 text-monte-accent border border-monte-accent/30 font-bold">#{i + 1}</span>
                  <h3 className="text-base font-semibold text-white truncate">{s.runName}</h3>
                </div>
                <StatsCards sim={s} />
              </div>
              <HistogramChart sim={s} colorIndex={i} showTitle={false} />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {sims.map((s, i) => (
            <div key={s.id} className="card">
              <div className="flex items-center gap-2 mb-4">
                <span className="badge bg-monte-accent/20 text-monte-accent border border-monte-accent/30 font-bold">#{i + 1}</span>
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-monte-accent" />
                  分位数对比
                </h3>
              </div>
              <div className="space-y-2">
                {[
                  { k: 'p5', label: '5%分位数 (悲观)', color: 'text-monte-danger' },
                  { k: 'p25', label: '25%分位数 (保守)', color: 'text-monte-warn' },
                  { k: 'p50', label: '50%分位数 (中位)', color: 'text-monte-accent' },
                  { k: 'p75', label: '75%分位数 (乐观)', color: 'text-emerald-400' },
                  { k: 'p95', label: '95%分位数 (最佳)', color: 'text-monte-safe' },
                ].map((p: any) => (
                  <div key={`${s.id}-${p.k}`} className="flex items-center justify-between p-2.5 rounded-lg bg-monte-bg/50 border border-monte-border/50">
                    <span className={`text-sm ${p.color}`}>{p.label}</span>
                    <span className={`font-mono font-bold ${p.color}`}>
                      {formatNumber((s.percentiles as any)[p.k])}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
