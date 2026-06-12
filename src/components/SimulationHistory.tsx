import { History, Play, Trash2, Check } from 'lucide-react';
import type { SimulationResult } from '../../shared/types.js';
import { formatNumber, formatPercentage } from '../../shared/monteCarlo.js';

interface Props {
  simulations: SimulationResult[];
  currentId: string | null;
  onSelect: (sim: SimulationResult) => void;
  onDelete: (id: string) => void;
}

export default function SimulationHistory({ simulations, currentId, onSelect, onDelete }: Props) {
  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <History className="w-5 h-5 text-monte-accent" />
        历史运行
        <span className="badge bg-monte-accent/20 text-monte-accent border border-monte-accent/30 ml-1">
          {simulations.length}
        </span>
      </h3>

      {simulations.length === 0 ? (
        <div className="text-center py-8 text-monte-muted text-sm">
          暂无历史记录，运行模拟后将自动保存
        </div>
      ) : (
        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
          {simulations.map((sim, idx) => {
            const isActive = sim.id === currentId;
            const isLoss = sim.lossProbability > 0.3;
            return (
              <div
                key={sim.id}
                onClick={() => onSelect(sim)}
                className={`p-3 rounded-xl border cursor-pointer transition-all group ${
                  isActive
                    ? 'bg-monte-accent/10 border-monte-accent/50 shadow-glow'
                    : 'bg-monte-bg/50 border-monte-border/50 hover:border-monte-accent/30 hover:bg-monte-bg'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {isActive && <Check className="w-3.5 h-3.5 text-monte-accent flex-shrink-0" />}
                      <span className={`text-sm font-medium truncate ${isActive ? 'text-monte-accent' : 'text-white'}`}>
                        #{simulations.length - idx} {sim.runName}
                      </span>
                    </div>
                    <div className="text-xs text-monte-muted mb-2 flex items-center gap-3 flex-wrap">
                      <span>{new Date(sim.timestamp).toLocaleString('zh-CN')}</span>
                      <span className="font-mono">{formatNumber(sim.iterations, 0)} 次</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[11px]">
                      <div className="p-1.5 rounded-md bg-monte-card/60">
                        <span className="text-monte-muted">均值</span>
                        <span className={`ml-1 font-mono font-semibold ${sim.mean >= 0 ? 'text-monte-safe' : 'text-monte-danger'}`}>
                          {formatNumber(sim.mean, 0)}
                        </span>
                      </div>
                      <div className="p-1.5 rounded-md bg-monte-card/60">
                        <span className="text-monte-muted">P50</span>
                        <span className="ml-1 font-mono font-semibold text-monte-accent">
                          {formatNumber(sim.percentiles.p50, 0)}
                        </span>
                      </div>
                      <div className="p-1.5 rounded-md bg-monte-card/60">
                        <span className="text-monte-muted">亏损</span>
                        <span className={`ml-1 font-mono font-semibold ${isLoss ? 'text-monte-danger' : 'text-monte-safe'}`}>
                          {formatPercentage(sim.lossProbability, 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); onSelect(sim); }}
                      className={`p-1.5 rounded-md transition-colors ${
                        isActive
                          ? 'bg-monte-accent/20 text-monte-accent'
                          : 'text-monte-muted hover:text-monte-accent hover:bg-monte-accent/10'
                      }`}
                      title="查看结果"
                    >
                      <Play className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(sim.id); }}
                      className="p-1.5 rounded-md text-monte-muted hover:text-monte-danger hover:bg-monte-danger/10 transition-colors"
                      title="删除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
