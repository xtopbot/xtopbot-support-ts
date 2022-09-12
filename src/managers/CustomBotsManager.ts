import { PatreonTierId } from "../structures/Subscription";
import Exception, { Severity } from "../utils/Exception";
import Util from "../utils/Util";
import db from "../providers/Mysql";
import CustomBot, {
  CustomBotStatus,
  ValidationType,
} from "../structures/CustomBot";
import app from "../app";
import User from "../structures/User";
import { v4 as uuidv4 } from "uuid";
import pm2, { ProcessDescription } from "pm2";
import Logger from "../utils/Logger";

export default class CustomBotsManager {
  public processed: string[] = [];
  //id: User or Custom bot
  public async fetch(id: string | string[], tierId: PatreonTierId) {
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
    await this.connect();
    Logger.info("[CustomBotsManager<Process>][PM2] Process Manager connected");
    const processes = (await this.processes()).flatMap((process) =>
      Util.isUUID(process.name) ? process : []
    );
    if (processes.length < 1)
      return Logger.info(
        "[CustomBotsManager<Process>][PM2] Unable to find any processes matches UUID format"
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
    //Check Running Processes & Subscription Validation

    //Start new Process
    customBots.items.map(async (cb) => {
      if (cb.getStatus() === CustomBotStatus.PROVISIONING) {
        Logger.info(`[CustomBotsManager<Process>] ${cb.botId} Validation...`);
        let valid = true;
        await cb
          .validation(ValidationType.BOT, { data: await cb.fetchUser() }, null)
          .catch(() => (valid = false));
        if (valid)
          await cb
            .validation(
              ValidationType.APPLICATION,
              {
                data: await cb.fetchApplication(),
                userId: cb.ownerId as string,
              },
              null
            )
            .catch(() => (valid = false));
        if (valid)
          await cb
            .validation(
              ValidationType.GUILDS,
              {
                data: await cb.fetchGuilds(),
                limit:
                  CustomBotsManager.getCustomBotQuantityBySubscriptionTierId(
                    PatreonTierId.ONE_CUSTOM_BOT
                  ),
              },
              null
            )
            .catch(() => (valid = false));
        if (!valid)
          return Logger.info(
            `[CustomBotsManager<Process>] ${cb.botId} Validation failed!`
          );
        Logger.info(
          `[CustomBotsManager<Process>] ${cb.botId} Validation completed successfully`
        );
      }
    });

    /*activeSubscriptions.map((sub) => {
      let
      let process = processes.find((p) => p.name === )
    })*/
  }

  private async connect() {
    return new Promise((resolve, reject) =>
      pm2.connect((err) =>
        err ? reject("Failed to connect PM2") : resolve(true)
      )
    );
  }

  private async processes(): Promise<ProcessDescription[]> {
    return new Promise((resolve, reject) =>
      pm2.list((err, list) => (err ? reject(err) : resolve(list)))
    );
  }

  private async startPM2(name: string, token: string, options: object) {
    return new Promise((resolve, reject) =>
      pm2.start(
        { name: name, script: "../xtopbot/custombot.js" },
        (err, process) => (err ? reject(err) : resolve(process))
      )
    );
  }

  public static getCustomBotQuantityBySubscriptionTierId(
    tierId: PatreonTierId
  ): number {
    return PatreonTierId.ONE_CUSTOM_BOT ? 1 : 0;
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
