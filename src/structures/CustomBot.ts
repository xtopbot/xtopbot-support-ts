import Exception, { Severity } from "../utils/Exception";
import app from "../app";
import Locale from "./Locale";
import { LocaleTag } from "../managers/LocaleManager";
import Util from "../utils/Util";
import Logger from "../utils/Logger";
import { PatreonTierId } from "./Subscription";
import CustomBotsManager from "../managers/CustomBotsManager";
export default class CustomBot<T extends "CREATION" | "GET"> {
  public readonly id: string;
  public declare readonly token: string | null;
  public readonly botId: T extends "GET" ? string : string | null;
  public readonly username: T extends "GET" ? string : string | null;
  public readonly discriminator: T extends "GET" ? number : number | null;
  public readonly avatar: T extends "GET" ? string : string | null;
  public readonly ownerId: T extends "GET" ? string : string | null;
  public readonly tokenValidation: T extends "GET" ? boolean : boolean | null;
  public readonly createdAt: Date;
  constructor(
    id: string,
    token: string,
    botId: T extends "GET" ? string : string | null,
    username: T extends "GET" ? string : string | null,
    discriminator: T extends "GET" ? number : number | null,
    avatar: T extends "GET" ? string : string | null,
    ownerId: T extends "GET" ? string : string | null,
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
    this.createdAt = createdAt;
  }

  public getStatus(): CustomBotStatus {
    return !this.tokenValidation
      ? CustomBotStatus.TOKEN_INVALID
      : app.customBots.processed.find((p) => p === this.id)
      ? CustomBotStatus.ONLINE
      : CustomBotStatus.PROVISIONING;
  }

  public async fetchGuilds(locale: LocaleTag | null = null) {
    const data: any[] = await this.request("/users/@me/guilds", locale);

    return data.map((d) => ({
      id: d.id,
      name: d.name,
      icon: d.icon,
      ownerId: d.owner_id,
    }));
  }

  public async fetchUser(locale: LocaleTag | null = null) {
    const data = await this.request("/users/@me", locale);

    return {
      id: data.id,
      username: data.username,
      discriminator: data.discriminator,
      avatar: data.avatar,
      flags: data.flags,
    };
  }

  public async fetchApplication(locale: LocaleTag | null = null) {
    const data = await this.request("/oauth2/applications/@me", locale);

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
      if (validation.data.own1erId !== validation.userId)
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
      if (validation.data.length > 3)
        throw new Exception(
          locale.origin.commands.subscriptions.manage.one.bot.validations.maximumServers,
          Severity.COMMON
        );
    }
  }

  private async request(uri: string, localeTag: LocaleTag | null = null) {
    const locale = app.locales.get(localeTag, true);

    if (typeof this.token !== "string" || !/[a-z0-9-_.]{32,}/i.test(this.token))
      throw new Exception(
        locale.origin.commands.subscriptions.manage.one.bot.validations.invalidToken,
        Severity.COMMON
      );

    const res = await fetch("https://discord.com/api/v10" + uri, {
      method: "get",
      headers: {
        authorization: "Bot " + this.token,
      },
    });

    if (res.status !== 200) {
      if (res.status === 401)
        throw new Exception(
          locale.origin.commands.subscriptions.manage.one.bot.validations.invalidToken,
          Severity.COMMON
        );
      throw new Exception(
        `Unexpected Discord API status code: ${res.status}`,
        Severity.FAULT
      );
    }
    return res.json();
  }

  public async start(localeTag: LocaleTag | null = null) {
    if (this.getStatus() === C)
      Logger.info(`[CustomBot<Process>] ${this.botId} Starting...`);
    if (this.getStatus() === CustomBotStatus.PROVISIONING) {
      Logger.info(`[CustomBot<Process>] ${this.botId} Validation...`);
      let valid = true;
      await this.validation(
        ValidationType.BOT,
        { data: await this.fetchUser() },
        null
      ).catch(() => (valid = false));
      if (valid)
        await this.validation(
          ValidationType.APPLICATION,
          {
            data: await this.fetchApplication(),
            userId: this.ownerId as string,
          },
          null
        ).catch(() => (valid = false));
      if (valid)
        await this.validation(
          ValidationType.GUILDS,
          {
            data: await this.fetchGuilds(),
            limit: CustomBotsManager.getCustomBotQuantityBySubscriptionTierId(
              PatreonTierId.ONE_CUSTOM_BOT
            ),
          },
          null
        ).catch(() => (valid = false));
      if (!valid)
        return Logger.info(
          `[CustomBot<Process>] ${this.botId} Validation failed!`
        );
      Logger.info(
        `[CustomBot<Process>] ${this.botId} Validation completed successfully`
      );
    }
  }
}

export enum CustomBotStatus {
  STARTED = 1,
  OFFLINE,
  PROVISIONING,
  TOKEN_INVALID,
}

export enum ValidationType {
  APPLICATION,
  BOT,
  GUILDS,
}
