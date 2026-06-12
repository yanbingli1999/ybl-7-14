import { Router } from 'express';
import projectsRouter from './projects.js';
import variablesRouter from './variables.js';
import simulationsRouter from './simulations.js';
import compareRouter from './compare.js';

const router = Router();

router.use('/projects', projectsRouter);
router.use('/variables', variablesRouter);
router.use('/simulations', simulationsRouter);
router.use('/compare', compareRouter);

export default router;
