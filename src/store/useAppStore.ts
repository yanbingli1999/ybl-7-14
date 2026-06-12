import { create } from 'zustand';
import type { Project, ProjectWithVariables, Variable, SimulationResult } from '../../shared/types.js';

interface AppState {
  projects: Array<Project & { variableCount: number; simulationCount: number; lastSimulationAt: string | null }>;
  currentProject: ProjectWithVariables | null;
  simulations: SimulationResult[];
  currentSimulation: SimulationResult | null;
  loading: boolean;
  error: string | null;
  setLoading: (v: boolean) => void;
  setError: (v: string | null) => void;
  setProjects: (p: AppState['projects']) => void;
  setCurrentProject: (p: ProjectWithVariables | null) => void;
  addVariable: (v: Variable) => void;
  updateVariable: (v: Variable) => void;
  removeVariable: (id: string) => void;
  setSimulations: (s: SimulationResult[]) => void;
  setCurrentSimulation: (s: SimulationResult | null) => void;
  addSimulation: (s: SimulationResult) => void;
  removeSimulation: (id: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  projects: [],
  currentProject: null,
  simulations: [],
  currentSimulation: null,
  loading: false,
  error: null,
  setLoading: (v) => set({ loading: v }),
  setError: (v) => set({ error: v }),
  setProjects: (p) => set({ projects: p }),
  setCurrentProject: (p) => set({ currentProject: p, currentSimulation: null, simulations: [] }),
  addVariable: (v) =>
    set((s) => ({
      currentProject: s.currentProject ? { ...s.currentProject, variables: [...s.currentProject.variables, v] } : null,
    })),
  updateVariable: (v) =>
    set((s) => ({
      currentProject: s.currentProject
        ? { ...s.currentProject, variables: s.currentProject.variables.map((x) => (x.id === v.id ? v : x)) }
        : null,
    })),
  removeVariable: (id) =>
    set((s) => ({
      currentProject: s.currentProject
        ? { ...s.currentProject, variables: s.currentProject.variables.filter((x) => x.id !== id) }
        : null,
    })),
  setSimulations: (s) => set({ simulations: s, currentSimulation: s[0] || null }),
  setCurrentSimulation: (s) => set({ currentSimulation: s }),
  addSimulation: (s) =>
    set((st) => ({
      simulations: [s, ...st.simulations],
      currentSimulation: s,
    })),
  removeSimulation: (id) =>
    set((st) => ({
      simulations: st.simulations.filter((s) => s.id !== id),
      currentSimulation: st.currentSimulation?.id === id ? null : st.currentSimulation,
    })),
}));
