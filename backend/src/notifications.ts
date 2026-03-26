import dotenv from 'dotenv';
import { getItemFromID } from './resources.js';

const nodemailer = require("nodemailer");
dotenv.config();

const transporter = nodemailer.createTransport({
  service: "gmail", // Shortcut for Gmail's SMTP settings - see Well-Known Services
  auth: {
    user: process.env.EMAIL,
    pass: process.env.EMAIL_APP_PASSWORD, 
  },
});

interface NewReservation {
    user_id: number
    cabin_id: number
    resource_id: number
    staff_id: number
    start_time: string
    end_time: string
    quantity_reserved: number
}



async function sendEmailNotificationToUser(userEmail: string, reservation: NewReservation) {
    await transporter.sendMail({
        from: process.env.EMAIL, 
        to: userEmail, 
        subject: "Reservation happening soon", 
         html: `
        <h2>Your table is almost ready!</h2>
        <p>Your reservation for <strong>${await getItemFromID(reservation.user_id)}</strong> 
         is coming up at ${reservation.start_time}.</p>
    `
    });
}