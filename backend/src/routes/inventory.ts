import {Router, Request, Response } from 'express';
import { pullResources } from '../database.js'; 

const router = Router(); 
// get all items from the resources table
router.get('/', async(req: Request, res: Response) => {
    try{ 
        const items = await pullResources(); 
        res.json(items); 
    } catch (error) {
        res.status(500).json({error: "Failed to load inventory" });
    }
});


export default router; 