import { Router, Request, Response } from 'express';
import { authRequired, adminRequired } from './index.js';
import { getEventRatings, getRoomRatings, isRatingValueValid, saveEventRating, saveRoomRating, getAllRatings } from '../ratings.js';

const router = Router();

router.post('/ratings', authRequired, async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const targetType = String(req.body.targetType ?? req.body.target_type ?? '').toLowerCase();
    const targetId = Number(req.body.targetId ?? req.body.target_id);
    const rating = Number(req.body.rating);
    const review = req.body.review ?? req.body.comment ?? null;

    if (targetType !== 'room' && targetType !== 'event') {
        return res.status(400).json({ error: 'Please choose a valid review target.' });
    }

    if (!Number.isInteger(targetId) || targetId < 1) {
        return res.status(400).json({ error: 'Please provide a valid target id.' });
    }

    if (!isRatingValueValid(rating)) {
        return res.status(400).json({ error: 'Rating must be a whole number between 1 and 5.' });
    }

    try {
        const saved = targetType === 'room'
            ? await saveRoomRating(targetId, userId, rating, review)
            : await saveEventRating(targetId, userId, rating, review);

        res.status(201).json({
            message: 'Review saved successfully.',
            review: saved,
        });
    } catch (error: any) {
        console.error('Failed to save review:', error);
        res.status(400).json({ error: error.message || 'Could not save the review.' });
    }
});

router.get("/ratings", adminRequired, async (req: Request, res: Response) => {
  try {
    const ratings = await getAllRatings();
    res.json(ratings);
  } catch (err) {
    console.error("Failed to fetch ratings:", err);
    res.status(500).json({ error: "Failed to fetch ratings" });
  }
});

router.get('/ratings/rooms', authRequired, async (req: Request, res: Response) => {
    const cabinId = Number(req.query.cabinId);
    const cruiseId = Number(req.query.cruiseId);

    if (!Number.isInteger(cabinId) || cabinId < 1 || !Number.isInteger(cruiseId) || cruiseId < 1) {
        return res.status(400).json({ error: 'Please provide a valid cabinId and cruiseId.' });
    }

    try {
        const reviews = await getRoomRatings(cabinId, cruiseId);
        res.json(reviews);
    } catch (error) {
        console.error('Failed to load room reviews:', error);
        res.status(500).json({ error: 'Unable to load room reviews right now.' });
    }
});

router.get('/ratings/events/:id', authRequired, async (req: Request, res: Response) => {
    const eventId = Number(req.params.id);

    if (!Number.isInteger(eventId) || eventId < 1) {
        return res.status(400).json({ error: 'Please provide a valid event id.' });
    }

    try {
        const reviews = await getEventRatings(eventId);
        res.json(reviews);
    } catch (error) {
        console.error('Failed to load event reviews:', error);
        res.status(500).json({ error: 'Unable to load event reviews right now.' });
    }
});

export default router;
