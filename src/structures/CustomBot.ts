import Exception, { Severity } from "../utils/Exception";
import app from "../app";
import { LocaleTag } from "../managers/LocaleManager";
import Util from "../utils/Util";
import Logger from "../utils/Logger";
import { PatreonTierId } from "./Subscription";
import CustomBotsManager from "../managers/CustomBotsManager";
import db from "../providers/Mysql";

export type BotStatus = "online" | "idle" | "dnd" | "invisible";
export type ActivityType = "PLAYING" | "LISTENING" | "WATCHING" | "STREAMING";
export default class CustomBot<T extends "CREATION" | "GET"> {
  public readonly id: string;
  public declare readonly token: string | null;
  public readonly botId: T extends "GET" ? string : string | null;
  public username: T extends "GET" ? string : string | null;
  public discriminator: T extends "GET" ? number : number | null;
  public avatar: T extends "GET" ? string : string | null;
  public readonly ownerId: T extends "GET" ? string : string | null;
  public presence: {
    status: BotStatus | null;
    activity: {
      type: ActivityType | null;
      name: string | null;
    };
  };
  public tokenValidation: T extends "GET" ? boolean : boolean | null;
  public readonly createdAt: Date;
  constructor(
    id: string,
    token: string,
    botId: T extends "GET" ? string : string | null,
    username: T extends "GET" ? string : string | null,
    discriminator: T extends "GET" ? number : number | null,
    avatar: T extends "GET" ? string : string | null,
    ownerId: T extends "GET" ? string : string | null,
    botStatus: T extends "GET" ? BotStatus | null : null,
    activityType: T extends "GET" ? ActivityType | null : null,
    activityName: T extends "GET" ? string | null : null,
    tokenValidation: T extends "GET" ? boolean : boolean | null,
    createdAt: Date = new Date()
  ) {
    this.id = id;
    this.token = token;
    this.botId = botId;
    this.username = username;
    this.discriminator = discriminator;
    this.avatar = avatar;
    this.ownerId = ownerId;
    this.tokenValidation = tokenValidation;
    this.presence = {
      status: botStatus,
      activity: {
        type: activityType,
        name: activityName,
      },
    };
    this.createdAt = createdAt;
  }

  public getAvatar(): T extends "GET" ? string : null;
  public getAvatar(): string | null {
    if (typeof this.discriminator !== "number") return null;
    return !this.avatar
      ? `https://cdn.discordapp.com/embed/avatars/${this.discriminator % 5}.png`
      : `https://cdn.discordapp.com/avatars/${this.botId}/${this.avatar}.${
          this.avatar.startsWith("a_") ? "gif" : "png"
        }`;
  }

  public getStatus(): CustomBotStatus {
    return !this.tokenValidation
      ? CustomBotStatus.TOKEN_INVALID
      : app.customBots.processes.get(this.id) === "PROCESSED"
      ? CustomBotStatus.RUNNING
      : app.customBots.processes.get(this.id) === "PROCESSING"
      ? CustomBotStatus.PROVISIONING
      : CustomBotStatus.OFFLINE;
  }

  public async fetchGuilds(locale: LocaleTag | null = null) {
    const data: any[] = await this.apiRequest(
      "/users/@me/guilds",
      "get",
      locale
    );

    return data.map((d) => ({
      id: d.id,
      name: d.name,
      icon: d.icon,
      ownerId: d.owner_id,
    }));
  }

  public async fetchUser(locale: LocaleTag | null = null) {
    const data = await this.apiRequest("/users/@me", "get", locale);

    if (
      this.id &&
      (data.username !== this.username ||
        data.discriminator !== this.discriminator ||
        data.avatar !== this.avatar)
    ) {
      this.username = data.username;
      this.discriminator = Number(data.discriminator);
      this.avatar = data.avatar;
      await db.query(
        "update `Custom.Bot` set username = ?, discriminator = ?, avatar = ?  where BIN_TO_UUID(id) = ?",
        [data.username, Number(data.discriminator), data.avatar, this.id]
      );
    }
    return {
      id: data.id,
      username: data.username,
      discriminator: Number(data.discriminator),
      avatar: data.avatar,
      flags: data.flags,
    };
  }

  public async fetchApplication(locale: LocaleTag | null = null) {
    const data = await this.apiRequest(
      "/oauth2/applications/@me",
      "get",
      locale
    );

    return {
      id: data.id,
      name: data.name,
      icon: data.icon,
      description: data.description,
      ownerId: data.owner.id,
      botPublic: data.bot_public,
      flags: data.flags,
    };
  }

  public async leaveGuild(id: string, locale: LocaleTag | null = null) {
    await this.apiRequest(`/users/@me/guilds/${id}`, "delete", locale);
  }

  public async validation(
    type: ValidationType.BOT,
    validation: {
      data: {
        flags: number;
      };
    },
    localeTag: LocaleTag | null
  ): Promise<void>;
  public async validation(
    type: ValidationType.APPLICATION,
    validation: {
      data: {
        id: string;
        flags: number;
        botPublic: boolean;
        ownerId: string;
      };
      userId: string;
    },
    localeTag: LocaleTag | null
  ): Promise<void>;
  public async validation(
    type: ValidationType.GUILDS,
    validation: {
      data: any[];
      limit: number;
    },
    localeTag: LocaleTag | null
  ): Promise<void>;
  public async validation(
    type:
      | ValidationType.GUILDS
      | ValidationType.BOT
      | ValidationType.APPLICATION,
    validation: any,
    localeTag: LocaleTag | null = null
  ): Promise<void> {
    const locale = app.locales.get(localeTag, true);

    if (type === ValidationType.APPLICATION) {
      if (validation.data.ownerId !== validation.userId)
        throw new Exception(
          locale.origin.commands.subscriptions.manage.one.bot.validations.ownedByUser,
          Severity.COMMON
        );
      if (validation.data.botPublic != false)
        throw new Exception(
          Util.quickFormatContext(
            locale.origin.commands.subscriptions.manage.one.bot.validations
              .public,
            { "bot.id": validation.data.id }
          ),
          Severity.COMMON
        );
      if (
        validation.data.flags === 0 ||
        (validation.data.flags & (1 << 19)) === 0
      )
        throw new Exception(
          Util.quickFormatContext(
            locale.origin.commands.subscriptions.manage.one.bot.validations
              .messageContentIntent,
            { "bot.id": validation.data.id }
          ),
          Severity.COMMON
        );
    } else if (type === ValidationType.BOT) {
      if ((validation.data.flags & (1 << 16)) !== 0)
        throw new Exception(
          locale.origin.commands.subscriptions.manage.one.bot.validations.verified,
          Severity.COMMON
        );
    } else if (type === ValidationType.GUILDS) {
      if (validation.data.length > validation.data.limit)
        throw new Exception(
          Util.quickFormatContext(
            locale.origin.commands.subscriptions.manage.one.bot.validations
              .maximumServers,
            { "custom.bot.allowed.servers": validation.data.limit }
          ),
          Severity.COMMON
        );
    }
  }

  private async apiRequest(
    uri: string,
    method: "get" | "post" | "delete" | "put" = "get",
    localeTag: LocaleTag | null = null
  ) {
    const locale = app.locales.get(localeTag, true);

    if (this.botId && this.tokenValidation != true)
      throw new Exception("Token invalid", Severity.COMMON);

    if (typeof this.token !== "string" || !/[a-z0-9-_.]{32,}/i.test(this.token))
      throw new Exception(
        locale.origin.commands.subscriptions.manage.one.bot.validations.invalidToken,
        Severity.COMMON
      );

    const res = await fetch("https://discord.com/api/v10" + uri, {
      method: method,
      headers: {
        authorization: "Bot " + this.token,
      },
    });

    if (!(res.status >= 200 && res.status < 300)) {
      if (res.status === 401) {
        await db.query(
          "update `Custom.Bot` set tokenValidation = 0 where BIN_TO_UUID(id) = ?",
          [this.id]
        );
        if (this.getStatus() === CustomBotStatus.RUNNING) this.stop();
        this.tokenValidation = false;
        throw new Exception(
          locale.origin.commands.subscriptions.manage.one.bot.validations.invalidToken,
          Severity.COMMON
        );
      }
      throw new Exception(
        `Unexpected Discord API status code: ${res.status}`,
        Severity.FAULT,
        `Unexpected Discord API status code: ${res.status}`
      );
    }
    return res.json();
  }

  public async start() {
    if (this.getStatus() !== CustomBotStatus.OFFLINE)
      throw new Exception(
        `Status of this custom bot is inoperable. status: ${Util.capitalize(
          CustomBotStatus[this.getStatus()]
        )}`,
        Severity.COMMON
      );
    Logger.info(
      `[CustomBot<Process>] ${this.botId} Starting(Section: validation)...`
    );
    app.customBots.processes.set(this.id, "PROCESSING");
    let valid = true;
    let user, application, guilds;
    user = await this.fetchUser();
    await this.validation(ValidationType.BOT, { data: user }, null).catch(
      () => (valid = false)
    );
    if (valid) {
      application = await this.fetchApplication();
      await this.validation(
        ValidationType.APPLICATION,
        {
          data: application,
          userId: this.ownerId as string,
        },
        null
      ).catch(() => (valid = false));
    }
    if (valid) {
      guilds = await this.fetchGuilds();
      await this.validation(
        ValidationType.GUILDS,
        {
          data: guilds,
          limit: CustomBotsManager.getCustomBotQuantityBySubscriptionTierId(
            PatreonTierId.ONE_CUSTOM_BOT
          ),
        },
        null
      ).catch(() => (valid = false));
    }
    if (!valid)
      return Logger.info(
        `[CustomBot<Process>] ${this.botId} Validation failed!`
      );
    Logger.info(
      `[CustomBot<Process>] ${this.botId} Validation completed successfully. Starting<Process>`
    );
    app.customBots
      .PM2Start(this.id, this.token as string, {
        args: [
          "--status",
          this.presence.status ?? "online",
          "--activityType",
          this.presence.activity.type && this.presence.activity.name
            ? this.presence.activity.type
            : "LISTENING",
          "--activityName",
          this.presence.activity.type && this.presence.activity.name
            ? Util.textEllipsis(this.presence.activity.name, 125)
            : "/play",
        ],
      })
      .catch((onrejected) => {
        Logger.error(
          onrejected,
          `[Custombot<process>] ${this.id} Failed to start`
        );
      });
    Logger.info(`[CustomBot<Process>] ${this.botId} Processed successfully`);
    return {
      user,
      application: application,
      guilds: guilds,
    };
  }

  public async stop() {
    if (this.getStatus() !== CustomBotStatus.RUNNING)
      throw new Exception(
        `status of this custom bot is inoperable. status: ${Util.capitalize(
          CustomBotStatus[this.getStatus()]
        )}`,
        Severity.SUSPICIOUS
      );
    await app.customBots.PM2Delete(this.id);
  }

  public async terminate() {
    if (this.createdAt.getTime() + 600_000 > Date.now())
      throw new Exception(
        `Creation date must be at least 5 minutes long`,
        Severity.SUSPICIOUS
      );
    await this.stop().catch(() => null);
    await db.query("delete from `Custom.Bot` where BIN_TO_UUID(id) = ?", [
      this.id,
    ]);
  }

  public async updatePresence(
    status: BotStatus | null,
    activity: {
      type: ActivityType | null;
      name: string | null;
    } | null
  ) {
    if (this.getStatus() === CustomBotStatus.TOKEN_INVALID)
      throw new Exception(
        `status of this custom bot is inoperable. status: ${Util.capitalize(
          CustomBotStatus[this.getStatus()]
        )}`,
        Severity.SUSPICIOUS
      );
    await db.query(
      "update `Custom.Bot` set botStatus = ?, activityType = ?, activityName = ? where BIN_TO_UUID(id) = ?",
      [status, activity?.type ?? null, activity?.name ?? null, this.id]
    );
    this.presence.status = status;
    this.presence.activity = {
      type: activity?.type ?? null,
      name: activity?.name ?? null,
    };
    if (this.getStatus() === CustomBotStatus.RUNNING)
      await this.sendDataToProcess();
  }

  public async sendDataToProcess() {
    if (this.getStatus() !== CustomBotStatus.RUNNING)
      throw new Exception("Must the bot running.", Severity.SUSPICIOUS);
    await app.customBots.PM2SendDataToProcess(this.id, {
      op: "UPDATE_PRESENCE",
      data: {
        status: this.presence.status ?? "online",
        activity: {
          type:
            this.presence.activity.type && this.presence.activity.name
              ? this.presence.activity.type
              : "LISTENING",
          name:
            this.presence.activity.type && this.presence.activity.name
              ? Util.textEllipsis(this.presence.activity.name, 125)
              : "/play",
        },
      },
    });
  }
}

export enum CustomBotStatus {
  RUNNING = 1,
  OFFLINE,
  PROVISIONING,
  TOKEN_INVALID,
}

export enum ValidationType {
  APPLICATION,
  BOT,
  GUILDS,
}
