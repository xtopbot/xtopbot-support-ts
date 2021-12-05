/*
i think this code is bad :(
let try new one :)

class XtopBotSupport extends Client {
  private commands: CommandsManager;
  constructor() {
    super({
      intents: [
        "GUILDS",
        "GUILD_MEMBERS",
        "GUILD_BANS",
        "GUILD_EMOJIS_AND_STICKERS",
        "GUILD_INTEGRATIONS",
        "GUILD_VOICE_STATES",
        "GUILD_PRESENCES",
        "GUILD_MESSAGES",
        "GUILD_MESSAGE_REACTIONS",
        "GUILD_MESSAGE_TYPING",
      ],
    });
    this.commands = new CommandsManager();
    this.login(process.env.DISCORD_BOT_TOKEN);
  }

  private listener() {
    this.on("messageCreate", (message: Message) =>
      this.commands.onMessageCreate(message)
    );
    this.on("interactionCreate", (interaction: Interaction) =>
      this.commands.onInteractionCreate(interaction)
    );
  }

  public run() {
    //this.login(process.env.DISCORD_BOT_TOKEN);
  }
}

const app = new XtopBotSupport();
app.run();*/

import { Client, Interaction, Message } from "discord.js";
import * as dotenv from "dotenv";
import CommandsManager from "./commands/CommandsManager";
import ListenersHandler from "./listeners/ListenersHandler";
import mysql from "./providers/mysql";
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
      "GUILD_VOICE_STATES",
      "GUILD_PRESENCES",
      "GUILD_MESSAGES",
      "GUILD_MESSAGE_REACTIONS",
      "GUILD_MESSAGE_TYPING",
    ],
  });
  private static _initialize = false;
  private static initialize(): void {
    if (this._initialize) return Logger.debug("Cannot initialize twice");
    this._initialize = true;
    ListenersHandler.handler(this.client);
  }
  public static async launch(): Promise<void> {
    this.initialize();
    await mysql();
    this.client.login(process.env.DISCORD_BOT_TOKEN);
  }
  public static shutdown(): void {
    this.client.destroy();
    process.exit();
  }
}
