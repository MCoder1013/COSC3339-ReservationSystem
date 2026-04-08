import { Router, Request, Response } from 'express';
import {
    cancelPackageEvent,
    createPackageEvent,
    getPackageEventById,
    joinPackageEvent,
    listActivePackageEvents,
    listJoinedPackageEvents,
    updatePackageEvent,
    type PackageEventInput,
} from '../packages.js';
import { getUserById } from '../users.js';
import { getAuthenticatedUserId } from './auth.js';

const router = Router();

function parseEventInput(body: any): PackageEventInput {
    const itemRequirements = Array.isArray(body.item_requirements)
        ? body.item_requirements.map((item: any) => ({
            resource_id: Number(item.resource_id),
            quantity_required: Number(item.quantity_required),
        }))
        : [];

    const staffIds = Array.isArray(body.staff_ids)
        ? body.staff_ids.map((staffId: any) => Number(staffId))
        : [];

    return {
        cruise_id: Number(body.cruise_id),
        name: String(body.name ?? '').trim(),
        description: String(body.description ?? '').trim(),
        capacity: Number(body.capacity),
        start_time: String(body.start_time ?? ''),
        end_time: String(body.end_time ?? ''),
        staff_ids: staffIds.filter((staffId: number) => !Number.isNaN(staffId)),
        item_requirements: itemRequirements.filter(
            (item: { resource_id: number; quantity_required: number }) =>
                !Number.isNaN(item.resource_id) && !Number.isNaN(item.quantity_required)
        ),
    };
}

function validateBasicInput(input: PackageEventInput): string | null {
    if (!Number.isInteger(input.cruise_id) || input.cruise_id < 1) return 'A valid cruise must be selected.';
    if (!input.name) return 'Event name is required.';
    if (!input.description) return 'Event description is required.';
    if (!Number.isInteger(input.capacity) || input.capacity < 1) return 'Capacity must be at least 1.';

    const start = new Date(input.start_time);
    const end = new Date(input.end_time);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return 'Start and end times must be valid dates.';
    }

    if (end <= start) {
        return 'End time must be after start time.';
    }

    if (input.staff_ids.length === 0) {
        return 'At least one staff member must be assigned.';
    }

    if (input.item_requirements.length === 0) {
        return 'At least one required item must be added.';
    }

    for (const item of input.item_requirements) {
        if (!Number.isInteger(item.resource_id) || item.resource_id < 1) {
            return 'Invalid item selection.';
        }
        if (!Number.isInteger(item.quantity_required) || item.quantity_required < 1) {
            return 'Each item quantity must be at least 1.';
        }
    }

    return null;
}

async function getRoleForRequest(req: Request) {
    const userId = getAuthenticatedUserId(req);
    if (!userId) return null;

    const user = await getUserById(userId);
    if (!user) return null;

    return {
        userId,
        role: user.user_role as string,
    };
}

function canCreateEvent(role: string) {
    return role === 'staff' || role === 'admin';
}

function canManageEvent(role: string, creatorId: number, userId: number) {
    if (role === 'admin') return true;
    if (role === 'staff' && creatorId === userId) return true;
    return false;
}

router.get('/packages/events', async (req: Request, res: Response) => {
    const cruiseIdParam = req.query.cruise_id;
    const cruiseId = cruiseIdParam == null ? undefined : Number(cruiseIdParam);
    if (cruiseIdParam != null && Number.isNaN(cruiseId)) {
        return res.status(400).json({ error: 'Please provide a valid cruise ID.' });
    }

    try {
        const userId = getAuthenticatedUserId(req);
        const events = await listActivePackageEvents(userId, cruiseId);
        res.json(events);
    } catch (error) {
        console.error('Failed to list package events:', error);
        res.status(500).json({ error: 'Unable to load package events right now.' });
    }
});

router.get('/packages/my-events', async (req: Request, res: Response) => {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
        return res.status(401).json({ error: 'Please sign in to continue.' });
    }

    try {
        const events = await listJoinedPackageEvents(userId);
        res.json(events);
    } catch (error) {
        console.error('Failed to list joined package events:', error);
        res.status(500).json({ error: 'Unable to load your package events right now.' });
    }
});

router.get('/packages/events/:id', async (req: Request, res: Response) => {
    const eventId = Number(req.params.id);
    if (Number.isNaN(eventId)) {
        return res.status(400).json({ error: 'Please provide a valid event ID.' });
    }

    try {
        const event: any = await getPackageEventById(eventId);
        if (!event) {
            return res.status(404).json({ error: 'This event could not be found.' });
        }

        if (event.status === 'Cancelled') {
            return res.status(404).json({ error: 'This event could not be found.' });
        }

        res.json(event);
    } catch (error) {
        console.error('Failed to get package event:', error);
        res.status(500).json({ error: 'Unable to load event details right now.' });
    }
});

router.post('/packages/events', async (req: Request, res: Response) => {
    const auth = await getRoleForRequest(req);
    if (!auth) {
        return res.status(401).json({ error: 'Please sign in to continue.' });
    }

    if (!canCreateEvent(auth.role)) {
        return res.status(403).json({ error: 'Only staff and admins can create events.' });
    }

    const input = parseEventInput(req.body);
    const inputError = validateBasicInput(input);
    if (inputError) {
        return res.status(400).json({ error: inputError });
    }

    try {
        const eventId = await createPackageEvent(auth.userId, input);
        res.status(201).json({ message: 'Event created successfully', eventId });
    } catch (error: any) {
        console.error('Failed to create package event:', error);
        res.status(400).json({ error: error.message || 'Could not create the event. Please try again.' });
    }
});

router.put('/packages/events/:id', async (req: Request, res: Response) => {
    const eventId = Number(req.params.id);
    if (Number.isNaN(eventId)) {
        return res.status(400).json({ error: 'Please provide a valid event ID.' });
    }

    const auth = await getRoleForRequest(req);
    if (!auth) {
        return res.status(401).json({ error: 'Please sign in to continue.' });
    }

    try {
        const existing: any = await getPackageEventById(eventId);
        if (!existing) {
            return res.status(404).json({ error: 'This event could not be found.' });
        }

        if (!canManageEvent(auth.role, existing.created_by, auth.userId)) {
            return res.status(403).json({ error: 'You do not have permission to update this event.' });
        }

        const input = parseEventInput(req.body);
        if (!Number.isInteger(input.cruise_id) || input.cruise_id < 1) {
            input.cruise_id = Number(existing.cruise_id);
        }
        const inputError = validateBasicInput(input);
        if (inputError) {
            return res.status(400).json({ error: inputError });
        }

        await updatePackageEvent(eventId, input);
        res.json({ message: 'Event updated successfully' });
    } catch (error: any) {
        console.error('Failed to update package event:', error);
        res.status(400).json({ error: error.message || 'Could not update the event. Please try again.' });
    }
});

router.post('/packages/events/:id/cancel', async (req: Request, res: Response) => {
    const eventId = Number(req.params.id);
    if (Number.isNaN(eventId)) {
        return res.status(400).json({ error: 'Please provide a valid event ID.' });
    }

    const auth = await getRoleForRequest(req);
    if (!auth) {
        return res.status(401).json({ error: 'Please sign in to continue.' });
    }

    try {
        const existing: any = await getPackageEventById(eventId);
        if (!existing) {
            return res.status(404).json({ error: 'This event could not be found.' });
        }

        if (!canManageEvent(auth.role, existing.created_by, auth.userId)) {
            return res.status(403).json({ error: 'You do not have permission to cancel this event.' });
        }

        await cancelPackageEvent(eventId);
        res.json({ message: 'Event cancelled successfully' });
    } catch (error: any) {
        console.error('Failed to cancel package event:', error);
        res.status(400).json({ error: error.message || 'Could not cancel the event. Please try again.' });
    }
});

router.post('/packages/events/:id/join', async (req: Request, res: Response) => {
    const eventId = Number(req.params.id);
    if (Number.isNaN(eventId)) {
        return res.status(400).json({ error: 'Please provide a valid event ID.' });
    }

    const userId = getAuthenticatedUserId(req);
    if (!userId) {
        return res.status(401).json({ error: 'Please sign in to continue.' });
    }

    try {
        await joinPackageEvent(eventId, userId);
        res.json({ message: 'Joined event successfully' });
    } catch (error: any) {
        console.error('Failed to join package event:', error);
        res.status(400).json({ error: error.message || 'Could not join this event right now.' });
    }
});

export default router;
