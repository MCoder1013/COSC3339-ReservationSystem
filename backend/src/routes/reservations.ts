import { Router, Request, Response } from 'express';
import {
  addReservation, deleteReservation, getAllReservationsWithDetails, getReservationsByUser,
  updateReservation, getUserRoomReservations, getUserItemReservations, addGuestsToReservation,
  getUserRoomCruises
} from '../reservations.js';
import { getCurrentStaffAssignedCruises, getUserById, validateGuestEmails } from '../users.js';
import { authRequired, } from './index.js';
import { sql } from '../database.js';


const router = Router();

router.post("/reservations", authRequired, async (req: Request, res: Response) => {
  // Need a safe way to get the user id and add it in since we are not getting that from the frontend
  const { cabin_id, resource_id, staff_id, start_time, end_time, quantity_reserved, additional_guest_emails, cruise_id } = req.body;
  const user_id = req.user!.id;

  const normalizedCruiseId = cruise_id == null ? null : Number(cruise_id);
  if ((cabin_id != null || resource_id != null) && (normalizedCruiseId == null || Number.isNaN(normalizedCruiseId))) {
    return res.status(400).json({ error: 'cruise_id is required for room and item reservations' });
  }

  try {
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
        cabin_id: cabin_id ?? null,
        resource_id: resource_id ?? null,
        staff_id: staff_id ?? null,
        cruise_id: normalizedCruiseId,
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
      cabin_id: cabin_id ?? null,
      resource_id: resource_id ?? null,
      staff_id: staff_id ?? null,
      cruise_id: normalizedCruiseId,
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

// RES-POST
router.post("/reservations/:id", authRequired, async (req: Request, res: Response) => {
  const reservationId = Number(req.params.id);
  const user_id = req.user!.id;

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

// RES-DELETE - deletes reservation by ID
router.delete('/reservations/:id', authRequired, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const user_id = req.user!.id;

  if (isNaN(id)) {
    return res.status(400).json({ message: "Invalid ID format" });
  }
  try {
    await deleteReservation(id, user_id);

    res.json({ message: "reservation deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "failed to delete reservation" });
  }
});

// Get all reservations with full details (includes joined room and resource data)
// RES-GET - gets all reservations for everyone full information  
router.get("/reservations", authRequired, async (req: Request, res: Response) => {
  try {
    const result = await getAllReservationsWithDetails();

    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching all reservations:", error);
    res.status(500).json({ error: "Failed to fetch reservations" });
  }
});

// RES-GET-reservations - gets reservations for authenticated user 
router.get("/my-reservations", authRequired, async (req: Request, res: Response) => {
  const user_id = req.user!.id;

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

// RES-GET-ITEMS - gets items for authenticated user
router.get('/reservations/items', authRequired, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const items = await getUserItemReservations(userId);
    res.json(items);
  } catch (error) {
    console.error('Error fetching user item reservations:', error);
    res.status(500).json({ error: 'Failed to load item reservations' });
  }
});

// RES-GET-ROOMS - gets current rooms reservation for authenticated user
router.get('/reservations/rooms', authRequired, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const rooms = await getUserRoomReservations(userId);
    res.json(rooms);
  } catch (error) {
    console.error('Error fetching user room reservations:', error);
    res.status(500).json({ error: 'Failed to load room reservations' });
  }
});

router.get('/reservations/eligible-cruises', authRequired, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.user_role === 'staff') {
      const cruises = await sql`
        SELECT role
        FROM staff
        WHERE staff_id = ${userId}
        LIMIT 1
      `;

      const isAdmin = cruises[0]?.role?.trim().toLowerCase() === 'admin';

      if (isAdmin) {
        const allCruises = await sql`
          SELECT
            id,
            cruise_name,
            ship_name,
            departure_date,
            return_date,
            max_passengers
          FROM cruises
          WHERE return_date >= CURRENT_DATE
          ORDER BY departure_date ASC
        `;
        return res.json(allCruises);
      }

      const assignedCruises = await getCurrentStaffAssignedCruises(userId);
      return res.json(assignedCruises);
    }

    const cruises = await getUserRoomCruises(userId);
    res.json(cruises);
  } catch (error) {
    console.error('Error fetching eligible cruises:', error);
    res.status(500).json({ error: 'Failed to load eligible cruises' });
  }
});

export default router;