import { Router, Request, Response } from 'express';
import { pullResources, pullRooms, pullCruises, addRoom, addResources, deleteRoom, deleteResource, addStaff, pullStaff, deleteStaff, countRemaining, isAdminUser } from '../database.js';
import { getAuthenticatedUserId } from './auth.js';

const router = Router();

async function ensureAdmin(req: Request, res: Response): Promise<boolean> {
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return false;
    }

    const isAdmin = await isAdminUser(userId);
    if (!isAdmin) {
        res.status(403).json({ error: 'Forbidden: admin only' });
        return false;
    }

    return true;
}

// pull items form database
// get all items from the resources table
router.get('/resources', async (req: Request, res: Response) => {
    try {
        const items = await pullResources();
        res.json(items);
    } catch (error) {
        res.status(500).json({ error: "Failed to load inventory" });
    }
});

router.get('/rooms', async (req: Request, res: Response) => {
    try {
        const rooms = await pullRooms();
        res.json(rooms);
    } catch (error) {
        res.status(500).json({ error: "Failed to load rooms" })
    }
});

router.get('/cruises', async (_req: Request, res: Response) => {
    try {
        const cruises = await pullCruises();
        res.json(cruises);
    } catch (error) {
        res.status(500).json({ error: "Failed to load cruises" })
    }
});

router.get('/staff', async (req: Request, res: Response) => {
    try {
        const staff = await pullStaff();
        res.json(staff);
    } catch (error) {
        res.status(500).json({ error: "Failed to load staff members" })
    }
});

// add to inventory features 
router.post("/rooms", async (req: Request, res: Response) => {
    if (!(await ensureAdmin(req, res))) {
        return;
    }

    const { cabin_number, deck, type, capacity, status } = req.body;

    try {
        const roomId = await addRoom({ cabin_number, deck, type, capacity, status });
        res.status(201).json({
            message: "Room added successfully!",
            roomId
        });
    } catch (error: any) {
        console.error(error);
        res.status(400).json({ error: "Error when adding a room" });
    }
});

router.post("/resources", async (req: Request, res: Response) => {
    if (!(await ensureAdmin(req, res))) {
        return;
    }

    const { name, category, quantity, status } = req.body;

    try {
        const resourceId = await addResources(name, category, quantity, status);
        res.status(201).json({
            message: "Resource added",
            resourceId
        });
    } catch (error: any) {
        console.error(error);
        res.status(400).json({ error: "Error when adding a resource" });
    }
});

router.post("/staff", async (req: Request, res: Response) => {
    const { name, role, email, shift } = req.body;

    try {
        const staffId = await addStaff({ name, role, email, shift });
        res.status(201).json({
            message: "Staff member added",
            staffId
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error adding staff member" })
    }
});

// delete from inventory features
router.delete('/rooms/:cabin_number', async (req: Request, res: Response) => {
    if (!(await ensureAdmin(req, res))) {
        return;
    }

    const cabinNumber = req.params.cabin_number as string;

    try {
        const deletedRoomId = await deleteRoom(cabinNumber);
        if (deletedRoomId === undefined) {
            return res.status(404).json({ message: "Room not found" })
        }

        res.json({ message: "room deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: "failed to delete room" });
    }
});


router.delete('/resources/:name', async (req: Request, res: Response) => {
    if (!(await ensureAdmin(req, res))) {
        return;
    }

    const name = req.params.name as string;

    try {
        const resourceId = await deleteResource(name);
        if (resourceId !== undefined) {
            return res.status(404).json({ message: "Resource not found" })
        }

        res.json({ message: "resource deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: "failed to delete resource" });
    }
});

router.delete('/staff/:id', async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID format" });
    }

    try {
        const found = await deleteStaff(id);

        if (found === undefined) {
            return res.status(404).json({ message: "staff member not found" })
        }
        res.json({ message: "staff member deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: "failed to delete staff member" });
    }
});

router.get('/resources/availability', async(req: Request, res: Response) => {
    try {
                const { resource_id, cruise_id, start_time, end_time } = req.query;

        const remaining = await countRemaining(
      {
        resource_id: Number(resource_id),
                cruise_id: cruise_id ? Number(cruise_id) : undefined,
        start_time: String(start_time),
        end_time: String(end_time)
      }
    );

    res.json({ remaining });

    } catch (err) {
    res.status(400).json({ error: "failed to get availabiltiy"});
  }
});

export default router; 