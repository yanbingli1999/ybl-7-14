import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Trash2, Play, FolderKanban, Activity, Calendar, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useAppStore } from '@/store/useAppStore';
import type { Project } from '../../shared/types.js';

type ProjectListItem = Project & {
  variableCount: number;
  simulationCount: number;
  lastSimulationAt: string | null;
};

export default function Home() {
  const navigate = useNavigate();
  const { projects, setProjects, setLoading, setError } = useAppStore();
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const list = await api.projects.list();
      setProjects(list as unknown as ProjectListItem[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setSubmitting(true);
    try {
      const created = await api.projects.create({ name: newName.trim(), description: newDesc.trim() });
      setShowModal(false);
      setNewName('');
      setNewDesc('');
      navigate(`/project/${created.id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('确定要删除此项目吗？所有变量和模拟结果将被永久删除。')) return;
    setDeletingId(id);
    try {
      await api.projects.remove(id);
      loadProjects();
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除失败');
    } finally {
      setDeletingId(null);
    }
  };

  const totalSims = projects.reduce((s, p) => s + (p as any).simulationCount, 0);
  const totalVars = projects.reduce((s, p) => s + (p as any).variableCount, 0);

  return (
    <div className="min-h-screen">
      <header className="relative overflow-hidden border-b border-monte-border">
        <div className="absolute inset-0 bg-gradient-to-b from-monte-accent/10 via-transparent to-transparent pointer-events-none" />
        <div className="relative container mx-auto px-6 py-12">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-monte-accent/10 border border-monte-accent/30 mb-4">
                <Activity className="w-4 h-4 text-monte-accent" />
                <span className="text-xs font-medium text-monte-accent uppercase tracking-wider">蒙特卡洛风险分析</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-white via-indigo-100 to-purple-200 bg-clip-text text-transparent mb-3 font-mono">
                风险量化工作台
              </h1>
              <p className="text-monte-muted text-lg max-w-2xl">
                通过蒙特卡洛模拟方法，量化项目的成本、工期和收益风险。可视化结果分布、识别关键变量、辅助科学决策。
              </p>
            </div>
            <div className="flex gap-4">
              <div className="card card-hover min-w-[120px] text-center">
                <div className="text-3xl font-bold text-white font-mono">{projects.length}</div>
                <div className="text-xs text-monte-muted mt-1">项目总数</div>
              </div>
              <div className="card card-hover min-w-[120px] text-center">
                <div className="text-3xl font-bold text-monte-accent font-mono">{totalSims}</div>
                <div className="text-xs text-monte-muted mt-1">累计模拟</div>
              </div>
              <div className="card card-hover min-w-[120px] text-center">
                <div className="text-3xl font-bold text-monte-safe font-mono">{totalVars}</div>
                <div className="text-xs text-monte-muted mt-1">变量总数</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-3">
              <FolderKanban className="w-6 h-6 text-monte-accent" />
              我的项目
            </h2>
            <p className="text-sm text-monte-muted">创建项目开始蒙特卡洛风险模拟</p>
          </div>
          <button onClick={() => setShowModal(true)} className="btn-primary">
            <Plus className="w-4 h-4" />
            新建项目
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="card text-center py-20">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-monte-accent/10 border border-monte-accent/30 flex items-center justify-center">
              <FolderKanban className="w-10 h-10 text-monte-accent" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">还没有项目</h3>
            <p className="text-monte-muted mb-6 max-w-md mx-auto">
              创建一个新项目，添加成本、工期、收益等变量，设置范围后开始蒙特卡洛模拟分析。
            </p>
            <button onClick={() => setShowModal(true)} className="btn-primary">
              <Plus className="w-4 h-4" />
              创建第一个项目
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {(projects as ProjectListItem[]).map(p => (
              <Link
                key={p.id}
                to={`/project/${p.id}`}
                className="card card-hover group block relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-monte-accent to-monte-accent2 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-white mb-1 truncate group-hover:text-monte-accent transition-colors">{p.name}</h3>
                    <p className="text-sm text-monte-muted line-clamp-2 min-h-[40px]">{p.description || '暂无描述'}</p>
                  </div>
                  <button
                    onClick={(e) => handleDelete(p.id, e)}
                    disabled={deletingId === p.id}
                    className="p-2 rounded-lg text-monte-muted hover:text-monte-danger hover:bg-monte-danger/10 transition-all ml-3 flex-shrink-0"
                    title="删除项目"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="text-center py-2 rounded-lg bg-monte-bg/50">
                    <div className="text-lg font-bold text-monte-accent font-mono">{p.variableCount}</div>
                    <div className="text-[10px] text-monte-muted uppercase tracking-wider">变量</div>
                  </div>
                  <div className="text-center py-2 rounded-lg bg-monte-bg/50">
                    <div className="text-lg font-bold text-monte-safe font-mono">{p.simulationCount}</div>
                    <div className="text-[10px] text-monte-muted uppercase tracking-wider">模拟</div>
                  </div>
                  <div className="text-center py-2 rounded-lg bg-monte-bg/50">
                    <div className="text-lg font-bold text-white font-mono">
                      {p.variableCount > 0 ? (p.variableCount > 0 && p.simulationCount > 0 ? '✓' : '⋯') : '!'}
                    </div>
                    <div className="text-[10px] text-monte-muted uppercase tracking-wider">状态</div>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1 text-monte-muted">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{new Date(p.updatedAt || p.createdAt).toLocaleDateString('zh-CN')}</span>
                  </div>
                  <div className="flex items-center gap-1 text-monte-accent opacity-0 group-hover:opacity-100 transition-opacity">
                    <Play className="w-3.5 h-3.5" />
                    <span>进入项目</span>
                  </div>
                </div>
                {p.lastSimulationAt && (
                  <div className="mt-3 pt-3 border-t border-monte-border/50 text-xs text-monte-muted flex items-center gap-1.5">
                    <Activity className="w-3 h-3 text-monte-safe" />
                    最近模拟: {new Date(p.lastSimulationAt).toLocaleString('zh-CN')}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </main>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="card w-full max-w-md shadow-2xl relative">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-monte-muted hover:text-white hover:bg-monte-border transition-all"
            >
              <X className="w-4 h-4" />
            </button>
            <h2 className="text-xl font-bold text-white mb-5 flex items-center gap-2">
              <Plus className="w-5 h-5 text-monte-accent" />
              新建项目
            </h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="label">项目名称 *</label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="例如：新办公楼建造项目"
                  className="input"
                  autoFocus
                />
              </div>
              <div>
                <label className="label">项目描述</label>
                <textarea
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  placeholder="项目的简单介绍，用于快速识别..."
                  rows={3}
                  className="input resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">
                  取消
                </button>
                <button type="submit" disabled={submitting || !newName.trim()} className="btn-primary flex-1">
                  {submitting ? '创建中...' : '创建项目'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
