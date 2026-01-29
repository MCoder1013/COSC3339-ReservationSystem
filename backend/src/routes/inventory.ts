import { Router, Request, Response } from 'express';
import { pullResources, pullRooms, addRoom, addResources } from '../database.js'; 

const router = Router(); 

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



// delete from inventory features
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


export default router; 