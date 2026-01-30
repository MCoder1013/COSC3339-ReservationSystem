import { Router, Request, Response } from 'express';
import { pullResources } from '../database.js';
import * as argon2 from 'argon2';
import * as database from '../database.js'
import jwt from 'jsonwebtoken';

const router = Router();

// from https://emailregex.com
const emailRegex = /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/

// TODO: store user sessions in the database!
const jwtSecret = process.env.JWT_SECRET ?? 'devsecret'
if (!jwtSecret) {
  console.warn('No JWT_SECRET environment variable is set, please set something if you\'re running in prod')
}

router.post('/register', async (req, res) => {
  const firstName = req.body.firstName;
  const lastName = req.body.lastName;
  let email = req.body.email;
  const password = req.body.password;
  const confirmPassword = req.body.confirmPassword;

  email = email.toLowerCase();

  const emailValid = emailRegex.test(email);
  if (!emailValid) {
    return res.status(400).json({
      'error': 'invalid email'
    });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({
      'error': 'password and confirmed password do not match'
    });
  }

  if (password.length > 100) {
    return res.status(400).json({
      'error': 'Password is too long'
    });
  } else if (password.length < 8) {
    return res.status(400).json({
      'error': 'Password is too short'
    });
  } else if (!(/[0-9]/.test(password))) {
    return res.status(400).json({
      'error': 'Password must contain numbers'
    });
  } else if (!(/[@$!%*#?&]/.test(password))) {
    return res.status(400).json({
      'error': 'Password must contain a special character'
    });
  }

  const passwordHash = await argon2.hash(password);

  try {
    await database.tryRegister(firstName, lastName, email, passwordHash);
  } catch (err) {
    if ((err as any).code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        'error': 'User with that email already exists'
      })
    }
    console.error('Unknown registration error:', err)
    return res.status(400).json({
      'error': 'Unknown error!'
    })
  }

  res.json({
    'message': 'Successfully registered!'
  });
})


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

    const token = jwt.sign({ id: user.id }, jwtSecret);
    res
      .cookie('jwt', token, {
        httpOnly: true,
        sameSite: 'lax'
      })
      .json({
        message: 'Login successful',
        userId: user.id,
        firstName: user.first_name
      });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

export function getAuthenticatedUserId(req: Request): number | undefined {
  console.log('cookies', req.cookies)
  const cookie = req.cookies['jwt']
  if (!cookie) return undefined
  const decoded = jwt.verify(cookie, jwtSecret) as { id: number } | undefined;
  return decoded?.id
}

export default router; 
