import mysql2, { Connection, QueryError } from "mysql2/promise";
import Exception, { Severity } from "../utils/Exception";
import Logger from "../utils/Logger";
import * as dotenv from "dotenv";
dotenv.config();

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

  public static async query(
    query: string,
    values: Array<any>
  ): Promise<any | Exception> {
    Logger.info(`[Mysql<Query>] ${query}`);
    try {
      const [raw] = await this.db.query(query, values);
      return raw;
    } catch (error) {
      throw new Exception((error as QueryError).message, Severity.FAULT);
    }
  }
}

enum MysqlConnectionState {
  DISCONNECTED,
  CONNECTING,
  CONNECTED,
}

//export const db: Connection = MysqlDatabase.db;
