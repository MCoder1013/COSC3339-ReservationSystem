// see https://nodejs.org/en/learn/test-runner/using-test-runner

import net from "net"
import postgres from "postgres";

// https://stackoverflow.com/a/71178451
function getFreePort(): Promise<number> {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.listen(0, () => {
            const { port } = server.address() as net.AddressInfo;
            server.close((err) => err ? reject(err) : resolve(port))
        });
    })
}

process.env.DB_USER = 'user'
process.env.DB_PASSWORD = 'pass'
process.env.DB_POSTGRES_PORT = '5432'
process.env.DB_DATA_PATH = './data/test-db'
process.env.RUNNING_TESTS = '1'

const port = await getFreePort()
process.env.APP_PORT = port.toString()

await import('../migrations/index.ts')
await import('../src/index.ts')

export function connectPg(database: string) {
  return postgres({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_POSTGRES_PORT ?? ''),
    host: 'localhost',
    database
  });
}

const sql = await connectPg('postgres')
await sql`CREATE DATABASE cruise_reservation_template WITH TEMPLATE cruise_reservation;`
await sql.end()
