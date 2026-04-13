import { RequestHandler, Request } from "express";
import jwt from 'jsonwebtoken';
import { getStaffRoleByUserId, getUserById, User } from "../users.js";

declare global {
    namespace Express {
        interface Request {
            /**
             * Information about the user making the request.
             * 
             * Will be undefined if the user is logged-out. Routes with
             * `authRequired` automatically require the user to be logged-in.
             */
            user?: User
        }
    }
}


export const userMiddleware: RequestHandler = async (req, res, next) => {
    const { jwtSecret } = await import("./auth.js");

    const cookie = req.cookies['jwt']
    if (!cookie) {
        return next();
    }

    try {
        const decoded = jwt.verify(cookie, jwtSecret) as { id: number } | undefined;
        const userId = decoded?.id;
        if (userId !== undefined) {
            const user = await getUserById(userId);
            req.user = user ?? undefined;
        }
    } catch {
    }

    next()
}


export const authRequired: RequestHandler = (req, res, next) => {
    if (!req.user) {
        throw res.status(401).json({ error: 'Not authenticated' });
    }

    next()
}
export const staffRequired: RequestHandler = (req, res, next) => {
    if (!req.user) {
        throw res.status(401).json({ error: 'Not authenticated' });
    }
    const role = req.user.user_role
    if (role !== 'staff' && role !== 'admin') {
        throw res.status(401).json({ error: 'This route is only accessible to staff and admins' });
    }

    next()
}
export const adminRequired: RequestHandler = async (req, res, next) => {
    if (!req.user) {
        throw res.status(401).json({ error: 'Not authenticated' });
    }

    const role = req.user.user_role;
    if (role === 'admin') {
        return next();
    }

    if (role === 'staff') {
        const staffRole = await getStaffRoleByUserId(req.user.id);
        if (staffRole?.trim().toLowerCase() === 'admin') {
            return next();
        }
    }

    throw res.status(401).json({ error: 'This route is only accessible to admins' });
}
