import { pullLoyalty, addPoints, deductPoints } from '../gambling.js';
import { Router, Request, Response } from 'express';
import { adminRequired, authRequired, staffRequired } from './index.js';

const router = Router();


router.get('/loyalty', authRequired, async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "Not authenticated" });
        }

        const userId = req.user.id;
        const data = await pullLoyalty(userId);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: "Failed to load loyalty points" });
    }
});

router.post('/loyalty/add', authRequired, async (req: Request, res: Response) => {
    const { amount } = req.body;

    try {
        if (!req.user) {
            return res.status(401).json({ error: "Not authenticated" });
        }

        const userId = req.user.id;
        const updated = await addPoints(userId, amount);
        res.json(updated);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

router.post('/loyalty/deduct', authRequired, async (req: Request, res: Response) => {
    const { amount } = req.body;

    try {
        if (!req.user) {
            return res.status(401).json({ error: "Not authenticated" });
        }

        const userId = req.user.id;
        const updated = await deductPoints(userId, amount);
        res.json(updated);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

export default router;