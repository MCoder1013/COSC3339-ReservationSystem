import { Router, Request, Response } from 'express';
import { pullResources } from '../database.js';
import * as argon2 from 'argon2';
import * as database from '../database.js'

const router = Router();

// from https://emailregex.com
const emailRegex = /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/

router.post('/register', async (req, res) => {
  console.log('got register with data', req.body)
  const firstName = req.body.firstName;
  const lastName = req.body.lastName;
  let email = req.body.email;
  const password = req.body.password;
  const confirmPassword = req.body.confirmPassword;

  email = email.toLowerCase();

  const emailValid = emailRegex.test(email);
  if (!emailValid) {
    return res.json({
      'error': 'invalid email'
    });
  }

  if (password != confirmPassword) {
    return res.json({
      'error': 'password and confirmed password do not match'
    });
  }

  const passwordValid = /^.{1,100}$/.test(password);
  if (!passwordValid) {
    return res.json({
      'error': 'invalid password'
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
  }

  res.json({
    'message': 'Successfully registered!'
  });
})

export default router; 
