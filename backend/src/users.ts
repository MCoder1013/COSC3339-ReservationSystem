import { sql } from './database.js';

export async function tryRegister(firstName: string, lastName: string, email: string, passwordHash: string, role: string) {
    const result = await sql`
        INSERT INTO users
            (first_name, last_name, email, password_hash, user_role)
        VALUES
            (${firstName}, ${lastName}, ${email}, ${passwordHash}, ${role})
    `;
}

export async function getUserByEmail(email: string) {
    const result = await sql`SELECT * FROM users WHERE email = ${email}`;
    return result[0]; // first user or undefined
}

export async function getUserById(id: number) {
    const result = await sql`SELECT * FROM users WHERE id = ${id}`;
    return result[0] ?? null;
}

export async function updateUserProfile(id: number, biography: string, profilePicture: string) {
    await sql`
    UPDATE users
    SET biography = ${biography}, profile_picture = ${profilePicture}
    WHERE id = ${id}
  `;
}

export async function updateUserBiography(id: number, biography: string) {
    await sql`UPDATE users SET biography = ${biography} WHERE id = ${id}`;
}

export async function updateUserProfilePicture(id: number, profilePicture: string) {
    await sql`UPDATE users SET profile_picture = ${profilePicture} WHERE id = ${id}`;
}

export async function getAllUsers() {
    const result = await sql`
        SELECT id, first_name, last_name, email, user_role, created_at
        FROM users
        ORDER BY id ASC
    `;
    return result;
}

// Validate guest emails and return their user IDs
export async function validateGuestEmails(emails: string[]): Promise<{ valid: boolean; userIds: number[]; invalidEmails: string[] }> {
    const userIds: number[] = [];
    const invalidEmails: string[] = [];

    for (const email of emails) {
        const user = await getUserByEmail(email.trim());
        if (user) {
            userIds.push(user.id);
        } else {
            invalidEmails.push(email);
        }
    }

    return {
        valid: invalidEmails.length === 0,
        userIds,
        invalidEmails
    };
}
