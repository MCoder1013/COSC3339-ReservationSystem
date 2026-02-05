import { Router, Request, Response } from 'express';
import { pullResources, pullRooms, addRoom, addResources, deleteRoom, deleteResource, addStaff, pullStaff, deleteStaff } from '../database.js'; 
import { getAuthenticatedUserId } from './auth.js';

const router = Router(); 

// pull items form database
// get all items from the resources table
router.get('/resources', async(req: Request, res: Response) => {
    try{ 
        const items = await pullResources(); 
        res.json(items); 
    } catch (error) {
        res.status(500).json({error: "Failed to load inventory" });
    }
});

router.get('/rooms', async(req: Request, res: Response) => {
    try {
        const rooms = await pullRooms(); 
        res.json(rooms); 
    } catch (error) {
        res.status(500).json({error: "Failed to load rooms"})
    }
});

router.get('/staff', async(req: Request, res: Response) => {
    try {
        const staff = await pullStaff();
        res.json(staff); 

    } catch (error) {
        res.status(500).json({error: "Failed to load staff members"})
    }
});

// add to inventory features 
router.post("/rooms", async(req: Request, res: Response) => {
    const{ cabin_number, deck, type, capacity, status } = req.body; 

    try {
        const result = await addRoom(cabin_number, deck, type, capacity, status);
        res.status(201).json({
            message: "Room added successfully!", 
            roomId: (result as any).insertId
        }); 
    } catch (error: any) {
        console.error(error);
        res.status(400).json({ error: error.message || "Error when adding a room"});
    }
}); 

router.post("/resources", async(req: Request, res: Response) => {
    const{ name, category, quantity, status } = req.body;

    try{ 
        const result = await addResources(name, category, quantity, status); 
        res.status(201).json({
            message: "Resource added",
            resourceId: (result as any).insertId
        });
    } catch(error: any) {
        console.error(error);
        res.status(400).json({ error: error.message || "Error when adding a resource"});
    }
});

router.post("/staff", async(req: Request, res: Response) =>  { 
    const{ id, name, role, email, shift } = req.body; 

    try {
        const result = await addStaff(id, name, role, email, shift); 
        res.status(201).json({
            message: "Staff member added", 
            staffId: (result as any).insertId
        });

    } catch(error) {
        console.error(error); 
        res.status(500).json({ error: "Error adding staff member"})
    }
});

// delete from inventory features
router.delete('/rooms/:cabin_number', async (req: Request, res: Response) => {
    const cabin_number = req.params.cabin_number as string; 

    try {
        const result: any = await deleteRoom(cabin_number); 

        if(result.affectedRows === 0) {
            return res.status(404).json({message: "Room not found" })
        }
        res.json({ message: "room deleted successfully"});
    } catch (error) {
        res.status(500).json({error: "failed to delete room"});
    }
});


router.delete('/resources/:name', async (req: Request, res: Response) => {
    const name = req.params.name as string; 

    try {
        const result: any = await deleteResource(name); 

        if(result.affectedRows === 0) {
            return res.status(404).json({message: "Resource not found" })
        }
        res.json({ message: "resource deleted successfully"});
    } catch (error) {
        res.status(500).json({error: "failed to delete resource"});
    }
});

router.delete('/staff/:id', async (req: Request, res: Response) => {
    const id = Number(req.params.id); 

    if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID format" });
    }
    try {
        const result: any = await deleteStaff(id); 

        if(result.affectedRows === 0) {
            return res.status(404).json({message: "staff member not found" })
        }
        res.json({ message: "staff member deleted successfully"});
    } catch (error) {
        res.status(500).json({error: "failed to delete staff member"});
    }
});


export default router; 