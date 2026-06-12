import { Router, Request, Response } from 'express';
import { createStore } from '../storage/fileStore.js';
import type { Variable, UpdateVariableDto } from '../../shared/types.js';

const router = Router();
const variablesStore = createStore<Variable>('variables');
const projectsStore = createStore<{ id: string; updatedAt?: string }>('projects');

router.put('/:id', (req: Request, res: Response) => {
  const dto = req.body as UpdateVariableDto;
  const existing = variablesStore.getById(req.params.id);
  if (!existing) {
    res.status(404).json({ error: '变量不存在' });
    return;
  }

  const updates: Partial<Variable> = {};

  if (dto.name !== undefined) {
    if (dto.name.trim() === '') {
      res.status(400).json({ error: '变量名称不能为空' });
      return;
    }
    updates.name = dto.name.trim();
  }
  if (dto.type !== undefined) updates.type = dto.type;
  if (dto.unit !== undefined) updates.unit = dto.unit.trim();
  if (dto.weight !== undefined) updates.weight = Number(dto.weight);

  const min = dto.min !== undefined ? Number(dto.min) : existing.min;
  const max = dto.max !== undefined ? Number(dto.max) : existing.max;
  const mostLikely = dto.mostLikely !== undefined ? Number(dto.mostLikely) : existing.mostLikely;

  if (min >= max) {
    res.status(400).json({ error: '最小值必须小于最大值' });
    return;
  }
  if (mostLikely < min || mostLikely > max) {
    res.status(400).json({ error: '最可能值必须在最小值和最大值之间' });
    return;
  }

  if (dto.min !== undefined) updates.min = min;
  if (dto.max !== undefined) updates.max = max;
  if (dto.mostLikely !== undefined) updates.mostLikely = mostLikely;

  const updated = variablesStore.update(req.params.id, updates);
  if (updated) {
    projectsStore.update(existing.projectId, { updatedAt: new Date().toISOString() });
  }
  res.json(updated);
});

router.delete('/:id', (req: Request, res: Response) => {
  const existing = variablesStore.getById(req.params.id);
  if (!existing) {
    res.status(404).json({ error: '变量不存在' });
    return;
  }

  const projectId = existing.projectId;
  variablesStore.delete(req.params.id);
  projectsStore.update(projectId, { updatedAt: new Date().toISOString() });

  res.json({ success: true });
});

export default router;
