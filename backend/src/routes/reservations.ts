import { Router, Request, Response } from 'express';
import { getUserItemReservations, addReservation, deleteReservation, pullReservations, getAllReservationsWithDetails, getReservationsByUser, 
    updateReservation, getUserRoomReservations, validateGuestEmails, addGuestsToReservation } from '../database.js';
import { getAuthenticatedUserId } from './auth.js';

const router = Router();

router.post("/reservations", async (req: Request, res: Response) => {
    // Need a safe way to get the user id and add it in since we are not getting that from the frontend
  const { cruise_id, cabin_id, resource_id, staff_id, start_time, end_time, quantity_reserved, additional_guest_emails } = req.body;
    const user_id = getAuthenticatedUserId(req);

    if (!user_id) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      if (cabin_id && !cruise_id) {
        return res.status(400).json({ error: "cruise_id is required for room reservations" });
      }

        // Validate additional guest emails if provided
        if (additional_guest_emails && Array.isArray(additional_guest_emails) && additional_guest_emails.length > 0) {
            const validation = await validateGuestEmails(additional_guest_emails);
            
            if (!validation.valid) {
                return res.status(400).json({
                    error: `The following email(s) do not exist in the system: ${validation.invalidEmails.join(', ')}. All guests must have registered accounts.`
                });
            }

            // Create the reservation
            const reservationId = await addReservation({
                user_id,
              cruise_id: cruise_id ?? null,
                cabin_id: cabin_id ??  null,
                resource_id: resource_id ?? null,
                staff_id: staff_id ?? null,
                start_time,
                end_time,
                quantity_reserved
            });

            // Add primary user to reservation_groups table
            await addGuestsToReservation(reservationId, [user_id]);
            
            // Add additional guests to reservation_groups table
            await addGuestsToReservation(reservationId, validation.userIds);

            return res.status(201).json({
                message: "Reservation added successfully with additional guests",
                reservationId
            });
        }

        // No additional guests - proceed with regular reservation
        const reservationId = await addReservation({
            user_id,
          cruise_id: cruise_id ?? null,
            cabin_id: cabin_id ??  null,
            resource_id: resource_id ?? null,
            staff_id: staff_id ?? null,
            start_time,
            end_time,
            quantity_reserved
        });

        res.status(201).json({
            message: "Reservation added successfully",
            reservationId
        });
    } catch (error: any) {
        console.error(error);
        res.status(400).json({
            error: error.message || "Error when adding reservation"
        });
    }
})

router.post("/reservations/:id", async (req: Request, res: Response) => {
  const reservationId = Number(req.params.id);
  const user_id = getAuthenticatedUserId(req);

  if (!user_id) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (isNaN(reservationId)) {
    return res.status(400).json({ error: "Invalid reservation ID" });
  }

  const { start_time, end_time, quantity_reserved } = req.body;

  if (start_time !== undefined) {
    const start = new Date(start_time);
    if (isNaN(start.getTime())) {
      return res.status(400).json({ error: "Invalid start_time" });
    }
    if (start <= new Date()) {
      return res.status(400).json({ error: "start_time must be in the future" });
    }
  }

  if (end_time !== undefined) {
    const end = new Date(end_time);
    if (isNaN(end.getTime())) {
      return res.status(400).json({ error: "Invalid end_time" });
    }
  }

  if (start_time !== undefined && end_time !== undefined) {
    if (new Date(end_time) <= new Date(start_time)) {
      return res.status(400).json({ error: "end_time must be after start_time" });
    }
  }

  if (quantity_reserved !== undefined) {
    if (!Number.isInteger(quantity_reserved) || quantity_reserved < 1) {
      return res.status(400).json({ error: "quantity_reserved must be a positive integer" });
    }
  }

  try {
    const updated = await updateReservation(reservationId, user_id, {
      start_time,
      end_time,
      quantity_reserved,
    });

    res.json({
      message: "Reservation updated successfully",
      reservation: updated,
    });
  } catch (error: any) {
    console.error("Update error:", error);
    res.status(400).json({
      error: error.message || "Failed to update reservation",
    });
  }
});

router.delete('/reservations/:id', async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID format" });
    }
    try {
        await deleteReservation({ reservationId: id, userId });

        res.json({ message: "reservation deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: "failed to delete reservation" });
    }
});

// Get all reservations with full details (includes joined room and resource data)
router.get("/reservations", async (req: Request, res: Response) => {
    try {
    const result = await getAllReservationsWithDetails();

    const cabinId = req.query.cabin_id ? Number(req.query.cabin_id) : undefined;
    const resourceId = req.query.resource_id ? Number(req.query.resource_id) : undefined;
    const cruiseId = req.query.cruise_id ? Number(req.query.cruise_id) : undefined;

    const filtered = result.filter((reservation: any) => {
      const cabinMatches = cabinId === undefined || reservation.cabin_id === cabinId;
      const resourceMatches = resourceId === undefined || reservation.resource_id === resourceId;
      const cruiseMatches = cruiseId === undefined || reservation.cruise_id === cruiseId;
      return cabinMatches && resourceMatches && cruiseMatches;
    });

    res.status(200).json(filtered);
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

router.get('/reservations/rooms', async (req: Request, res: Response) => {
    try {
        const userId = getAuthenticatedUserId(req);
        
        if (!userId) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const rooms = await getUserRoomReservations(userId);
        res.json(rooms);
    } catch (error) {
        console.error('Error fetching user room reservations:', error);
        res.status(500).json({ error: 'Failed to load room reservations' });
    }
});

router.delete('/admin/reservations/:id', async (req: Request, res: Response) => {
  const reservationId = Number(req.params.id);
  const userId = getAuthenticatedUserId(req);

  if(!userId) return res.status(401).json({error: "Unauthorized" });
  if (isNaN(reservationId)) return res.status(400).json({error: "Invalid ID format"});

  try {
    const user = await getUserById(userId); 

    if(!user || user.user_role !== 'staff') {
      return res.status(403).json({ error: "Forbidden: staff only" }); 

    }
    await deleteReservation({ reservationId: reservationId }); 
    res.json({ message: "reservation deleted successfully "}); 

  } catch (error) {
    res.status(500).json({ error: "failed to delete reservation"});
  }
});

export default router;