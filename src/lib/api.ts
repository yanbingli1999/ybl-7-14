import type {
  Project, ProjectWithVariables, Variable, SimulationResult, CompareRecord,
  CreateProjectDto, UpdateProjectDto, CreateVariableDto, UpdateVariableDto,
  RunSimulationDto, CreateCompareDto,
} from '../../shared/types.js';

const API_BASE = '/api';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `请求失败 (${res.status})`);
  }
  return data as T;
}

export const api = {
  projects: {
    list: () => request<Array<Project & { variableCount: number; simulationCount: number; lastSimulationAt: string | null }>>('/projects'),
    get: (id: string) => request<ProjectWithVariables>(`/projects/${id}`),
    create: (dto: CreateProjectDto) => request<Project>('/projects', { method: 'POST', body: JSON.stringify(dto) }),
    update: (id: string, dto: UpdateProjectDto) => request<Project>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(dto) }),
    remove: (id: string) => request<{ success: boolean }>(`/projects/${id}`, { method: 'DELETE' }),
    addVariable: (projectId: string, dto: CreateVariableDto) =>
      request<Variable>(`/projects/${projectId}/variables`, { method: 'POST', body: JSON.stringify(dto) }),
  },
  variables: {
    update: (id: string, dto: UpdateVariableDto) =>
      request<Variable>(`/variables/${id}`, { method: 'PUT', body: JSON.stringify(dto) }),
    remove: (id: string) => request<{ success: boolean }>(`/variables/${id}`, { method: 'DELETE' }),
  },
  simulations: {
    listByProject: (projectId: string) => request<SimulationResult[]>(`/simulations/project/${projectId}`),
    get: (id: string) => request<SimulationResult>(`/simulations/${id}`),
    run: (projectId: string, dto: RunSimulationDto) =>
      request<SimulationResult>(`/simulations/project/${projectId}`, { method: 'POST', body: JSON.stringify(dto) }),
    remove: (id: string) => request<{ success: boolean }>(`/simulations/${id}`, { method: 'DELETE' }),
  },
  compare: {
    listByProject: (projectId: string) => request<CompareRecord[]>(`/compare/project/${projectId}`),
    get: (id: string) => request<CompareRecord & { simulations: SimulationResult[] }>(`/compare/${id}`),
    create: (projectId: string, dto: CreateCompareDto) =>
      request<CompareRecord>(`/compare/project/${projectId}`, { method: 'POST', body: JSON.stringify(dto) }),
    remove: (id: string) => request<{ success: boolean }>(`/compare/${id}`, { method: 'DELETE' }),
  },
};
