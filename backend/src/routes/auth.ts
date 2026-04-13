import { Router, Request, Response } from 'express';
import * as argon2 from 'argon2';
import * as database from '../users.js'
import jwt from 'jsonwebtoken';
import multer from "multer";
import path from "path";
import fs from "fs";
import { adminRequired, authRequired, staffRequired } from './index.js';
import { sql } from '../database.js';


const router = Router();

const SHIFT_TIME_ZONE = process.env.SHIFT_TIME_ZONE || 'America/Chicago';
const VALID_SHIFTS = ['Morning', 'Day', 'Night'] as const;

const shiftTimeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: SHIFT_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

type ShiftName = typeof VALID_SHIFTS[number];

function getShiftTimeParts(date: Date) {
  const parts = shiftTimeFormatter.formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
  };
}

function minutesSinceMidnightShiftTime(d: Date) {
  const parts = getShiftTimeParts(d);
  return parts.hour * 60 + parts.minute;
}

function isSameShiftDay(a: Date, b: Date) {
  const left = getShiftTimeParts(a);
  const right = getShiftTimeParts(b);
  return left.year === right.year && left.month === right.month && left.day === right.day;
}

function isNextShiftDay(a: Date, b: Date) {
  const left = getShiftTimeParts(a);
  const right = getShiftTimeParts(b);
  const leftIndex = Math.floor(Date.UTC(left.year, left.month - 1, left.day) / 86400000);
  const rightIndex = Math.floor(Date.UTC(right.year, right.month - 1, right.day) / 86400000);
  return rightIndex === leftIndex + 1;
}

function isWithinShiftWindow(shift: string, start: Date, end: Date): boolean {
  const normalized = shift.charAt(0).toUpperCase() + shift.slice(1).toLowerCase();

  const startMinutes = minutesSinceMidnightShiftTime(start);
  const endMinutes = minutesSinceMidnightShiftTime(end);

  const sameShiftDay = isSameShiftDay(start, end);
  const nextShiftDay = isNextShiftDay(start, end);

  if (normalized === 'Morning') {
    return sameShiftDay && startMinutes >= 360 && endMinutes <= 720;
  }

  if (normalized === 'Day') {
    return sameShiftDay && startMinutes >= 720 && endMinutes <= 1080;
  }

  if (normalized === 'Night') {
    const sameDayNight = sameShiftDay && startMinutes >= 1080 && endMinutes <= 1439;
    const midnightBoundary = nextShiftDay && startMinutes >= 1080 && endMinutes === 0;
    return sameDayNight || midnightBoundary;
  }

  return false;
}

function deriveShiftFromWindow(start: Date, end: Date): ShiftName | null {
  if (isWithinShiftWindow('Morning', start, end)) return 'Morning';
  if (isWithinShiftWindow('Day', start, end)) return 'Day';
  if (isWithinShiftWindow('Night', start, end)) return 'Night';
  return null;
}

function toShiftDayKey(d: Date): string {
  const parts = getShiftTimeParts(d);
  const month = String(parts.month).padStart(2, '0');
  const day = String(parts.day).padStart(2, '0');
  return `${parts.year}-${month}-${day}`;
}

function normalizeShiftInput(raw: unknown): ShiftName | null {
  const value = String(raw ?? '').trim().toLowerCase();
  if (value === 'morning') return 'Morning';
  if (value === 'day') return 'Day';
  if (value === 'night') return 'Night';
  return null;
}

async function listStaffedEvents(userId: number) {
  return await sql`
    SELECT DISTINCT
      e.id,
      e.name,
      e.start_time,
      e.end_time
    FROM package_events e
    LEFT JOIN package_event_staff pes
      ON pes.event_id = e.id
    WHERE e.status <> 'Cancelled'
      AND (e.created_by = ${userId} OR pes.staff_id = ${userId})
      AND e.end_time >= NOW() - INTERVAL '1 day'
      AND e.start_time < NOW() + INTERVAL '2 day'
    ORDER BY e.start_time ASC
  `;
}

async function syncStaffShiftForToday(userId: number) {
  const currentShift = await database.getStaffShiftByUserId(userId);
  if (!currentShift) {
    return currentShift;
  }

  const todayKey = toShiftDayKey(new Date());
  const events = await listStaffedEvents(userId);
  const todayShifts = new Set<ShiftName>();

  for (const event of events) {
    const eventStart = new Date(event.start_time);
    const eventEnd = new Date(event.end_time);
    if (toShiftDayKey(eventStart) !== todayKey) {
      continue;
    }

    const derivedShift = deriveShiftFromWindow(eventStart, eventEnd);
    if (derivedShift) {
      todayShifts.add(derivedShift);
    }
  }

  if (todayShifts.size === 1) {
    const [requiredShift] = Array.from(todayShifts);
    if (requiredShift !== currentShift) {
      await database.updateStaffShiftByUserId(userId, requiredShift);
      return requiredShift;
    }
  }

  return currentShift;
}

async function getShiftChangeConflictsForToday(userId: number, targetShift: ShiftName) {
  const todayKey = toShiftDayKey(new Date());
  const events = await listStaffedEvents(userId);

  return events
    .map((event) => {
      const eventStart = new Date(event.start_time);
      const eventEnd = new Date(event.end_time);
      if (toShiftDayKey(eventStart) !== todayKey) {
        return null;
      }

      const derivedShift = deriveShiftFromWindow(eventStart, eventEnd);
      if (!derivedShift || derivedShift === targetShift) {
        return null;
      }

      return {
        id: Number(event.id),
        name: String(event.name ?? `Event #${event.id}`),
        start_time: event.start_time,
        end_time: event.end_time,
        required_shift: derivedShift,
      };
    })
    .filter((value): value is {
      id: number;
      name: string;
      start_time: string;
      end_time: string;
      required_shift: ShiftName;
    } => value !== null);
}

// from https://emailregex.com
const emailRegex = /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/

// TODO: store user sessions in the database!
export let jwtSecret: string = process.env.JWT_SECRET ?? ''
if (!jwtSecret) {
  console.warn('No JWT_SECRET environment variable is set, please set something if you\'re running in prod')
  jwtSecret = 'devsecret'
}

router.post('/register', async (req, res) => {
  const firstName = req.body.firstName;
  const lastName = req.body.lastName;
  let email = req.body.email;
  const password = req.body.password;
  const confirmPassword = req.body.confirmPassword;
  const employeeCode = req.body.employeeCode;

  let userRole: database.UserRole = "normal";

  if (employeeCode === process.env.ADMIN_CODE) {
    userRole = "admin";
  } else if (employeeCode === process.env.CREW_CODE) {
    userRole = "staff";
  }

  email = email.toLowerCase();

  const emailValid = emailRegex.test(email);
  if (!emailValid) {
    return res.status(400).json({ error: 'invalid email' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({
      error: 'password and confirmed password do not match'
    });
  }

  if (password.length > 100) {
    return res.status(400).json({ error: 'Password is too long' });
  } else if (password.length < 8) {
    return res.status(400).json({ error: 'Password is too short' });
  } else if (!(/[a-zA-Z]/.test(password))) {
    return res.status(400).json({ error: 'Password must contain letters' });
  } else if (!(/[0-9]/.test(password))) {
    return res.status(400).json({ error: 'Password must contain numbers' });
  } else if (!(/[@$!%*#?&]/.test(password))) {
    return res.status(400).json({ error: 'Password must contain a special character' });
  }

  const passwordHash = await argon2.hash(password);

  let userId;

  try {
    // ✅ MUST RETURN insertId from this function
    userId = await database.tryRegister(firstName, lastName, email, passwordHash, userRole);
  } catch (err) {
    if ((err as any).code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        error: 'User with that email already exists'
      });
    }
    console.error('Unknown registration error:', err);
    return res.status(400).json({
      error: 'Unknown error!'
    });
  }

  if (userRole === "staff") {
    try {
      // Their role is set to "Other" by default, but it can be changed by an
      // admin.
      await database.insertStaff(userId, "Other", "Day");
    } catch (err) {
      console.error('Error inserting staff:', err);
      return res.status(500).json({
        error: 'Error creating staff record'
      });
    }
  }

  res.json({
    message: 'Successfully registered!'
  });
});


// Additional login information for authorization
router.post('/login', async (req: Request, res: Response) => {
  // Extract email and password from the request body
  let { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Missing email or password' });
  }

  email = email.toLowerCase();

  try {
    // Fetch the user from the database by email
    const user = await database.getUserByEmail(email);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Compare the provided password with the hashed password stored in the database
    const passwordValid = await argon2.verify(user.password_hash, password);

    if (!passwordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    // If email exists and password matches, login is successful

    const staffRole = user.user_role === 'staff'
      ? await database.getStaffRoleByUserId(user.id)
      : null;
    const shift = user.user_role === 'staff'
      ? await database.getStaffShiftByUserId(user.id)
      : null;
    const isStaffAdmin = user.user_role === 'admin';

    const token = jwt.sign({ id: user.id }, jwtSecret);
    res
      .cookie('jwt', token, {
        httpOnly: true,
        sameSite: 'lax',
        // Expire after a year. This has to be set to fix sessions expiring when the browser is closed.
        maxAge: 1000 * 60 * 60 * 24 * 365
      })
      .json({
        message: 'Login successful',
        userId: user.id,
        firstName: user.first_name,
        role: user.user_role,
        staffRole,
        shift,
        isStaffAdmin
      });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/signout', authRequired, (req: Request, res: Response) => {
  res.clearCookie('jwt').json({ message: 'Signed out successfully' });
});

router.get('/me', authRequired, async (req: Request, res: Response) => {
  try {
    const user = req.user!;

    let syncedShift: string | null = null;
    if (user.user_role === 'staff') {
      syncedShift = await syncStaffShiftForToday(user.id);
    }

    const staffRole = user.user_role === 'staff'
      ? await database.getStaffRoleByUserId(user.id)
      : null;
    const shift = user.user_role === 'staff'
      ? (syncedShift ?? await database.getStaffShiftByUserId(user.id))
      : null;
    const isStaffAdmin = user.user_role === 'admin';

    res.json({
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      biography: user.biography,
      profilePicture: user.profile_picture,
      role: user.user_role,
      staffRole,
      shift,
      isStaffAdmin
    });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

router.get('/users', staffRequired, async (req: Request, res: Response) => {
  try {
    const users = await database.getAllUsers();
    res.json(users);
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

const uploadDir = "uploads/profiles";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error("Invalid file type"));
  },
});

router.post('/update-profile', authRequired, upload.single('profilePicture'), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const role = req.user!.user_role;
    const { biography } = req.body;
    const requestedShift = normalizeShiftInput(req.body.shift);
    let profilePicture: null | string = null

    if (req.file) {
      const fileName = req.file.filename

      // this is usually unnecessary, but just to be safe we do some extra checks
      if (fileName.includes('..') || fileName.includes('/')) {
        throw Error('file name contains disallowed characters')
      }
      if (fileName.length === 0 || fileName.length > 100) {
        throw Error('file name has an invalid length')
      }

      profilePicture = `/uploads/profiles/${fileName}`
    }

    if (biography !== undefined && profilePicture) {
      await database.updateUserProfile(userId, biography, profilePicture);
    } else if (biography !== undefined) {
      await database.updateUserBiography(userId, biography);
    } else if (profilePicture) {
      await database.updateUserProfilePicture(userId, profilePicture);
    }

    let nextShift: string | null = null;

    if (req.body.shift !== undefined) {
      if (role !== 'staff') {
        return res.status(400).json({ error: 'Only staff members can change shifts.' });
      }

      if (!requestedShift) {
        return res.status(400).json({ error: 'Shift must be Morning, Day, or Night.' });
      }

      const currentShift = await syncStaffShiftForToday(userId);
      if (!currentShift) {
        return res.status(400).json({ error: 'Unable to locate your staff shift record.' });
      }

      if (requestedShift !== currentShift) {
        const conflicts = await getShiftChangeConflictsForToday(userId, requestedShift);
        if (conflicts.length > 0) {
          return res.status(400).json({
            error: 'You cannot change shifts today because you are staffing event(s) in a different shift window.',
            shiftConflicts: conflicts,
          });
        }

        await database.updateStaffShiftByUserId(userId, requestedShift);
      }

      nextShift = await database.getStaffShiftByUserId(userId);
    }

    res.json({ message: 'Profile updated successfully', profilePicture, shift: nextShift });
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

router.post('/update-user-role', adminRequired, async (req: Request, res: Response) => {
  try {
    const { userId, newRole } = req.body;

    if (!userId || !newRole) {
      return res.status(400).json({ error: 'Missing userId or newRole' });
    }

    if (!['normal', 'staff', 'admin'].includes(newRole)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const targetUser = await database.getUserById(userId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update user role
    if (newRole === 'admin') {
      // Promote to admin: set user_role to 'staff' and add to staff table with role 'Admin'
      await database.updateUserRole(userId, 'staff');
      // Insert or update in staff table
      await sql`
        INSERT INTO staff (staff_id, role, shift)
        VALUES (${userId}, 'Admin', 'Day')
        ON CONFLICT (staff_id)
        DO UPDATE SET role = 'Admin'
      `;
    } else if (newRole === 'staff') {
      // Demote to staff: set user_role to 'staff' and remove from staff table
      await database.updateUserRole(userId, 'staff');
      // Delete from staff table if exists
      await sql`
        DELETE FROM staff WHERE staff_id = ${userId}
      `;
    } else {
      // Downgrade to normal: set user_role to 'normal' and remove from staff table
      await database.updateUserRole(userId, 'normal');
      // Delete from staff table if exists
      await sql`
        DELETE FROM staff WHERE staff_id = ${userId}
      `;
    }

    res.json({ message: 'User role updated successfully' });
  } catch (err) {
    console.error('Update role error:', err);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

router.get('/staff/:userId/cruises', adminRequired, async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.userId);

    if (!Number.isInteger(userId) || userId < 1) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const cruises = await database.getStaffAssignedCruises(userId);
    res.json(cruises);
  } catch (err) {
    console.error('Failed to fetch staff cruises:', err);
    res.status(500).json({ error: 'Failed to fetch staff cruises' });
  }
});

router.post('/add-staff-cruise', adminRequired, async (req: Request, res: Response) => {
  try {
    const userId = Number(req.body.userId);
    const cruiseId = Number(req.body.cruiseId);

    if (
      !Number.isInteger(userId) || userId < 1 ||
      !Number.isInteger(cruiseId) || cruiseId < 1
    ) {
      return res.status(400).json({ error: 'Invalid userId or cruiseId' });
    }

    await database.addStaffCruiseAssignment(userId, cruiseId);
    res.json({ message: 'Cruise assigned successfully' });
  } catch (err) {
    console.error('Failed to assign staff cruise:', err);
    res.status(400).json({ error: (err as Error).message || 'Failed to assign cruise' });
  }
});

router.post('/remove-staff-cruise', adminRequired, async (req: Request, res: Response) => {
  try {
    const userId = Number(req.body.userId);
    const cruiseId = Number(req.body.cruiseId);

    if (
      !Number.isInteger(userId) || userId < 1 ||
      !Number.isInteger(cruiseId) || cruiseId < 1
    ) {
      return res.status(400).json({ error: 'Invalid userId or cruiseId' });
    }

    await database.removeStaffCruiseAssignment(userId, cruiseId);
    res.json({ message: 'Cruise assignment removed successfully' });
  } catch (err) {
    console.error('Failed to remove staff cruise assignment:', err);
    res.status(500).json({ error: 'Failed to remove cruise assignment' });
  }
});

export default router; 