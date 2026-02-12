import { Router, Request, Response } from 'express';
import { getUserItemReservations } from '../database.js';
import { getAuthenticatedUserId } from './auth.js';

const router = Router();

// Get all item reservations for the authenticated user
router.get('/reservations/items', async (req: Request, res: Response) => {
    try {
        const userId = getAuthenticatedUserId(req);
        
        if (!userId) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const items = await getUserItemReservations(userId);
        res.json(items);
    } catch (error) {
        console.error('Error fetching user item reservations:', error);
        res.status(500).json({ error: 'Failed to load item reservations' });
    }
});

export default router;
