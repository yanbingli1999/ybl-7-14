import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createStore } from '../storage/fileStore.js';
import type { CompareRecord, CreateCompareDto, SimulationResult } from '../../shared/types.js';

const router = Router();
const comparisonsStore = createStore<CompareRecord>('comparisons');
const simulationsStore = createStore<SimulationResult>('simulations');

router.get('/project/:projectId', (req: Request, res: Response) => {
  const projectId = req.params.projectId;
  const records = comparisonsStore
    .filter(c => c.projectId === projectId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json(records);
});

router.get('/:id', (req: Request, res: Response) => {
  const record = comparisonsStore.getById(req.params.id);
  if (!record) {
    res.status(404).json({ error: '对比记录不存在' });
    return;
  }

  const simulations = record.simulationIds
    .map(id => simulationsStore.getById(id))
    .filter((s): s is SimulationResult => s !== undefined);

  res.json({ ...record, simulations });
});

router.post('/project/:projectId', (req: Request, res: Response) => {
  const projectId = req.params.projectId;
  const dto = req.body as CreateCompareDto;

  if (!dto.simulationIds || dto.simulationIds.length < 2) {
    res.status(400).json({ error: '请至少选择2个模拟结果进行对比' });
    return;
  }

  const record: CompareRecord = {
    id: uuidv4(),
    projectId,
    name: dto.name?.trim() || `对比 ${new Date().toLocaleString('zh-CN')}`,
    simulationIds: dto.simulationIds,
    createdAt: new Date().toISOString(),
  };

  const created = comparisonsStore.create(record);
  res.status(201).json(created);
});

router.delete('/:id', (req: Request, res: Response) => {
  const existing = comparisonsStore.getById(req.params.id);
  if (!existing) {
    res.status(404).json({ error: '对比记录不存在' });
    return;
  }

  comparisonsStore.delete(req.params.id);
  res.json({ success: true });
});

export default router;
