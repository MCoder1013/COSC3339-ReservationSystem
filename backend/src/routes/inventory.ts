import { Router, Request, Response } from 'express';
import { pullResources, pullRooms, addRoom, addResources, deleteRoom, deleteResource } from '../database.js'; 
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

// add to inventory features 
router.post("/rooms", async(req: Request, res: Response) => {
    const{ cabin_number, deck, type, capacity, status } = req.body; 

    try {
        const result = await addRoom(cabin_number, deck, type, capacity, status);
        res.status(201).json({
            message: "Room added successfully!", 
            roomId: (result as any).insertId
        }); 
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error when adding a room"});
    }
}); 



router.post("/resources", async(req: Request, res: Response) => {
    const{ name, category, quantity, status } = req.body;

    try{ 
        const result = await addResources(name, category, quantity, status); 
        res.status(201).json({
            message: "Resource added",
            roomId: (result as any).insertId
        });
    } catch(error) {
        console.error(error);
        res.status(500).json({ error: "Error when adding a resource"});
    }
});

// delete from inventory features
router.delete('/rooms/:id', async (req: Request, res: Response) => {
    const idParam = req.params.id as string; 
    const roomId = parseInt(idParam);

    try {
        const result: any = await deleteRoom(roomId); 

        if(result.affectedRows === 0) {
            return res.status(404).json({message: "Room not found" })
        }
        res.json({ message: "room deleted successfully"});
    } catch (error) {
        res.status(500).json({error: "failed to delete room"});
    }
});


router.delete('/rooms/:id', async (req: Request, res: Response) => {
    const idParam = req.params.id as string; 
    const resourceId = parseInt(idParam);

    try {
        const result: any = await deleteResource(resourceId); 

        if(result.affectedRows === 0) {
            return res.status(404).json({message: "Resource not found" })
        }
        res.json({ message: "resource deleted successfully"});
    } catch (error) {
        res.status(500).json({error: "failed to delete resource"});
    }
});

export default router; 