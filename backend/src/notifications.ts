import dotenv from 'dotenv';
import { getItemFromID } from './resources.js';
import cron from 'node-cron';
import { sql } from './database.js';
import nodemailer from 'nodemailer';



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



async function sendEmailNotificationToUserForResource(userEmail: string, reservation: NewReservation) {
    try {
        if(reservation.resource_id != null) {
            await transporter.sendMail({
            from: process.env.EMAIL, 
            to: userEmail, 
            subject: "Reservation happening soon", 
            html: `
            <h2>Upcoming Reservation</h2>
            <p>Your reservation for <strong>${await getItemFromID(reservation.resource_id)}</strong> 
            is coming up at ${reservation.start_time}.</p>
            `
    });
    }
    }catch(error) {
        console.error("error sending email notification", error); 
        throw error; 
    }
}

cron.schedule('0 * * * * *', async () => {
    const upcoming = await checkUpcomingReservations(10);
    for(const reservation of upcoming) {
        await sendEmailNotificationToUserForResource(reservation.email, reservation);
    }
});





// Query to check for upcoming reservations
async function checkUpcomingReservations(minsAhead: number): Promise<(NewReservation & { email: string })[]>  {

    const rows = await sql`                                                                                                                                                                                             
      SELECT r.*, u.email                                                                                                                                                                                             
      FROM reservations r
      JOIN users u ON r.user_id = u.id                                                                                                                                                                                
      WHERE r.start_time > NOW() + (${minsAhead - 1} * interval '1 minute')
        AND r.start_time <= NOW() + (${minsAhead} * interval '1 minute')                                                                                                                                              
  `;
       



    return rows as any[] as (NewReservation & { email: string })[];
}