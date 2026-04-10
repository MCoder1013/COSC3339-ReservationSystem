import { Router, Request, Response } from 'express';
import { pullRooms, addRoom, deleteRoom } from '../rooms.js';
import { pullResources, addResources, deleteResource, countRemaining } from '../resources.js';
import { pullStaff, addStaff, deleteStaff } from '../staff.js';
import { pullCruises } from '../cruises.js';
import { adminRequired, authRequired, staffRequired } from './index.js';

const router = Router();


// ROOMS 

// ROOMS-GET - gets all rooms 
router.get('/rooms', authRequired, async (req: Request, res: Response) => {
    try {
        const rooms = await pullRooms();
        res.json(rooms);
    } catch (error) {
        res.status(500).json({ error: "Failed to load rooms" })
    }
});


// ROOMS-POST 
router.post("/rooms", adminRequired, async (req: Request, res: Response) => {
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

// ROOMS-DELETE - deletes room by cabin number
router.delete('/rooms/:cabin_number', adminRequired, async (req: Request, res: Response) => {
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

// STAFF 

// STAFF-DELETE - deletes staff by id 
router.delete('/staff/:id', adminRequired, async (req: Request, res: Response) => {
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

// STAFF-POST
router.post("/staff", staffRequired, async (req: Request, res: Response) => {
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

// STAFF-GET - gets all staff 
router.get('/staff', authRequired, async (req: Request, res: Response) => {
    try {
        const staff = await pullStaff();
        res.json(staff);
    } catch (error) {
        res.status(500).json({ error: "Failed to load staff members" })
    }
});

// RESOURCES -- RES

// CRUISES-GET - gets all cruises
router.get('/cruises', authRequired, async (_req: Request, res: Response) => {
    try {
        const cruises = await pullCruises();
        res.json(cruises);
    } catch (error) {
        res.status(500).json({ error: 'Failed to load cruises' });
    }
});

// RES-GETAVAILABLE - gets available at current time  
router.get('/resources/availability', authRequired, async (req: Request, res: Response) => {
    try {
        const { resource_id, start_time, end_time, cruise_id } = req.query;

        const remaining = await countRemaining(
            {
                resource_id: Number(resource_id),
                start_time: String(start_time),
                end_time: String(end_time),
                cruise_id: cruise_id == null ? null : Number(cruise_id)
            }
        );

        res.json({ remaining });

    } catch (err) {
        res.status(400).json({ error: "failed to get availabiltiy" });
    }
});

// RES-DELETE
router.delete('/resources/:name', adminRequired, async (req: Request, res: Response) => {
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

// RES-POST
router.post("/resources", adminRequired, async (req: Request, res: Response) => {
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


// RES-GETALL - gets all resources in inventory with total count 
router.get('/resources', authRequired, async (req: Request, res: Response) => {
    try {
        const items = await pullResources();
        res.json(items);
    } catch (error) {
        res.status(500).json({ error: "Failed to load inventory" });
    }
});


export default router; 