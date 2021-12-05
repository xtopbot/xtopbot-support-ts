import mysql2 from "mysql2/promise";
import Logger from "../utils/Logger";

export default async function (): Promise<void> {
  try {
    await mysql2.createConnection({
      host: process.env.MYSQL_HOST,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
      charset: "utf8mb4",
    });
    Logger.logg;
  } catch (err) {
    Logger.error(`[Mysql] Error connecting to database. ${err.toString()}`);
    throw new Error(err);
  }
}
