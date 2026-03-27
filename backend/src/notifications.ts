import dotenv from 'dotenv';
import { getItemFromID } from './resources.js';
import cron from 'node-cron';
import { sql } from './database.js';
import nodemailer from 'nodemailer';
import { getStaffNameFromID } from './staff.js';



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


// function to sen duser email notifications 
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


// schedule for user email notifications 
cron.schedule('0 * * * * *', async () => {
    const upcoming = await checkUpcomingReservations(10);
    for(const reservation of upcoming) {
        await sendEmailNotificationToUserForResource(reservation.email, reservation);
        await sendEmailNotificationToStaff(reservation.staffEmail, reservation);
    }
});

// TODO - fix email to change staff_id to give staff name and also get staff 
async function sendEmailNotificationToStaff(staffEmail: string, reservation: NewReservation) {
    try{
        if(reservation.staff_id != null) {
            await transporter.sendMail({
            from: process.env.EMAIL, 
            to: staffEmail, 
            subject: "You are working an event soon", 
            html: `
            <h2>Upcoming Reservation</h2>
            <p>${getStaffNameFromID(reservation.staff_id)} ready for your shift <strong>${reservation.staff_id}</strong> 
            starting at ${reservation.start_time} until ${reservation.end_time}.</p>
            `
        }); 
        }
    } catch (error) {
        console.error("error sending email to staff", error); 
        throw error; 
    }
}



// Query to check for upcoming reservations
async function checkUpcomingReservations(minsAhead: number): Promise<(NewReservation & { email: string } & {staffEmail: string})[]>  {

    const rows = await sql`                                                                                                                                                                                             
      SELECT r.*, u.email                                                                                                                                                                                             
      FROM reservations r
      JOIN users u ON r.user_id = u.id
      JOIN staff s ON r.staff_id = s.id                                                                                                                                                                                
      WHERE r.start_time > NOW() + (${minsAhead - 1} * interval '1 minute')
        AND r.start_time <= NOW() + (${minsAhead} * interval '1 minute')                                                                                                                                              
  `;
    return rows as any[] as (NewReservation & { email: string } & {staffEmail: string})[];
}


// pull the staff working upcoming reservations
async function checkUpcomingStaffReservations() {
    // Query to pull staff working in upcoming reservations
    checkUpcomingReservations
    

}
