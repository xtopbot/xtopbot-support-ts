import { PatreonTierId } from "../structures/Subscription";
import Exception, { Severity } from "../utils/Exception";
import Util from "../utils/Util";
import db from "../providers/Mysql";
import CustomBot, { ValidationType } from "../structures/CustomBot";
import app from "../app";
import User from "../structures/User";
import { v4 as uuidv4 } from "uuid";
import pm2, { ProcessDescription } from "pm2";
import Logger from "../utils/Logger";
import { Collection } from "discord.js";
import schedule from "node-schedule";

export default class CustomBotsManager {
  public readonly processes = new Collection<
    string,
    "PROCESSING" | "PROCESSED"
  >();
  private PM2Connected = false;
  //id: User or Custom bot
  public async fetch(
    id: string | string[],
    tierId: PatreonTierId
  ): Promise<{ items: CustomBot<"GET">[]; remaining: number }> {
    if (CustomBotsManager.getCustomBotQuantityBySubscriptionTierId(tierId) < 0)
      return this.result([], tierId);
    let raws: any[] = await db.query(
      `select BIN_TO_UUID(id) as id, token, username, discriminator, avatar, botId, ownerId, tokenValidation, unix_timestamp(createdAt) as createdTimestampAt from \`Custom.Bot\` where ownerId in (?) and tierId = ? OR BIN_TO_UUID(id) in (?) and tierId = ?`,
      [id, tierId, id, tierId]
    );

    return this.result<"GET">(
      raws.map(
        (raw) =>
          new CustomBot<"GET">(
            raw.id,
            raw.token,
            raw.botId,
            raw.username,
            raw.discriminator,
            raw.avatar,
            raw.ownerId,
            raw.tokenValidation === 1,
            new Date(Math.round(raw.createdTimestampAt * 1000))
          )
      ),
      tierId
    );
  }

  public async create(
    user: User,
    token: string,
    tierId: PatreonTierId,
    checkLimit?: boolean
  ): Promise<CustomBot<"GET">> {
    const id = uuidv4();
    const customBot = new CustomBot<"CREATION">(
      id,
      token,
      null,
      null,
      null,
      null,
      null,
      null
    );
    const botData = await customBot.fetchUser();
    await customBot.validation(ValidationType.BOT, { data: botData }, null);
    await customBot.validation(
      ValidationType.APPLICATION,
      { data: await customBot.fetchApplication(), userId: user.id },
      null
    );
    await customBot.validation(
      ValidationType.GUILDS,
      {
        data: await customBot.fetchGuilds(),
        limit:
          CustomBotsManager.getCustomBotQuantityBySubscriptionTierId(tierId),
      },
      null
    );
    if (checkLimit) {
      const bots = await this.fetch(user.id, tierId);
      if (bots.remaining <= 0)
        throw new Exception(
          "Custom bot creation limit reached.",
          Severity.COMMON
        );
    }
    await db.query(
      "insert into `Custom.Bot` (id, token, botId, ownerId, username, discriminator, avatar, tokenValidation, tierId) values (UUID_TO_BIN(?), ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        id,
        token,
        botData.id,
        user.id,
        botData.username,
        botData.discriminator,
        botData.avatar,
        true,
        tierId,
      ]
    );
    return new CustomBot<"GET">(
      id,
      token,
      botData.id,
      botData.username,
      botData.discriminator,
      botData.avatar,
      user.id,
      true,
      new Date()
    );
  }

  async subscribe() {
    Logger.info(
      "[CustomBotsManager<Process>][PM2] Process Manager connecting..."
    );
    await this.PM2Connect();
    Logger.info("[CustomBotsManager<Process>][PM2] Process Manager connected");

    const rule = new schedule.RecurrenceRule();
    rule.hour = 0;
    rule.minute = 0;
    rule.second = 0;
    rule.tz = "Etc/UTC";
    Logger.info(
      "[CustomBotsManager<Process>] Subscribed (schedule every day)."
    );
    const job = schedule.scheduleJob(rule, async () => {
      Logger.info(
        "[CustomBotsManager<Process>] Validation Running Processes..."
      );
      await this.validationRunningProcesses();
      Logger.info(
        "[CustomBotsManager<Process>] Running processes have been successfully validated!"
      );
    });

    job.invoke();
  }

  private async validationRunningProcesses() {
    const processes = (await this.PM2Processes()).flatMap((process) =>
      Util.isUUID(process.name) ? process : []
    );
    Logger.info(
      "[CustomBotsManager<Process>] Fetch All Active Subscriptions..."
    );
    const activeSubscriptions = (
      await app.subscriptions.fetch(true, PatreonTierId.ONE_CUSTOM_BOT)
    ).filter((sub) => sub.isActive());
    Logger.info(
      `[CustomBotsManager<Process>] All Active Subscription Fetched (${activeSubscriptions.length})`
    );

    Logger.info("[CustomBotsManager<Process>] Fetch All Active Custom Bots...");
    const customBots = await this.fetch(
      activeSubscriptions.map((sub) => sub.discordUserId),
      PatreonTierId.ONE_CUSTOM_BOT
    );
    Logger.info(
      `[CustomBotsManager<Process>] All Custom Bots Fetched (${activeSubscriptions.length})`
    );
    //Destroy expired subscription process and add running process to cache.
    processes.map(async (p) => {
      if (Util.isUUID(p.name)) {
        if (p.pm2_env?.status === "online") {
          const customBot = customBots.items.find(
            (item) => item.id === (p.name as string)
          );
          if (customBot) {
            this.processes.set(p.name as string, "PROCESSED");
            Logger.info(
              `[CustomBotsManager<Process>] ${customBot.username}#${
                customBot.discriminator
              }(${customBot.botId}[${Util.getUUIDLowTime(
                p.name as string
              )}]) Process Running`
            );
          } else {
            Logger.info(
              `[CustomBotsManager<Process>] ${Util.getUUIDLowTime(
                p.name as string
              )} Process destroyed`
            );
            await this.PM2Delete(p.name as string);
          }
        }
      }
    });
  }

  private async PM2Connect() {
    if (this.PM2Connected)
      throw new Exception("PM2 is connected", Severity.FAULT);
    this.PM2Connected = true;
    return new Promise((resolve, reject) =>
      pm2.connect((err) =>
        err ? reject("Failed to connect PM2") : resolve(true)
      )
    );
  }

  private async PM2Processes(): Promise<ProcessDescription[]> {
    if (!this.PM2Connected)
      throw new Exception("PM2 is not connected", Severity.FAULT);
    return new Promise((resolve, reject) =>
      pm2.list((err, list) => (err ? reject(err) : resolve(list)))
    );
  }

  public async PM2Start(name: string, token: string, options?: object) {
    if (!this.PM2Connected)
      throw new Exception("PM2 is not connected", Severity.FAULT);
    return new Promise((resolve, reject) =>
      pm2.start(
        { name: name, script: "./xtopbot/custombot.js" },
        (err, process) => (err ? reject(err) : resolve(process))
      )
    );
  }

  public async PM2Delete(process: number | string) {
    if (!this.PM2Connected)
      throw new Exception("PM2 is not connected", Severity.FAULT);
    return new Promise((resolve, reject) =>
      pm2.delete(process, (err, process) =>
        err ? reject(err) : resolve(process)
      )
    );
  }

  public async PM2Describe(process: number | string) {
    if (!this.PM2Connected)
      throw new Exception("PM2 is not connected", Severity.FAULT);
    return new Promise((resolve, reject) =>
      pm2.describe(process, (err, process) =>
        err ? reject(err) : resolve(process)
      )
    );
  }

  public static getCustomBotQuantityBySubscriptionTierId(
    tierId: PatreonTierId
  ): number {
    return PatreonTierId.ONE_CUSTOM_BOT ? 1 : 0;
  }

  public static getCustomBotAccessServersSizeBySubscriptionTierId(
    tierId: PatreonTierId
  ): number {
    return PatreonTierId.ONE_CUSTOM_BOT ? 3 : 0;
  }

  private result<T extends "GET" | "CREATION">(
    customBots: CustomBot<T>[],
    tierId: PatreonTierId
  ) {
    return {
      items: customBots.slice(
        0,
        CustomBotsManager.getCustomBotQuantityBySubscriptionTierId(tierId)
      ),
      remaining: Math.max(
        0,
        CustomBotsManager.getCustomBotQuantityBySubscriptionTierId(tierId) -
          customBots.length
      ),
    };
  }
}
