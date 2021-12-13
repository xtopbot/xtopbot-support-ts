import { Client, Interaction, Message } from "discord.js";
import * as dotenv from "dotenv";
import CommandsManager from "./commands/CommandsManager";
import ListenersHandler from "./listeners/ListenersHandler";
import UserManager from "./managers/UserManager";
import mysql from "./providers/Mysql";
import Logger from "./utils/Logger";
dotenv.config();

export default class {
  public static client: Client = new Client({
    intents: [
      "GUILDS",
      "GUILD_MEMBERS",
      "GUILD_BANS",
      "GUILD_EMOJIS_AND_STICKERS",
      "GUILD_INTEGRATIONS",
      "GUILD_WEBHOOKS",
      "GUILD_INVITES",
      "GUILD_VOICE_STATES",
      "GUILD_PRESENCES",
      "GUILD_MESSAGES",
      "GUILD_MESSAGE_REACTIONS",
      "GUILD_MESSAGE_TYPING",
      "DIRECT_MESSAGES",
    ],
    partials: ["CHANNEL"],
  });
  //public static commands<Commands> =
  public static users = new UserManager();
  private static _initialize = false;
  private static initialize(): void {
    if (this._initialize) return Logger.debug("Cannot initialize twice");
    this._initialize = true;
    ListenersHandler.handler(this.client);
  }
  public static async launch(): Promise<void> {
    await mysql.connect();
    this.initialize();
    Logger.info("[Discord] <>Bot connecting...");
    this.client.login(process.env.DISCORD_BOT_TOKEN);
  }
  public static shutdown(): void {
    this.client.destroy();
    process.exit();
  }
}
