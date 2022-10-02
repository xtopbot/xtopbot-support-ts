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
import { ButtonStyle, Collection, ComponentType } from "discord.js";
import schedule from "node-schedule";
import Constants from "../utils/Constants";

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
    if (
      CustomBotsManager.getCustomBotQuantityBySubscriptionTierId(tierId) < 0 ||
      (Array.isArray(id) && id.length <= 0)
    )
      return this.result([], tierId);
    let raws: any[] = await db.query(
      `select BIN_TO_UUID(id) as id, token, username, discriminator, avatar, botId, ownerId, tierId, tokenValidation, activityType, activityName, botStatus, unix_timestamp(createdAt) as createdTimestampAt 
              from \`Custom.Bot\`
              where ownerId in (?) and tierId = ? OR botId in (?) and tierId = ? OR BIN_TO_UUID(id) in (?) and tierId = ?`,
      [id, tierId, id, tierId, id, tierId]
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
            raw.tierId,
            raw.botStatus ?? null,
            raw.activityType ?? null,
            raw.activityName ?? null,
            raw.tokenValidation === 1,
            new Date(Math.round(raw.createdTimestampAt * 1000))
          )
      ),
      tierId
    );
  }

  public async fetchBots(ids: string[]): Promise<CustomBot<"GET">[]>;
  public async fetchBots(id: string): Promise<CustomBot<"GET"> | null>;
  public async fetchBots(
    id: string | string[]
  ): Promise<CustomBot<"GET"> | CustomBot<"GET">[] | null> {
    const fetchType: "SINGLE" | "MULTIPLE" = Array.isArray(id)
      ? "MULTIPLE"
      : "SINGLE";
    let raws: any[] = await db.query(
      `select BIN_TO_UUID(id) as id, token, username, discriminator, avatar, botId, ownerId, tierId, tokenValidation, activityType, activityName, botStatus, unix_timestamp(createdAt) as createdTimestampAt 
              from \`Custom.Bot\`
              where botId in (?) OR ownerId in (?) OR BIN_TO_UUID(id) in (?)`,
      [id, id, id]
    );
    const raw = raws[0];
    if (!raw) return fetchType === "MULTIPLE" ? [] : null;

    const resolved = raws.map(
      (r) =>
        new CustomBot<"GET">(
          r.id,
          r.token,
          r.botId,
          r.username,
          r.discriminator,
          r.avatar,
          r.ownerId,
          r.tierId,
          r.botStatus ?? null,
          r.activityType ?? null,
          r.activityName ?? null,
          r.tokenValidation === 1,
          new Date(Math.round(r.createdTimestampAt * 1000))
        )
    );

    return fetchType === "MULTIPLE" ? resolved : resolved[0];
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
      tierId,
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
    let err: any = null;
    await db
      .query(
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
      )
      .catch((error) => {
        err = error;
      });
    if (err) {
      if (err?.cause?.code == "ER_DUP_ENTRY")
        throw new Exception(
          "This bot is already entered, try another bot.",
          Severity.COMMON
        );
      throw new Exception(
        err?.cause?.message ?? "Unknown",
        Severity.FAULT,
        err
      );
    }
    return new CustomBot<"GET">(
      id,
      token,
      botData.id,
      botData.username,
      botData.discriminator,
      botData.avatar,
      user.id,
      tierId,
      null,
      null,
      null,
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
    this.listener();

    job.invoke();
  }

  private listener() {
    Logger.info("[CustomBotsManager<Process>] Listening to processes...");
    process.on("message", async (packet: any) => {
      console.log("Received message from process", packet);
      const data = packet?.data?.data;
      Logger.info(
        `[CustomBotsManager<Listener>] Recevied Message From ${data?.process?.name} Process.`
      );
      if (packet?.data?.op === "CUSTOM_BOT_GUILD_ADDED") {
        const customBot = await this.fetchBots(data.botId as string);
        if (!customBot)
          return this.PM2Delete(data.process.name).catch(() => null);
        const subscription = await app.subscriptions.fetch(
          customBot.ownerId,
          customBot.tierId
        );
        if (!subscription || !subscription.isActive())
          return this.PM2Delete(data.process.name).catch(() => null);
        const application = await customBot
          .fetchApplication()
          .catch(() => null);
        if (
          application &&
          !(await customBot
            .validation(
              ValidationType.APPLICATION,
              { data: application, userId: customBot.ownerId },
              null
            )
            .catch(() => false))
        )
          return Logger.info(
            `[CustomBotsManager<Listener>] ${customBot.username}#${
              customBot.discriminator
            } (${Util.getUUIDLowTime(
              customBot.id
            )}) Process fails in validation.`
          );
        if (
          data.guildsSize >
          CustomBotsManager.getCustomBotAccessServersSizeBySubscriptionTierId(
            subscription.tierId
          )
        ) {
          customBot.leaveGuild(data.guild.id).catch(() => null);
          const user = await app.users.fetch(subscription.discordUserId);
          const dm = await (
            await app.client.users.fetch(subscription.discordUserId)
          )
            .createDM()
            .catch(() => null);
          const locale = app.locales.get(user.locale);
          dm?.send({
            ...Util.addFieldToEmbed(
              Util.quickFormatContext(
                locale.origin.commands.subscriptions.manage.one.bot
                  .guildsLimitReached,
                {
                  "bot.tag": customBot.username + "#" + customBot.discriminator,
                  "custom.bot.id.short": Util.getUUIDLowTime(customBot.id),
                  "custom.bot.allowed.servers":
                    CustomBotsManager.getCustomBotAccessServersSizeBySubscriptionTierId(
                      subscription.tierId
                    ),
                }
              ),
              0,
              "color",
              Constants.defaultColors.ORANGE
            ),
            components: [
              {
                type: ComponentType.ActionRow,
                components: [
                  {
                    type: ComponentType.Button,
                    style: ButtonStyle.Primary,
                    customId: `subscription:tier:${subscription.tierId}:bots:${customBot.id}:reply`,
                    label: Util.textEllipsis(
                      Util.quickFormatContext(
                        locale.origin.commands.subscriptions.manage.one.bot
                          .guildsLimitReached.buttons[0],
                        {
                          "bot.tag":
                            customBot.username + "#" + customBot.discriminator,
                        }
                      ),
                      40
                    ),
                  },
                ],
              },
            ],
          });
        }
      }
    });
  }

  private async validationRunningProcesses() {
    const processes = (await this.PM2Processes()).flatMap((process) =>
      Util.isUUID(process.name) ? process : []
    );
    Logger.info(
      "[CustomBotsManager<Process>] Fetch All Active Subscriptions..."
    );
    const activeSubscriptions = (await app.subscriptions.fetch(true)).filter(
      (sub) => sub.isActive()
    );
    Logger.info(
      `[CustomBotsManager<Process>] All Active Subscription Fetched (${activeSubscriptions.length})`
    );

    Logger.info("[CustomBotsManager<Process>] Fetch All Active Custom Bots...");
    const customBots = await this.fetchBots(
      activeSubscriptions.map((sub) => sub.discordUserId)
    );
    Logger.info(
      `[CustomBotsManager<Process>] All Custom Bots Fetched (${customBots.length})`
    );
    //Destroy expired subscription process and add running process to cache.
    processes.map(async (p) => {
      if (Util.isUUID(p.name)) {
        if (p.pm2_env?.status === "online") {
          const customBot = customBots.find(
            (item) => item.id === (p.name as string)
          );
          if (
            customBot &&
            activeSubscriptions.find(
              (sub) =>
                sub.discordUserId === customBot.ownerId &&
                sub.tierId === customBot.tierId
            )
          ) {
            this.processes.set(p.name as string, "PROCESSED");
            Logger.info(
              `[CustomBotsManager<Process>] ${customBot.username}#${
                customBot.discriminator
              }(${customBot.botId}[${Util.getUUIDLowTime(
                p.name as string
              )}]) Process Running`
            );
          } else {
            Logger.warn(
              `[CustomBotsManager<Process>] ${Util.getUUIDLowTime(
                p.name as string
              )} Process destroyed`
            );
            await this.PM2Delete(p.name as string);
          }
        }
      }
    });

    //Start bots that not running.
    if (app.mode === "PRODUCTION")
      customBots.map(async (customBot) => {
        if (
          !this.processes.get(customBot.id) &&
          activeSubscriptions.find(
            (sub) =>
              sub.discordUserId === customBot.ownerId &&
              sub.tierId === customBot.tierId
          )
        ) {
          await customBot
            .start()
            .catch((err) =>
              Logger.error(
                `[CustomBotsManager<Process>] ${customBot.username}#${
                  customBot.discriminator
                }(${customBot.botId}[${Util.getUUIDLowTime(
                  customBot.id
                )}]) Failed to auto start process for custom bot: ${
                  err?.message ?? err?.reason
                }`
              )
            )
            .finally(() => {
              Logger.info(
                `\`[CustomBotsManager<Process>] ${customBot.username}#${
                  customBot.discriminator
                }(${customBot.botId}[${Util.getUUIDLowTime(
                  customBot.id
                )}]) Auto started successfuly\``
              );
            });
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

  public async PM2Start(
    name: string,
    token: string,
    options?: { args?: any[]; processOptions?: object }
  ) {
    if (!this.PM2Connected)
      throw new Exception("PM2 is not connected", Severity.FAULT);
    this.processes.set(name, "PROCESSING");
    await this.PM2Delete(name).catch(() => null);
    return new Promise((resolve, reject) =>
      pm2.start(
        {
          name: name,
          script: `./xtopbot-js/launch.js`,
          args: `--token ${token} --uuid ${name} ${
            options?.args?.join(" ") ?? ""
          }`,
          interpreter: "node@16.11.1",
        },
        (err, process) => {
          if (err) {
            this.processes.delete(name);
            return reject(err);
          }
          this.processes.set(name, "PROCESSED");
          return resolve(process);
        }
      )
    );
  }

  public async PM2Delete(name: number | string) {
    if (!this.PM2Connected)
      throw new Exception("PM2 is not connected", Severity.FAULT);
    return new Promise((resolve, reject) =>
      pm2.delete(name, (err, process) => {
        if (err) return reject(err);
        if (typeof name === "string") this.processes.delete(name);
        return resolve(process);
      })
    );
  }

  public async PM2Describe(
    process: number | string
  ): Promise<ProcessDescription[]> {
    if (!this.PM2Connected)
      throw new Exception("PM2 is not connected", Severity.FAULT);
    return new Promise((resolve, reject) =>
      pm2.describe(process, (err, process) =>
        err ? reject(err) : resolve(process)
      )
    );
  }

  public async PM2SendDataToProcess(
    name: string,
    data: { op: "UPDATE_PRESENCE"; data: object }
  ) {
    const process = (await this.PM2Describe(name))[0];
    if (!process)
      throw new Exception(
        `Unable to the process with name: ${name}`,
        Severity.SUSPICIOUS
      );
    return new Promise((resolve, reject) =>
      pm2.sendDataToProcessId(
        process.pm_id as number,
        {
          type: "process:msg",
          data: data,
          topic: "CUSTOM_BOTS_MANAGER",
        },
        (err, process) => (err ? reject(err) : resolve(process))
      )
    );
  }

  public static getCustomBotQuantityBySubscriptionTierId(
    tierId: PatreonTierId
  ): number {
    return tierId === PatreonTierId.ONE_CUSTOM_BOT
      ? 1
      : tierId === PatreonTierId.THREE_CUSTOM_BOT
      ? 3
      : 0;
  }

  public static getCustomBotAccessServersSizeBySubscriptionTierId(
    tierId: PatreonTierId
  ): number {
    return tierId === PatreonTierId.ONE_CUSTOM_BOT ||
      tierId === PatreonTierId.THREE_CUSTOM_BOT
      ? 3
      : 0;
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
