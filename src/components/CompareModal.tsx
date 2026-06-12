import { useState } from 'react';
import { X, GitCompare, Check } from 'lucide-react';
import { api } from '@/lib/api';
import type { SimulationResult } from '../../shared/types.js';
import { formatNumber, formatPercentage } from '../../shared/monteCarlo.js';

interface Props {
  simulations: SimulationResult[];
  projectId: string;
  onClose: () => void;
  onCreated: (compareId: string) => void;
}

export default function CompareModal({ simulations, projectId, onClose, onCreated }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const toggle = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleCreate = async () => {
    if (selected.length < 2) return;
    setSubmitting(true);
    try {
      const result = await api.compare.create(projectId, {
        name: name.trim() || `对比 ${new Date().toLocaleString('zh-CN')}`,
        simulationIds: selected,
      });
      onCreated(result.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="card w-full max-w-2xl shadow-2xl relative max-h-[85vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <GitCompare className="w-5 h-5 text-monte-accent" />
            选择对比的模拟结果
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-monte-muted hover:text-white hover:bg-monte-border transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mb-3 flex-shrink-0">
          <label className="label">对比名称 (可选)</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="例如：参数优化前后对比"
            className="input"
          />
        </div>

        <div className="text-sm text-monte-muted mb-3 flex-shrink-0 flex items-center justify-between">
          <span>已选择 <span className="text-monte-accent font-semibold">{selected.length}</span> / {simulations.length} (至少选择 2 个)</span>
          {selected.length > 0 && (
            <button
              onClick={() => setSelected([])}
              className="text-xs text-monte-danger hover:underline"
            >
              清空选择
            </button>
          )}
        </div>

        <div className="space-y-2 overflow-y-auto pr-1 flex-1 min-h-[200px]">
          {simulations.map((sim, idx) => {
            const isSel = selected.includes(sim.id);
            return (
              <div
                key={sim.id}
                onClick={() => toggle(sim.id)}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  isSel
                    ? 'bg-monte-accent/10 border-monte-accent/50'
                    : 'bg-monte-bg/50 border-monte-border/50 hover:border-monte-accent/30'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-all ${
                    isSel ? 'bg-monte-accent' : 'border-2 border-monte-border bg-monte-card'
                  }`}>
                    {isSel && <Check className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-sm font-medium ${isSel ? 'text-monte-accent' : 'text-white'}`}>
                        #{simulations.length - idx} {sim.runName}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-monte-muted flex-wrap">
                      <span>{new Date(sim.timestamp).toLocaleString('zh-CN')}</span>
                      <span className="font-mono">{formatNumber(sim.iterations, 0)} 次</span>
                      <span>均值 <span className={`font-mono ${sim.mean >= 0 ? 'text-monte-safe' : 'text-monte-danger'}`}>{formatNumber(sim.mean, 0)}</span></span>
                      <span>亏损 <span className={`font-mono ${sim.lossProbability > 0.3 ? 'text-monte-danger' : 'text-monte-safe'}`}>{formatPercentage(sim.lossProbability, 0)}</span></span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-3 pt-4 mt-4 border-t border-monte-border flex-shrink-0">
          <button onClick={onClose} className="btn-secondary flex-1">
            取消
          </button>
          <button
            onClick={handleCreate}
            disabled={submitting || selected.length < 2}
            className="btn-primary flex-1"
          >
            {submitting ? '创建中...' : `创建对比 (${selected.length} 个结果)`}
          </button>
        </div>
      </div>
    </div>
  );
}
