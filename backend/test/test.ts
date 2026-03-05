import test, { beforeEach } from 'node:test';
import { connectPg } from './setup.ts';
import postgres from 'postgres';
import assert from 'node:assert';
import { connectToDatabase, disconnectFromDatabase } from '../src/database.ts';

let sql: postgres.Sql<{}>

beforeEach(async () => {
    // wipe the database before every run

    await disconnectFromDatabase()

    if (sql) {
        await sql.end()
    }
    const sql2 = await connectPg('postgres')
    await sql2`DROP DATABASE cruise_reservation`
    await sql2`CREATE DATABASE cruise_reservation TEMPLATE cruise_reservation_template;`
    await sql2.end();
    sql = await connectPg('cruise_reservation')

    await connectToDatabase()
})

const BASE_URL = `http://localhost:${process.env.APP_PORT}`

async function post(path: string, body: Record<string, any>) {
    const res = await fetch(BASE_URL + path, {
        method: 'POST',
        body: JSON.stringify(body),
        headers: {
            'content-type': 'application/json'
        }
    })
    return await res.json()
}

await test('auth', { concurrency: 1 }, async t => {
    await t.test('can create users', async () => {
        const res = await post('/api/auth/register', {
            firstName: 'first',
            lastName: 'last',
            email: 'example@example.com',
            password: 'Password1!',
            confirmPassword: 'Password1!',
        })
        assert.strictEqual(res.message, 'Successfully registered!')
    })
    await t.test('passwords are validated', async () => {
        const res = await post('/api/auth/register', {
            firstName: 'first',
            lastName: 'last',
            email: 'example@example.com',
            password: '1111111111!',
            confirmPassword: '1111111111!',
        })
        assert.strictEqual(res.error, 'Password must contain letters')
    })
});

