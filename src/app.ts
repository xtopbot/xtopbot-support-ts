import { Client, Partials } from "discord.js";
import * as dotenv from "dotenv";
import ListenersHandler from "./listeners/ListenersHandler";
import LocaleManager from "./managers/LocaleManager";
import UserManager from "./managers/UserManager";
import mysql from "./providers/Mysql";
import Logger from "./utils/Logger";
// @ts-ignore
import { version } from "../package.json";
import ApplicationCommandsManager from "./managers/ApplicationCommandsManager";
import RequestsAssistantManager from "./managers/RequestsAssistantManager";
import ArticlesManager from "./managers/ArticlesManager";
import MessageBuilderManager from "./managers/MessageBuilderManager";
import childProcess from "child_process";
import SubscriptionsManager from "./managers/SubscriptionsManager";
import CustomBotsManager from "./managers/CustomBotsManager";

dotenv.config();

export default class App {
  public static version: string = version;
  public static hash: string = childProcess
    .execSync("git rev-parse HEAD")
    .toString()
    .trim();
  public static safe: boolean = !!process.argv.find((arg) => arg === "--safe");
  public static client: Client = new Client({
    intents: [
      "Guilds",
      "GuildBans",
      "GuildEmojisAndStickers",
      "GuildIntegrations",
      "GuildWebhooks",
      "GuildInvites",
      "GuildVoiceStates",
      "GuildPresences",
      "GuildMessages",
      "GuildMessageReactions",
      "GuildMessageTyping",
      "DirectMessages",
      "MessageContent",
      "GuildMembers",
    ],
    partials: [
      Partials.Channel,
      Partials.GuildMember,
      Partials.ThreadMember,
      /*Partials.Message,*/
    ],
  });
  public static readonly commands = new ApplicationCommandsManager();
  public static readonly users = new UserManager();
  public static readonly locales = new LocaleManager();
  public static readonly requests = new RequestsAssistantManager();
  public static readonly articles = new ArticlesManager();
  public static readonly messages = new MessageBuilderManager();
  public static readonly subscriptions = new SubscriptionsManager();
  public static readonly customBots = new CustomBotsManager();

  private static _initialize = false;

  private static async initialize(): Promise<void> {
    if (this._initialize) return Logger.debug("Cannot initialize twice");
    this._initialize = true;

    await mysql.connect();

    Logger.info("Fetch all articles & messages built");
    await this.articles.fetch();
    await this.messages.fetch();

    ListenersHandler.handler(this.client);

    Logger.info("[Discord] <>Bot connecting...");
    await this.client.login(
      process.argv.find((arg) => arg === "--dev")
        ? process.env.DISCORD_TEST_BOT_TOKEN
        : process.env.DISCORD_BOT_TOKEN
    );
  }

  public static async launch(): Promise<void> {
    if (process.argv.find((arg) => arg === "--test")) return this.shutdown();
    await this.initialize();
    Logger.info("App launched!");
  }

  public static shutdown(): void {
    this.client.destroy();
    process.exit();
  }
}
