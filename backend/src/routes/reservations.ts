import { Router, Request, Response } from 'express';
import { getUserItemReservations, addReservation, deleteReservation, pullReservations, getAllReservationsWithDetails, getReservationsByUser } from '../database.js';
import { getAuthenticatedUserId } from './auth.js';

const router = Router();

router.post("/reservations", async (req: Request, res: Response) => {
    // Need a safe way to get the user id and add it in since we are not getting that from the frontend
    const { cabin_id, resource_id, staff_id, start_time, end_time, quantity_reserved } = req.body;
    const user_id = getAuthenticatedUserId(req);

    if (!user_id) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    try {
        const result = await addReservation({
            user_id,
            cabin_id: cabin_id ??  null,
            resource_id: resource_id ?? null,
            staff_id: staff_id ?? null,
            start_time,
            end_time,
            quantity_reserved
        });

        res.status(201).json({
            message: "Reservation added successfully",
            reservationId: (result as any).insertId
        });
    } catch (error: any) {
        console.error(error);
        res.status(400).json({
            error: error.message || "Error when adding reservation"
        });
    }
})

router.delete('/reservations/:id', async (req: Request, res: Response) => {
    const id = Number(req.params.id);

    if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID format" });
    }
    try {
        const result: any = await deleteReservation(id);

        res.json({ message: "reservation deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: "failed to delete reservation" });
    }
});

// Get all reservations with full details (includes joined room and resource data)
router.get("/reservations", async (req: Request, res: Response) => {
    try {
        const result = await getAllReservationsWithDetails();
        res.status(200).json(result);
    } catch (error) {
        console.error("Error fetching all reservations:", error);
        res.status(500).json({ error: "Failed to fetch reservations" });
    }
});

router.get("/my-reservations", async (req: Request, res: Response) => {
  const user_id = getAuthenticatedUserId(req);

  if (!user_id) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const reservations = await getReservationsByUser(user_id);
    res.json(reservations);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch reservations" });
  }
});


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