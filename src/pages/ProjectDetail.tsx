import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, Play, RefreshCw, BarChart3, AlertTriangle,
  TrendingUp, Target, Layers, History, GitCompare, Pencil, X, Save,
  Clock, DollarSign, Calendar, Settings, Info, Sparkles,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAppStore } from '@/store/useAppStore';
import { formatNumber, formatPercentage } from '../../shared/monteCarlo.js';
import type { VariableType, DistributionType, DiscreteOption, CreateVariableDto, UpdateVariableDto, SimulationResult } from '../../shared/types.js';
import HistogramChart from '@/components/HistogramChart';
import SensitivityChart from '@/components/SensitivityChart';
import StatsCards from '@/components/StatsCards';
import SimulationHistory from '@/components/SimulationHistory';
import CompareModal from '@/components/CompareModal';

const VARIABLE_TYPE_CONFIG: Record<VariableType, { label: string; color: string; icon: any; defaultWeight: number; defaultUnit: string }> = {
  cost: { label: '成本', color: 'bg-red-500/20 text-red-300 border-red-500/40', icon: DollarSign, defaultWeight: -1, defaultUnit: '万元' },
  duration: { label: '工期', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40', icon: Clock, defaultWeight: -1, defaultUnit: '天' },
  revenue: { label: '收益', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', icon: TrendingUp, defaultWeight: 1, defaultUnit: '万元' },
  custom: { label: '自定义', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40', icon: Settings, defaultWeight: 1, defaultUnit: '' },
};

const DISTRIBUTION_CONFIG: Record<DistributionType, { label: string; desc: string }> = {
  triangular: { label: '三角分布', desc: '三点估算：最小值 / 最可能值 / 最大值' },
  normal: { label: '正态分布', desc: '均值 ± 标准差（高斯分布）' },
  uniform: { label: '均匀分布', desc: '最小值 ~ 最大值 等概率' },
  discrete: { label: '离散概率', desc: '多个数值及其对应概率' },
};

export default function ProjectDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { currentProject, simulations, currentSimulation, setCurrentProject, setSimulations, addVariable, updateVariable, removeVariable, addSimulation, removeSimulation, setCurrentSimulation, setLoading, setError } = useAppStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showVarModal, setShowVarModal] = useState(false);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [running, setRunning] = useState(false);
  const [iterations, setIterations] = useState(10000);
  const [threshold, setThreshold] = useState(0);
  const [runProgress, setRunProgress] = useState(0);

  const [varForm, setVarForm] = useState<Partial<any>>({
    name: '', type: 'custom' as VariableType, distribution: 'triangular' as DistributionType,
    min: '', max: '', mostLikely: '', weight: '', unit: '',
    normalMean: '', normalStdDev: '',
    discreteOptions: [{ value: '', probability: '' }] as unknown as DiscreteOption[],
  });
  const [editForm, setEditForm] = useState<Partial<any>>({});

  const loadProject = async () => {
    setLoading(true);
    try {
      const project = await api.projects.get(id);
      setCurrentProject(project);
      const sims = await api.simulations.listByProject(id);
      setSimulations(sims);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
      alert('加载项目失败');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProject();
    return () => setCurrentProject(null);
  }, [id]);

  const handleAddVariable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProject || !varForm.name) return;
    try {
      const distribution = (varForm.distribution || 'triangular') as DistributionType;
      const payload: any = {
        name: varForm.name,
        type: (varForm.type || 'custom') as VariableType,
        unit: varForm.unit || '',
        weight: Number(varForm.weight == null || varForm.weight === '' ? 1 : varForm.weight),
        distribution,
        min: Number(varForm.min ?? 0),
        max: Number(varForm.max ?? 0),
        mostLikely: Number(varForm.mostLikely ?? 0),
      };

      if (distribution === 'triangular') {
        payload.min = Number(varForm.min);
        payload.max = Number(varForm.max);
        payload.mostLikely = Number(varForm.mostLikely);
        if (!(payload.min < payload.mostLikely && payload.mostLikely < payload.max)) {
          alert('参数必须满足：最小值 < 最可能值 < 最大值');
          return;
        }
      } else if (distribution === 'uniform') {
        payload.min = Number(varForm.min);
        payload.max = Number(varForm.max);
        if (!(payload.min < payload.max)) {
          alert('参数必须满足：最小值 < 最大值');
          return;
        }
      } else if (distribution === 'normal') {
        if (varForm.normalMean === '' || varForm.normalStdDev === '' || Number(varForm.normalStdDev) <= 0) {
          alert('正态分布需要填写均值和正的标准差');
          return;
        }
        payload.normalMean = Number(varForm.normalMean);
        payload.normalStdDev = Number(varForm.normalStdDev);
        payload.min = Number(varForm.min ?? (payload.normalMean - 3 * payload.normalStdDev));
        payload.max = Number(varForm.max ?? (payload.normalMean + 3 * payload.normalStdDev));
        payload.mostLikely = payload.normalMean;
      } else if (distribution === 'discrete') {
        const opts = (varForm.discreteOptions || []) as any[];
        const validOpts = opts.filter(o => o.value !== '' && o.probability !== '' && Number(o.probability) >= 0).map(o => ({
          value: Number(o.value),
          probability: Number(o.probability),
        }));
        if (validOpts.length === 0) {
          alert('请至少填写一个有效的离散选项');
          return;
        }
        const totalProb = validOpts.reduce((s, o) => s + o.probability, 0);
        if (totalProb <= 0) {
          alert('离散概率总和必须大于0');
          return;
        }
        payload.discreteOptions = validOpts;
        const values = validOpts.map(o => o.value);
        payload.min = Math.min(...values);
        payload.max = Math.max(...values);
        const weightedSum = validOpts.reduce((s, o) => s + o.value * o.probability, 0);
        payload.mostLikely = weightedSum / totalProb;
      }

      const v = await api.projects.addVariable(id, payload);
      addVariable(v);
      setShowVarModal(false);
      setVarForm({
        name: '', type: 'custom' as VariableType, distribution: 'triangular' as DistributionType,
        min: '', max: '', mostLikely: '', weight: '', unit: '',
        normalMean: '', normalStdDev: '',
        discreteOptions: [{ value: '', probability: '' }] as unknown as DiscreteOption[],
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : '添加失败');
    }
  };

  const startEdit = (v: any) => {
    setEditingId(v.id);
    const dist = v.distribution || 'triangular';
    setEditForm({
      ...v,
      distribution: dist,
      min: String(v.min),
      max: String(v.max),
      mostLikely: String(v.mostLikely),
      weight: String(v.weight),
      normalMean: v.normalMean !== undefined ? String(v.normalMean) : '',
      normalStdDev: v.normalStdDev !== undefined ? String(v.normalStdDev) : '',
      discreteOptions: v.discreteOptions && v.discreteOptions.length > 0
        ? v.discreteOptions.map((o: DiscreteOption) => ({ value: String(o.value), probability: String(o.probability) }))
        : [{ value: '', probability: '' }],
    });
  };

  const handleSaveEdit = async (vId: string) => {
    try {
      const distribution = (editForm.distribution || 'triangular') as DistributionType;
      const payload: any = {
        ...editForm,
        distribution,
        min: Number(editForm.min ?? 0),
        max: Number(editForm.max ?? 0),
        mostLikely: Number(editForm.mostLikely ?? 0),
        weight: Number(editForm.weight),
      };

      if (distribution === 'triangular') {
        const mn = Number(editForm.min);
        const ml = Number(editForm.mostLikely);
        const mx = Number(editForm.max);
        if (!(mn < ml && ml < mx)) {
          alert('参数必须满足：最小值 < 最可能值 < 最大值');
          return;
        }
        payload.min = mn;
        payload.max = mx;
        payload.mostLikely = ml;
      } else if (distribution === 'uniform') {
        const mn = Number(editForm.min);
        const mx = Number(editForm.max);
        if (!(mn < mx)) {
          alert('参数必须满足：最小值 < 最大值');
          return;
        }
        payload.min = mn;
        payload.max = mx;
      } else if (distribution === 'normal') {
        if (editForm.normalMean === '' || editForm.normalStdDev === '' || Number(editForm.normalStdDev) <= 0) {
          alert('正态分布需要填写均值和正的标准差');
          return;
        }
        payload.normalMean = Number(editForm.normalMean);
        payload.normalStdDev = Number(editForm.normalStdDev);
        payload.min = Number(editForm.min ?? (payload.normalMean - 3 * payload.normalStdDev));
        payload.max = Number(editForm.max ?? (payload.normalMean + 3 * payload.normalStdDev));
        payload.mostLikely = payload.normalMean;
      } else if (distribution === 'discrete') {
        const opts = (editForm.discreteOptions || []) as any[];
        const validOpts = opts.filter(o => o.value !== '' && o.probability !== '' && Number(o.probability) >= 0).map(o => ({
          value: Number(o.value),
          probability: Number(o.probability),
        }));
        if (validOpts.length === 0) {
          alert('请至少填写一个有效的离散选项');
          return;
        }
        const totalProb = validOpts.reduce((s, o) => s + o.probability, 0);
        if (totalProb <= 0) {
          alert('离散概率总和必须大于0');
          return;
        }
        payload.discreteOptions = validOpts;
        const values = validOpts.map(o => o.value);
        payload.min = Math.min(...values);
        payload.max = Math.max(...values);
        const weightedSum = validOpts.reduce((s, o) => s + o.value * o.probability, 0);
        payload.mostLikely = weightedSum / totalProb;
      }

      const v = await api.variables.update(vId, payload);
      updateVariable(v);
      setEditingId(null);
      setEditForm({});
    } catch (err) {
      alert(err instanceof Error ? err.message : '保存失败');
    }
  };

  const handleDeleteVariable = async (vId: string) => {
    if (!confirm('删除此变量？')) return;
    try {
      await api.variables.remove(vId);
      removeVariable(vId);
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除失败');
    }
  };

  const handleRunSimulation = async () => {
    if (!currentProject || currentProject.variables.length === 0) {
      alert('请先添加至少一个变量');
      return;
    }
    setRunning(true);
    setRunProgress(0);
    try {
      const interval = setInterval(() => {
        setRunProgress(p => Math.min(p + Math.random() * 15, 85));
      }, 150);
      const result = await api.simulations.run(id, { iterations, threshold });
      clearInterval(interval);
      setRunProgress(100);
      addSimulation(result);
      setTimeout(() => setRunProgress(0), 800);
    } catch (err) {
      alert(err instanceof Error ? err.message : '模拟失败');
    } finally {
      setRunning(false);
    }
  };

  const handleDeleteSimulation = async (simId: string) => {
    if (!confirm('删除此模拟结果？')) return;
    try {
      await api.simulations.remove(simId);
      removeSimulation(simId);
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除失败');
    }
  };

  const riskLevel = useMemo(() => {
    if (!currentSimulation) return null;
    const p = currentSimulation.lossProbability;
    if (p < 0.1) return { level: '低风险', color: 'text-monte-safe', bg: 'bg-monte-safe/15', border: 'border-monte-safe/40', icon: Sparkles };
    if (p < 0.3) return { level: '中低风险', color: 'text-emerald-300', bg: 'bg-emerald-500/15', border: 'border-emerald-500/40', icon: Info };
    if (p < 0.5) return { level: '中等风险', color: 'text-monte-warn', bg: 'bg-monte-warn/15', border: 'border-monte-warn/40', icon: AlertTriangle };
    return { level: '高风险', color: 'text-monte-danger', bg: 'bg-monte-danger/15', border: 'border-monte-danger/40', icon: AlertTriangle };
  }, [currentSimulation]);

  if (!currentProject) {
    return <div className="flex items-center justify-center h-screen"><div className="text-monte-muted">加载中...</div></div>;
  }

  return (
    <div className="min-h-screen pb-16">
      <header className="sticky top-0 z-30 border-b border-monte-border bg-monte-bg/80 backdrop-blur-lg">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <button onClick={() => navigate('/')} className="p-2 rounded-lg text-monte-muted hover:text-white hover:bg-monte-border transition-all">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-white truncate flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-monte-accent flex-shrink-0" />
                  {currentProject.name}
                </h1>
                <p className="text-xs text-monte-muted truncate">{currentProject.description || '无描述'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowCompareModal(true)} className="btn-secondary text-sm" disabled={simulations.length < 2}>
                <GitCompare className="w-4 h-4" />
                对比
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <section className="xl:col-span-5 space-y-6">
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-monte-accent" />
                  变量管理
                  <span className="badge bg-monte-accent/20 text-monte-accent border border-monte-accent/30 ml-2">
                    {currentProject.variables.length}
                  </span>
                </h2>
                <button onClick={() => setShowVarModal(true)} className="btn-primary text-sm py-1.5">
                  <Plus className="w-4 h-4" />
                  添加变量
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px]">
                  <thead>
                    <tr className="border-b border-monte-border">
                      <th className="th">变量</th>
                      <th className="th">类型</th>
                      <th className="th">分布</th>
                      <th className="th">参数</th>
                      <th className="th">权重</th>
                      <th className="th text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-monte-border/50">
                    {currentProject.variables.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="td text-center text-monte-muted py-10">
                          <div className="flex flex-col items-center gap-2">
                            <Settings className="w-8 h-8 text-monte-muted/50" />
                            <p>暂无变量，点击右上角添加</p>
                          </div>
                        </td>
                      </tr>
                    ) : currentProject.variables.map(v => {
                      const config = VARIABLE_TYPE_CONFIG[v.type];
                      const Icon = config.icon;
                      const dist = v.distribution || 'triangular';
                      const distCfg = DISTRIBUTION_CONFIG[dist];
                      const isEditing = editingId === v.id;
                      return (
                        <tr key={v.id} className="hover:bg-monte-bg/40 transition-colors">
                          <td className="td">
                            {isEditing ? (
                              <input value={editForm.name ?? ''} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="input !py-1 !text-sm" />
                            ) : (
                              <div>
                                <div className="font-medium text-white">{v.name}</div>
                                <div className="text-xs text-monte-muted">{v.unit || '无单位'}</div>
                              </div>
                            )}
                          </td>
                          <td className="td">
                            {isEditing ? (
                              <select value={editForm.type ?? v.type} onChange={e => setEditForm({ ...editForm, type: e.target.value as VariableType })} className="input !py-1 !text-sm">
                                <option value="cost">成本</option>
                                <option value="duration">工期</option>
                                <option value="revenue">收益</option>
                                <option value="custom">自定义</option>
                              </select>
                            ) : (
                              <span className={`badge border ${config.color}`}>
                                <Icon className="w-3 h-3 mr-1" />
                                {config.label}
                              </span>
                            )}
                          </td>
                          <td className="td">
                            {isEditing ? (
                              <select
                                value={editForm.distribution ?? dist}
                                onChange={e => setEditForm({ ...editForm, distribution: e.target.value as DistributionType })}
                                className="input !py-1 !text-sm"
                              >
                                <option value="triangular">三角</option>
                                <option value="normal">正态</option>
                                <option value="uniform">均匀</option>
                                <option value="discrete">离散</option>
                              </select>
                            ) : (
                              <span className="badge border bg-monte-accent/15 text-monte-accent border-monte-accent/30" title={distCfg.desc}>
                                {distCfg.label}
                              </span>
                            )}
                          </td>
                          <td className="td">
                            {isEditing ? (
                              <div className="space-y-2 min-w-[260px]">
                                {((editForm.distribution ?? dist) === 'triangular') && (
                                  <div className="grid grid-cols-3 gap-1.5">
                                    <div>
                                      <div className="text-[10px] text-monte-danger mb-0.5">最小</div>
                                      <input type="text" inputMode="decimal" value={editForm.min ?? ''} onChange={e => { const vv = e.target.value; setEditForm({ ...editForm, min: vv === '' ? '' : Number(vv) }); }} className="input !py-1 !text-xs font-mono !border-monte-danger/50" />
                                    </div>
                                    <div>
                                      <div className="text-[10px] text-monte-accent mb-0.5">最可能</div>
                                      <input type="text" inputMode="decimal" value={editForm.mostLikely ?? ''} onChange={e => { const vv = e.target.value; setEditForm({ ...editForm, mostLikely: vv === '' ? '' : Number(vv) }); }} className="input !py-1 !text-xs font-mono !border-monte-accent/60" />
                                    </div>
                                    <div>
                                      <div className="text-[10px] text-monte-safe mb-0.5">最大</div>
                                      <input type="text" inputMode="decimal" value={editForm.max ?? ''} onChange={e => { const vv = e.target.value; setEditForm({ ...editForm, max: vv === '' ? '' : Number(vv) }); }} className="input !py-1 !text-xs font-mono !border-monte-safe/50" />
                                    </div>
                                  </div>
                                )}
                                {((editForm.distribution ?? dist) === 'uniform') && (
                                  <div className="grid grid-cols-2 gap-1.5">
                                    <div>
                                      <div className="text-[10px] text-monte-danger mb-0.5">最小</div>
                                      <input type="text" inputMode="decimal" value={editForm.min ?? ''} onChange={e => { const vv = e.target.value; setEditForm({ ...editForm, min: vv === '' ? '' : Number(vv) }); }} className="input !py-1 !text-xs font-mono !border-monte-danger/50" />
                                    </div>
                                    <div>
                                      <div className="text-[10px] text-monte-safe mb-0.5">最大</div>
                                      <input type="text" inputMode="decimal" value={editForm.max ?? ''} onChange={e => { const vv = e.target.value; setEditForm({ ...editForm, max: vv === '' ? '' : Number(vv) }); }} className="input !py-1 !text-xs font-mono !border-monte-safe/50" />
                                    </div>
                                  </div>
                                )}
                                {((editForm.distribution ?? dist) === 'normal') && (
                                  <div className="grid grid-cols-2 gap-1.5">
                                    <div>
                                      <div className="text-[10px] text-monte-accent mb-0.5">均值 μ</div>
                                      <input type="text" inputMode="decimal" value={editForm.normalMean ?? ''} onChange={e => { const vv = e.target.value; setEditForm({ ...editForm, normalMean: vv === '' ? '' : Number(vv) }); }} className="input !py-1 !text-xs font-mono !border-monte-accent/60" />
                                    </div>
                                    <div>
                                      <div className="text-[10px] text-purple-300 mb-0.5">标准差 σ</div>
                                      <input type="text" inputMode="decimal" value={editForm.normalStdDev ?? ''} onChange={e => { const vv = e.target.value; setEditForm({ ...editForm, normalStdDev: vv === '' ? '' : Number(vv) }); }} className="input !py-1 !text-xs font-mono !border-purple-400/50" />
                                    </div>
                                  </div>
                                )}
                                {((editForm.distribution ?? dist) === 'discrete') && (
                                  <div className="space-y-1.5">
                                    {(editForm.discreteOptions || []).map((opt: any, idx: number) => (
                                      <div key={idx} className="grid grid-cols-2 gap-1.5 items-center">
                                        <input type="text" inputMode="decimal" placeholder="数值" value={opt.value ?? ''} onChange={e => {
                                          const vv = e.target.value;
                                          const newOpts = [...(editForm.discreteOptions || [])];
                                          newOpts[idx] = { ...newOpts[idx], value: vv === '' ? '' : Number(vv) };
                                          setEditForm({ ...editForm, discreteOptions: newOpts });
                                        }} className="input !py-1 !text-xs font-mono" />
                                        <div className="flex items-center gap-1">
                                          <input type="text" inputMode="decimal" placeholder="概率" value={opt.probability ?? ''} onChange={e => {
                                            const vv = e.target.value;
                                            const newOpts = [...(editForm.discreteOptions || [])];
                                            newOpts[idx] = { ...newOpts[idx], probability: vv === '' ? '' : Number(vv) };
                                            setEditForm({ ...editForm, discreteOptions: newOpts });
                                          }} className="input !py-1 !text-xs font-mono !flex-1" />
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const newOpts = [...(editForm.discreteOptions || [])];
                                              newOpts.splice(idx, 1);
                                              setEditForm({ ...editForm, discreteOptions: newOpts.length > 0 ? newOpts : [{ value: '', probability: '' }] });
                                            }}
                                            className="p-1 rounded text-monte-muted hover:text-monte-danger hover:bg-monte-danger/10"
                                          >
                                            <X className="w-3 h-3" />
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                    <button
                                      type="button"
                                      onClick={() => setEditForm({ ...editForm, discreteOptions: [...(editForm.discreteOptions || []), { value: '', probability: '' }] })}
                                      className="text-xs text-monte-accent hover:text-monte-accent/80 flex items-center gap-1"
                                    >
                                      <Plus className="w-3 h-3" /> 添加选项
                                    </button>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="font-mono text-xs">
                                {dist === 'triangular' && (
                                  <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                                    <span className="text-monte-danger">min={formatNumber(v.min, 0)}</span>
                                    <span className="text-monte-accent font-medium">ml={formatNumber(v.mostLikely, 0)}</span>
                                    <span className="text-monte-safe">max={formatNumber(v.max, 0)}</span>
                                  </div>
                                )}
                                {dist === 'uniform' && (
                                  <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                                    <span className="text-monte-danger">[{formatNumber(v.min, 0)}</span>
                                    <span className="text-monte-muted">,</span>
                                    <span className="text-monte-safe">{formatNumber(v.max, 0)}]</span>
                                  </div>
                                )}
                                {dist === 'normal' && (
                                  <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                                    <span className="text-monte-accent">μ={formatNumber(v.normalMean ?? v.mostLikely, 0)}</span>
                                    <span className="text-purple-300">σ={formatNumber(v.normalStdDev ?? (v.max - v.min) / 6, 1)}</span>
                                  </div>
                                )}
                                {dist === 'discrete' && (
                                  <div className="flex flex-wrap gap-1">
                                    {(v.discreteOptions || []).map((o: DiscreteOption, i: number) => (
                                      <span key={i} className="px-1.5 py-0.5 rounded bg-monte-bg/70 border border-monte-border/60">
                                        <span className="text-monte-accent">{formatNumber(o.value, 0)}</span>
                                        <span className="text-monte-muted mx-0.5">:</span>
                                        <span className="text-monte-safe">{formatNumber(o.probability, 2)}</span>
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="td">
                            {isEditing ? (
                              <input type="text" inputMode="decimal" value={editForm.weight ?? ''} onChange={e => { const vv = e.target.value; setEditForm({ ...editForm, weight: vv === '' ? '' : Number(vv) }); }} className="input !py-1 !text-sm font-mono w-20" />
                            ) : (
                              <span className={`font-mono font-medium ${v.weight < 0 ? 'text-monte-danger' : 'text-monte-safe'}`}>
                                {v.weight > 0 ? '+' : ''}{formatNumber(v.weight, 1)}
                              </span>
                            )}
                          </td>
                          <td className="td text-right whitespace-nowrap">
                            {isEditing ? (
                              <div className="inline-flex gap-1">
                                <button onClick={() => handleSaveEdit(v.id)} className="p-1.5 rounded-md text-monte-safe hover:bg-monte-safe/15 transition-colors" title="保存">
                                  <Save className="w-4 h-4" />
                                </button>
                                <button onClick={() => { setEditingId(null); setEditForm({}); }} className="p-1.5 rounded-md text-monte-muted hover:bg-monte-border transition-colors" title="取消">
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="inline-flex gap-1">
                                <button onClick={() => startEdit(v)} className="p-1.5 rounded-md text-monte-muted hover:text-monte-accent hover:bg-monte-accent/15 transition-colors" title="编辑">
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleDeleteVariable(v.id)} className="p-1.5 rounded-md text-monte-muted hover:text-monte-danger hover:bg-monte-danger/15 transition-colors" title="删除">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card border-monte-accent/30 shadow-glow">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-monte-accent" />
                模拟控制
              </h2>
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">模拟次数</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={100}
                        max={100000}
                        step={100}
                        value={iterations}
                        onChange={e => setIterations(Number(e.target.value))}
                        disabled={running}
                        className="flex-1 accent-monte-accent"
                      />
                      <div className="w-24">
                        <input
                          type="number"
                          value={iterations}
                          onChange={e => setIterations(Math.max(100, Math.min(100000, Number(e.target.value))))}
                          disabled={running}
                          className="input font-mono !py-1.5 text-right"
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="label">风险阈值 (低于此值视为亏损)</label>
                    <input
                      type="number"
                      step="any"
                      value={threshold}
                      onChange={e => setThreshold(Number(e.target.value))}
                      disabled={running}
                      className="input font-mono"
                    />
                  </div>
                </div>

                {running && runProgress > 0 && (
                  <div className="h-2 bg-monte-bg rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-monte-accent to-monte-accent2 transition-all duration-200"
                      style={{ width: `${runProgress}%` }}
                    />
                  </div>
                )}

                <button
                  onClick={handleRunSimulation}
                  disabled={running || currentProject.variables.length === 0}
                  className={`w-full py-3 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2 ${
                    running || currentProject.variables.length === 0
                      ? 'bg-monte-border cursor-not-allowed opacity-60'
                      : 'bg-gradient-to-r from-monte-accent via-monte-accent2 to-purple-500 hover:shadow-glow hover:-translate-y-0.5 active:translate-y-0'
                  }`}
                >
                  {running ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      模拟运行中 ({formatNumber(runProgress, 0)}%)
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5 fill-current" />
                      运行蒙特卡洛模拟 ({formatNumber(iterations, 0)} 次)
                    </>
                  )}
                </button>

                {currentProject.variables.length === 0 && (
                  <p className="text-xs text-monte-warn text-center flex items-center justify-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    请先添加变量再运行模拟
                  </p>
                )}
              </div>
            </div>

            <SimulationHistory
              simulations={simulations}
              currentId={currentSimulation?.id || null}
              onSelect={setCurrentSimulation}
              onDelete={handleDeleteSimulation}
            />
          </section>

          <section className="xl:col-span-7 space-y-6">
            {!currentSimulation ? (
              <div className="card h-[600px] flex flex-col items-center justify-center text-center">
                <div className="w-24 h-24 mb-6 rounded-3xl bg-gradient-to-br from-monte-accent/20 to-monte-accent2/20 border border-monte-accent/30 flex items-center justify-center">
                  <BarChart3 className="w-12 h-12 text-monte-accent" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">等待模拟结果</h3>
                <p className="text-monte-muted max-w-md mb-6">
                  在左侧配置变量参数并点击「运行蒙特卡洛模拟」，<br />模拟完成后此处将显示详细的风险分析结果。
                </p>
                <div className="grid grid-cols-3 gap-3 text-xs max-w-lg">
                  <div className="p-3 rounded-xl bg-monte-bg/50 border border-monte-border/50">
                    <div className="text-monte-accent font-semibold mb-1">📊 分布直方图</div>
                    <div className="text-monte-muted">结果分布可视化</div>
                  </div>
                  <div className="p-3 rounded-xl bg-monte-bg/50 border border-monte-border/50">
                    <div className="text-monte-warn font-semibold mb-1">⚠️ 风险指标</div>
                    <div className="text-monte-muted">亏损概率与VaR</div>
                  </div>
                  <div className="p-3 rounded-xl bg-monte-bg/50 border border-monte-border/50">
                    <div className="text-monte-safe font-semibold mb-1">🎯 敏感性分析</div>
                    <div className="text-monte-muted">关键变量识别</div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className={`card border-2 ${riskLevel?.border}`}>
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl ${riskLevel?.bg}`}>
                        {riskLevel?.icon && <riskLevel.icon className={`w-6 h-6 ${riskLevel.color}`} />}
                      </div>
                      <div>
                        <div className="text-sm text-monte-muted mb-0.5">当前风险评估</div>
                        <div className={`text-xl font-bold ${riskLevel?.color}`}>{riskLevel?.level}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-monte-muted mb-0.5">模拟名称</div>
                      <div className="text-sm font-medium text-white">{currentSimulation.runName}</div>
                      <div className="text-xs text-monte-muted mt-0.5 flex items-center justify-end gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(currentSimulation.timestamp).toLocaleString('zh-CN')}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-5">
                    <div className="p-4 rounded-xl bg-gradient-to-br from-monte-danger/15 to-transparent border border-monte-danger/30">
                      <div className="text-xs text-monte-muted uppercase tracking-wider mb-1">亏损概率</div>
                      <div className="text-3xl font-bold font-mono text-monte-danger">{formatPercentage(currentSimulation.lossProbability)}</div>
                      <div className="text-xs text-monte-muted mt-1">低于阈值 {formatNumber(currentSimulation.threshold, 0)}</div>
                    </div>
                    <div className="p-4 rounded-xl bg-gradient-to-br from-monte-warn/15 to-transparent border border-monte-warn/30">
                      <div className="text-xs text-monte-muted uppercase tracking-wider mb-1">95% VaR</div>
                      <div className="text-3xl font-bold font-mono text-monte-warn">{formatNumber(currentSimulation.var95)}</div>
                      <div className="text-xs text-monte-muted mt-1">最坏5%情景下的净值</div>
                    </div>
                    <div className="p-4 rounded-xl bg-gradient-to-br from-monte-safe/15 to-transparent border border-monte-safe/30">
                      <div className="text-xs text-monte-muted uppercase tracking-wider mb-1">期望净现值</div>
                      <div className={`text-3xl font-bold font-mono ${currentSimulation.mean >= 0 ? 'text-monte-safe' : 'text-monte-danger'}`}>
                        {currentSimulation.mean >= 0 ? '+' : ''}{formatNumber(currentSimulation.mean)}
                      </div>
                      <div className="text-xs text-monte-muted mt-1">标准差 ±{formatNumber(currentSimulation.stdDev)}</div>
                    </div>
                  </div>

                  <StatsCards sim={currentSimulation} />
                </div>

                <HistogramChart sim={currentSimulation} />

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <SensitivityChart sim={currentSimulation} />
                  <div className="card">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <Info className="w-5 h-5 text-monte-accent" />
                      分位数详情
                    </h3>
                    <div className="space-y-3">
                      {[
                        { k: 'p5', label: '5% 分位数 (悲观)', color: 'text-monte-danger', desc: '95% 概率结果高于此值' },
                        { k: 'p25', label: '25% 分位数 (保守)', color: 'text-monte-warn', desc: '75% 概率结果高于此值' },
                        { k: 'p50', label: '50% 分位数 (中位)', color: 'text-monte-accent', desc: '最可能的中位数结果' },
                        { k: 'p75', label: '75% 分位数 (乐观)', color: 'text-emerald-400', desc: '25% 概率结果高于此值' },
                        { k: 'p95', label: '95% 分位数 (最佳)', color: 'text-monte-safe', desc: '5% 概率结果高于此值' },
                      ].map((p: any) => (
                        <div key={p.k} className="flex items-center justify-between p-3 rounded-lg bg-monte-bg/50 border border-monte-border/50">
                          <div className="flex-1">
                            <div className={`text-sm font-medium ${p.color}`}>{p.label}</div>
                            <div className="text-xs text-monte-muted">{p.desc}</div>
                          </div>
                          <div className={`text-2xl font-bold font-mono ${p.color}`}>
                            {formatNumber((currentSimulation.percentiles as any)[p.k])}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </main>

      {showVarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="card w-full max-w-lg shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setShowVarModal(false)} className="absolute top-4 right-4 p-1.5 rounded-lg text-monte-muted hover:text-white hover:bg-monte-border transition-all">
              <X className="w-4 h-4" />
            </button>
            <h2 className="text-xl font-bold text-white mb-5 flex items-center gap-2">
              <Plus className="w-5 h-5 text-monte-accent" />
              添加变量
            </h2>
            <form onSubmit={handleAddVariable} className="space-y-4">
              <div>
                <label className="label">变量名称 *</label>
                <input
                  type="text"
                  value={varForm.name || ''}
                  onChange={e => setVarForm({ ...varForm, name: e.target.value })}
                  placeholder="例如：建造成本"
                  className="input"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">变量类型</label>
                  <select
                    value={varForm.type || 'custom'}
                    onChange={e => {
                      const t = e.target.value as VariableType;
                      const cfg = VARIABLE_TYPE_CONFIG[t];
                      setVarForm({ ...varForm, type: t, weight: cfg.defaultWeight, unit: varForm.unit || cfg.defaultUnit });
                    }}
                    className="input"
                  >
                    <option value="cost">成本 (权重 -1)</option>
                    <option value="duration">工期 (权重 -1)</option>
                    <option value="revenue">收益 (权重 +1)</option>
                    <option value="custom">自定义</option>
                  </select>
                </div>
                <div>
                  <label className="label">抽样分布</label>
                  <select
                    value={varForm.distribution || 'triangular'}
                    onChange={e => {
                      const d = e.target.value as DistributionType;
                      setVarForm({ ...varForm, distribution: d });
                    }}
                    className="input"
                  >
                    <option value="triangular">三角分布</option>
                    <option value="normal">正态分布</option>
                    <option value="uniform">均匀分布</option>
                    <option value="discrete">离散概率</option>
                  </select>
                </div>
              </div>
              <div className="text-xs text-monte-muted -mt-2">
                {DISTRIBUTION_CONFIG[(varForm.distribution || 'triangular') as DistributionType].desc}
              </div>
              <div>
                <label className="label">单位</label>
                <input
                  type="text"
                  value={varForm.unit || ''}
                  onChange={e => setVarForm({ ...varForm, unit: e.target.value })}
                  placeholder="万元、天、人..."
                  className="input"
                />
              </div>

              <div className="p-4 rounded-xl bg-monte-bg/50 border border-monte-border space-y-4">
                {((varForm.distribution || 'triangular') === 'triangular') && (
                  <>
                    <div className="text-xs text-monte-muted font-semibold">三角分布参数（三点估算）</div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="label text-monte-danger">最小值</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={varForm.min ?? ''}
                          onChange={e => {
                            const v = e.target.value;
                            setVarForm({ ...varForm, min: v === '' ? '' : Number(v) });
                          }}
                          placeholder="最小范围"
                          className="input font-mono !border-monte-danger/50"
                        />
                      </div>
                      <div>
                        <label className="label text-monte-accent">最可能值</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={varForm.mostLikely ?? ''}
                          onChange={e => {
                            const v = e.target.value;
                            setVarForm({ ...varForm, mostLikely: v === '' ? '' : Number(v) });
                          }}
                          placeholder="最可能发生"
                          className="input font-mono !border-monte-accent/60"
                        />
                      </div>
                      <div>
                        <label className="label text-monte-safe">最大值</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={varForm.max ?? ''}
                          onChange={e => {
                            const v = e.target.value;
                            setVarForm({ ...varForm, max: v === '' ? '' : Number(v) });
                          }}
                          placeholder="最大范围"
                          className="input font-mono !border-monte-safe/50"
                        />
                      </div>
                    </div>
                  </>
                )}

                {((varForm.distribution || 'triangular') === 'uniform') && (
                  <>
                    <div className="text-xs text-monte-muted font-semibold">均匀分布参数（等概率区间）</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label text-monte-danger">最小值</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={varForm.min ?? ''}
                          onChange={e => {
                            const v = e.target.value;
                            setVarForm({ ...varForm, min: v === '' ? '' : Number(v) });
                          }}
                          placeholder="最小范围"
                          className="input font-mono !border-monte-danger/50"
                        />
                      </div>
                      <div>
                        <label className="label text-monte-safe">最大值</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={varForm.max ?? ''}
                          onChange={e => {
                            const v = e.target.value;
                            setVarForm({ ...varForm, max: v === '' ? '' : Number(v) });
                          }}
                          placeholder="最大范围"
                          className="input font-mono !border-monte-safe/50"
                        />
                      </div>
                    </div>
                  </>
                )}

                {((varForm.distribution || 'triangular') === 'normal') && (
                  <>
                    <div className="text-xs text-monte-muted font-semibold">正态分布参数（高斯分布）</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label text-monte-accent">均值 μ</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={varForm.normalMean ?? ''}
                          onChange={e => {
                            const v = e.target.value;
                            setVarForm({ ...varForm, normalMean: v === '' ? '' : Number(v) });
                          }}
                          placeholder="例如: 100"
                          className="input font-mono !border-monte-accent/60"
                        />
                      </div>
                      <div>
                        <label className="label text-purple-300">标准差 σ</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={varForm.normalStdDev ?? ''}
                          onChange={e => {
                            const v = e.target.value;
                            setVarForm({ ...varForm, normalStdDev: v === '' ? '' : Number(v) });
                          }}
                          placeholder="正数，例如: 15"
                          className="input font-mono !border-purple-400/50"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-monte-muted mt-1">
                      可选：设置 min/max 截断范围（留空默认 ±3σ）
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label text-monte-muted text-xs">截断最小值（可选）</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={varForm.min ?? ''}
                          onChange={e => {
                            const v = e.target.value;
                            setVarForm({ ...varForm, min: v === '' ? '' : Number(v) });
                          }}
                          placeholder="可选"
                          className="input font-mono text-xs"
                        />
                      </div>
                      <div>
                        <label className="label text-monte-muted text-xs">截断最大值（可选）</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={varForm.max ?? ''}
                          onChange={e => {
                            const v = e.target.value;
                            setVarForm({ ...varForm, max: v === '' ? '' : Number(v) });
                          }}
                          placeholder="可选"
                          className="input font-mono text-xs"
                        />
                      </div>
                    </div>
                  </>
                )}

                {((varForm.distribution || 'triangular') === 'discrete') && (
                  <>
                    <div className="text-xs text-monte-muted font-semibold flex items-center justify-between">
                      <span>离散概率选项（数值 + 概率权重）</span>
                      <button
                        type="button"
                        onClick={() => setVarForm({ ...varForm, discreteOptions: [...(varForm.discreteOptions || []), { value: '', probability: '' }] })}
                        className="text-monte-accent hover:text-monte-accent/80 flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> 添加
                      </button>
                    </div>
                    <div className="space-y-2">
                      {(varForm.discreteOptions || []).map((opt: any, idx: number) => (
                        <div key={idx} className="grid grid-cols-2 gap-2 items-center">
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="数值"
                            value={opt.value ?? ''}
                            onChange={e => {
                              const vv = e.target.value;
                              const newOpts = [...(varForm.discreteOptions || [])];
                              newOpts[idx] = { ...newOpts[idx], value: vv === '' ? '' : Number(vv) };
                              setVarForm({ ...varForm, discreteOptions: newOpts });
                            }}
                            className="input font-mono !py-2"
                          />
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="概率权重"
                              value={opt.probability ?? ''}
                              onChange={e => {
                                const vv = e.target.value;
                                const newOpts = [...(varForm.discreteOptions || [])];
                                newOpts[idx] = { ...newOpts[idx], probability: vv === '' ? '' : Number(vv) };
                                setVarForm({ ...varForm, discreteOptions: newOpts });
                              }}
                              className="input font-mono !py-2 !flex-1"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const newOpts = [...(varForm.discreteOptions || [])];
                                newOpts.splice(idx, 1);
                                setVarForm({ ...varForm, discreteOptions: newOpts.length > 0 ? newOpts : [{ value: '', probability: '' }] });
                              }}
                              className="p-1.5 rounded-lg text-monte-muted hover:text-monte-danger hover:bg-monte-danger/10"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-monte-muted">
                      提示：概率权重会自动归一化，总和可以不为 1
                    </p>
                  </>
                )}

                <div className="pt-2 border-t border-monte-border/60">
                  <label className="label">权重 (符号决定加减，可输入小数)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={varForm.weight ?? ''}
                    onChange={e => {
                      const v = e.target.value;
                      setVarForm({ ...varForm, weight: v === '' ? '' : Number(v) });
                    }}
                    placeholder="如: +1 或 -1 或 0.5"
                    className="input font-mono"
                  />
                  <p className="text-xs text-monte-muted mt-1">
                    正权重 = 加到结果 (如收益)，负权重 = 从结果扣除 (如成本)
                  </p>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowVarModal(false)} className="btn-secondary flex-1">
                  取消
                </button>
                <button
                  type="submit"
                  disabled={
                    !varForm.name ||
                    ((varForm.distribution || 'triangular') === 'triangular' && (typeof varForm.min !== 'number' || typeof varForm.max !== 'number' || typeof varForm.mostLikely !== 'number')) ||
                    ((varForm.distribution || 'triangular') === 'uniform' && (typeof varForm.min !== 'number' || typeof varForm.max !== 'number')) ||
                    ((varForm.distribution || 'triangular') === 'normal' && (varForm.normalMean === '' || varForm.normalStdDev === '' || Number(varForm.normalStdDev) <= 0))
                  }
                  className="btn-primary flex-1"
                >
                  添加变量
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCompareModal && (
        <CompareModal
          simulations={simulations}
          projectId={id}
          onClose={() => setShowCompareModal(false)}
          onCreated={(compareId) => navigate(`/project/${id}/compare/${compareId}`)}
        />
      )}
    </div>
  );
}
