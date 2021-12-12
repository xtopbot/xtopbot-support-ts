import mysql2, { Connection } from "mysql2/promise";
import Logger from "../utils/Logger";

export default class MysqlDatabase {
  private static configConnection: mysql2.ConnectionOptions = {
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    charset: "utf8mb4",
  };
  public static state: MysqlConnectionState;
  private static connection: Connection;
  public static async connect(): Promise<void> {
    try {
      this.state = MysqlConnectionState.CONNECTING;
      Logger.info("[Mysql] Database connecting...");
      this.connection = await mysql2.createConnection(this.configConnection);
      this.state = MysqlConnectionState.CONNECTED;
      Logger.info("[Mysql] Database connected!");
    } catch (err) {
      this.state = MysqlConnectionState.DISCONNECTED;
      Logger.error(`[Mysql] Error connecting to database.`);
      throw console.log(err);
    }
  }
  public static get db(): Connection {
    if (this.state !== MysqlConnectionState.CONNECTED)
      throw Error("Cannot use db while not connected.");
    return this.connection;
  }
}

enum MysqlConnectionState {
  DISCONNECTED,
  CONNECTING,
  CONNECTED,
}

export const db: Connection = MysqlDatabase.db;
