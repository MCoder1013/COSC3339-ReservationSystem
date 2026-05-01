import { sql } from './database.js';
import { TransactionSql } from 'postgres';

export async function pullLoyalty(user_id: number) {
    try {
        const rows = await sql`
            SELECT points
            FROM loyalty_accounts
            WHERE user_id = ${user_id}
        `;

        if (rows.length === 0) {
            throw new Error("Loyalty record not found");
        }

        return rows[0];
    } catch (error) {
        console.error("Error pulling loyalty:", error);
        throw error;
    }
}


export async function addPoints(user_id: number, amount: number) {
    try {
        if (!amount || amount <= 0) {
            throw new Error("Amount must be greater than 0");
        }

        const rows = await sql`
            UPDATE loyalty_accounts
            SET points = points + ${amount}
            WHERE user_id = ${user_id}
            RETURNING points
        `;

        if (rows.length === 0) {
            throw new Error("Loyalty record not found");
        }

        return rows[0];
    } catch (error) {
        console.error("Error adding points:", error);
        throw error;
    }
}


export async function deductPoints(user_id: number, amount: number) {
    try {
        if (!amount || amount <= 0) {
            throw new Error("Amount must be greater than 0");
        }

        const rows = await sql.begin(async (tx: TransactionSql<{}>) => {

            const current = await tx`
                SELECT points
                FROM loyalty_accounts
                WHERE user_id = ${user_id}
                FOR UPDATE
            `;

            if (current.length === 0) {
                throw new Error("Loyalty record not found");
            }

            const currentPoints = current[0].points;

            if (amount > currentPoints) {
                throw new Error("Not enough points");
            }

            const updated = await tx`
                UPDATE loyalty_accounts
                SET points = points - ${amount}
                WHERE user_id = ${user_id}
                RETURNING points
            `;

            return updated[0];
        });

        return rows;

    } catch (error) {
        console.error("Error deducting points:", error);
        throw error;
    }
}