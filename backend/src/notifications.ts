import dotenv from 'dotenv';
import { getItemFromID } from './resources.js';
import cron from 'node-cron';
import { sql } from './database.js';
import nodemailer from 'nodemailer';

dotenv.config();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
});

interface NewReservation {
    user_id: number
    cabin_id: number
    resource_id: number
    start_time: string
    end_time: string
    quantity_reserved: number
    cancellation_reason: string
}

interface StaffAssignment {
    staff_id: number
    staffEmail: string
    staffName: string
    eventName: string
    start_time: string
    end_time: string
}


// Send email notification to a user about their upcoming reservation
async function sendEmailNotificationToUserForResource(userEmail: string, reservation: NewReservation) {
    try {
        if (reservation.resource_id != null) {
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
    } catch (error) {
        console.error("error sending email notification", error);
        throw error;
    }
}

// Send email notification to a staff member about their upcoming assignment
async function sendEmailNotificationToStaff(assignment: StaffAssignment) {
    try {
        await transporter.sendMail({
            from: process.env.EMAIL,
            to: assignment.staffEmail,
            subject: "You are working an event soon",
            html: `
            <h2>Upcoming Assignment</h2>
            <p>Hi <strong>${assignment.staffName}</strong>, you are assigned to <strong>${assignment.eventName}</strong>
            starting at ${assignment.start_time} until ${assignment.end_time}.</p>
            `
        });
    } catch (error) {
        console.error("error sending email to staff", error);
        throw error;
    }
}

// send email to user for a cnacneled reservation
export async function sendEmailToUserForCancellation(userEmail: string, cancellation_reason: string | null, id: number) {
        try {
        if (id != null) {
            await transporter.sendMail({
                from: process.env.EMAIL,
                to: userEmail,
                subject: "Cancelled Reseravation",
                html: `
                <h2>Cancelled Reservation</h2>
                <p>Sorry, we had to cancel your reservation for <strong>${await getItemFromID(id)}</strong>
                it was cancelled becasue ${cancellation_reason}.</p>
                `
            });
        }
    } catch (error) {
        console.error("error sending email notification", error);
        throw error;
    }
}


// upcoming reservations for user notifications
async function checkUpcomingReservations(minsAhead: number): Promise<(NewReservation & { email: string })[]> {
    return await sql`
        SELECT r.*, u.email
        FROM reservations r
        JOIN users u ON r.user_id = u.id
        WHERE r.start_time > NOW() + (${minsAhead - 1} * interval '1 minute')
          AND r.start_time <= NOW() + (${minsAhead} * interval '1 minute')
    ` as any[];
}

// upcoming shifts fo r staff - joins reservation staff, resrvations, users to give staff_id, staffemail from users, name, and the reservation times
async function getUpcomingReservationAssignments(minsAhead: number): Promise<StaffAssignment[]> {
    return await sql`
        SELECT rs.staff_id,
               u.email AS "staffEmail",
               CONCAT(u.first_name, ' ', u.last_name) AS "staffName",
               COALESCE(res.name, 'Reservation') AS "eventName",
               r.start_time, r.end_time
        FROM reservation_staff rs
        JOIN reservations r     ON rs.reservation_id = r.id
        JOIN users u            ON rs.staff_id = u.id
        LEFT JOIN resources res ON r.resource_id = res.id
        WHERE r.start_time > NOW() + (${minsAhead - 1} * interval '1 minute')
          AND r.start_time <= NOW() + (${minsAhead} * interval '1 minute')
    ` as StaffAssignment[];
}


// same as before but with packages
async function getUpcomingPackageAssignments(minsAhead: number): Promise<StaffAssignment[]> {
    return await sql`
        SELECT pes.staff_id,
               u.email AS "staffEmail",
               CONCAT(u.first_name, ' ', u.last_name) AS "staffName",
               pe.name AS "eventName",
               pe.start_time, pe.end_time
        FROM package_event_staff pes
        JOIN package_events pe ON pes.event_id = pe.id
        JOIN users u           ON pes.staff_id = u.id
        WHERE pe.start_time > NOW() + (${minsAhead - 1} * interval '1 minute')
          AND pe.start_time <= NOW() + (${minsAhead} * interval '1 minute')
          AND pe.status = 'Active'
    ` as StaffAssignment[];
}

// checks for both assignmetns
async function checkUpcomingStaffReservations(minsAhead: number): Promise<StaffAssignment[]> {
    const [reservations, packages] = await Promise.all([
        getUpcomingReservationAssignments(minsAhead),
        getUpcomingPackageAssignments(minsAhead),
    ]);
    return [...reservations, ...packages];
}

// send email to attendees of a pacakge wehn its cancelled 
export async function sendPackageEventCancelledEmailToAttendees(eventId: number, eventName: string, cancellationReason: string | null): Promise<void> {
    const attendees = await sql`
        SELECT u.email
        FROM package_event_attendees pea
        JOIN users u ON pea.user_id = u.id
        WHERE pea.event_id = ${eventId}
    `;

    for (const attendee of attendees) {
        try {
            await transporter.sendMail({
                from: process.env.EMAIL,
                to: attendee.email,
                subject: `Event Cancelled: ${eventName}`,
                html: `
                    <h2>Event Cancelled</h2>
                    <p>The event <strong>${eventName}</strong> has been cancelled.</p>
                    ${cancellationReason ? `<p>Reason: ${cancellationReason}</p>` : ''}
                `
            });
        } catch (error) {
            console.error(`Error sending cancellation email to ${attendee.email}:`, error);
        }
    }
}

// sensd email to staff when a event they are working is cancleeed 
export async function sendPackageEventCancelledEmailToStaff(eventId: number, eventName: string, cancellationReason: string | null): Promise<void> {
    const staffMembers = await sql`
        SELECT u.email, CONCAT(u.first_name, ' ', u.last_name) AS name
        FROM package_event_staff pes
        JOIN users u ON pes.staff_id = u.id
        WHERE pes.event_id = ${eventId}
    `;

    for (const staff of staffMembers) {
        try {
            await transporter.sendMail({
                from: process.env.EMAIL,
                to: staff.email,
                subject: `Event Cancelled: ${eventName}`,
                html: `
                    <h2>Event Cancelled</h2>
                    <p>Hi <strong>${staff.name}</strong>, the event <strong>${eventName}</strong> you were assigned to has been cancelled enjoy your free time.</p>
                    ${cancellationReason ? `<p>Reason: ${cancellationReason}</p>` : ''}
                `
            });
        } catch (error) {
            console.error(`Error sending cancellation email to staff ${staff.email}:`, error);
        }
    }
}

// Notify users 10 minutes before their reservation
cron.schedule('0 * * * * *', async () => {
    const upcoming = await checkUpcomingReservations(10);
    for (const reservation of upcoming) {
        await sendEmailNotificationToUserForResource(reservation.email, reservation);
    }
});

// Notify staff 10 minutes before their assignment wheter its a reservation or a package
cron.schedule('0 * * * * *', async () => {
    const assignments = await checkUpcomingStaffReservations(10);
    for (const assignment of assignments) {
        await sendEmailNotificationToStaff(assignment);
    }
});
