import { Router, Request, Response } from 'express';
import * as argon2 from 'argon2';
import * as database from '../users.js'
import jwt from 'jsonwebtoken';
import multer from "multer";
import path from "path";
import fs from "fs";


const router = Router();

// from https://emailregex.com
const emailRegex = /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/

// TODO: store user sessions in the database!
let jwtSecret: string = process.env.JWT_SECRET ?? ''
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

  let userRole = "normal";
  let staffRole = null;

  if (employeeCode === process.env.ADMIN_CODE) {
    userRole = "staff";
    staffRole = "admin";
  } else if (employeeCode === process.env.CREW_CODE) {
    userRole = "staff";
    staffRole = "crew";
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

  if (userRole === "staff" && staffRole) {
    try {
      await database.insertStaff(userId, staffRole, "Day");
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
    const isStaffAdmin = user.user_role === 'staff' && staffRole?.trim().toLowerCase() === 'admin';

    const token = jwt.sign({ id: user.id }, jwtSecret);
    res
      .cookie('jwt', token, {
        httpOnly: true,
        sameSite: 'lax'
      })
      .json({
        message: 'Login successful',
        userId: user.id,
        firstName: user.first_name,
        role: user.user_role,
        staffRole,
        isStaffAdmin
      });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/signout', (req: Request, res: Response) => {
  res.clearCookie('jwt').json({ message: 'Signed out successfully' });
});

router.get('/me', async (req: Request, res: Response) => {
  const token = req.cookies?.jwt;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const decoded = jwt.verify(token, jwtSecret) as { id: number };
    const user = await database.getUserById(decoded.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const staffRole = user.user_role === 'staff'
      ? await database.getStaffRoleByUserId(user.id)
      : null;
    const isStaffAdmin = user.user_role === 'staff' && staffRole?.trim().toLowerCase() === 'admin';

    res.json({
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      biography: user.biography,
      profilePicture: user.profile_picture,
      role: user.user_role,
      staffRole,
      isStaffAdmin
    });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

router.get('/users', async (req: Request, res: Response) => {
  const token = req.cookies?.jwt;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const decoded = jwt.verify(token, jwtSecret) as { id: number };
    const currentUser = await database.getUserById(decoded.id);

    if (!currentUser || currentUser.user_role !== 'staff') {
      return res.status(403).json({ error: 'Forbidden: staff only' });
    }

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

router.post('/update-profile', upload.single('profilePicture'), async (req: Request, res: Response) => {
  const token = req.cookies?.jwt;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const decoded = jwt.verify(token, jwtSecret) as { id: number };
    const { biography } = req.body;
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
      await database.updateUserProfile(decoded.id, biography, profilePicture);
    } else if (biography !== undefined) {
      await database.updateUserBiography(decoded.id, biography);
    } else if (profilePicture) {
      await database.updateUserProfilePicture(decoded.id, profilePicture);
    }

    res.json({ message: 'Profile updated successfully', profilePicture });
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

export function getAuthenticatedUserId(req: Request): number | undefined {
  const cookie = req.cookies['jwt']
  if (!cookie) return undefined

  try {
    const decoded = jwt.verify(cookie, jwtSecret) as { id: number } | undefined;
    return decoded?.id
  } catch {
    return undefined
  }
}

async function requireAdminStaff(req: Request, res: Response): Promise<number | undefined> {
  const token = req.cookies?.jwt;
  if (!token) {
    res.status(401).json({ error: 'Not authenticated' });
    return undefined;
  }

  try {
    const decoded = jwt.verify(token, jwtSecret) as { id: number };
    const currentUser = await database.getUserById(decoded.id);

    if (!currentUser || currentUser.user_role !== 'staff') {
      res.status(403).json({ error: 'Forbidden: staff only' });
      return undefined;
    }

    const isAdmin = await database.isUserStaffAdmin(decoded.id);
    if (!isAdmin) {
      res.status(403).json({ error: 'Forbidden: admin only' });
      return undefined;
    }

    return decoded.id;
  } catch {
    res.status(401).json({ error: 'Invalid token' });
    return undefined;
  }
}

router.post('/update-user-role', async (req: Request, res: Response) => {
  try {
    const adminId = await requireAdminStaff(req, res);
    if (!adminId) {
      return;
    }

    const { userId, newRole, cruiseIds } = req.body;

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

    if (targetUser.id === adminId && newRole !== 'admin') {
      return res.status(400).json({ error: 'You cannot remove your own admin privileges.' });
    }

    const normalizedCruiseIds = Array.isArray(cruiseIds)
      ? cruiseIds.map((id: unknown) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
      : [];

    // Update user role
    if (newRole === 'admin') {
      // Promote to admin: set user_role to 'staff' and add to staff table with role 'Admin'
      await database.updateUserRole(userId, 'staff');
      await database.upsertStaffRecord(userId, 'admin', 'Day');
      await database.replaceStaffCruiseAssignments(userId, normalizedCruiseIds);
    } else if (newRole === 'staff') {
      // Promote/demote to regular staff and keep staff record.
      await database.updateUserRole(userId, 'staff');
      await database.upsertStaffRecord(userId, 'crew', 'Day');
      await database.replaceStaffCruiseAssignments(userId, normalizedCruiseIds);
    } else {
      // Downgrade to normal user and remove staff associations.
      await database.updateUserRole(userId, 'normal');
      await database.replaceStaffCruiseAssignments(userId, []);
      await database.removeStaffRecord(userId);
    }

    res.json({ message: 'User role updated successfully' });
  } catch (err) {
    console.error('Update role error:', err);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

router.get('/staff/:userId/cruises', async (req: Request, res: Response) => {
  try {
    const adminId = await requireAdminStaff(req, res);
    if (!adminId) {
      return;
    }

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

router.post('/add-staff-cruise', async (req: Request, res: Response) => {
  try {
    const adminId = await requireAdminStaff(req, res);
    if (!adminId) {
      return;
    }

    const userId = Number(req.body.userId);
    const cruiseId = Number(req.body.cruiseId);

    if (!Number.isInteger(userId) || userId < 1 || !Number.isInteger(cruiseId) || cruiseId < 1) {
      return res.status(400).json({ error: 'Invalid userId or cruiseId' });
    }

    await database.addStaffCruiseAssignment(userId, cruiseId);
    res.json({ message: 'Cruise assigned successfully' });
  } catch (err) {
    console.error('Failed to assign staff cruise:', err);
    res.status(400).json({ error: (err as Error).message || 'Failed to assign cruise' });
  }
});

router.post('/remove-staff-cruise', async (req: Request, res: Response) => {
  try {
    const adminId = await requireAdminStaff(req, res);
    if (!adminId) {
      return;
    }

    const userId = Number(req.body.userId);
    const cruiseId = Number(req.body.cruiseId);

    if (!Number.isInteger(userId) || userId < 1 || !Number.isInteger(cruiseId) || cruiseId < 1) {
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