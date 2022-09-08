import { PatreonTierId } from "../structures/Subscription";
import Exception, { Severity } from "../utils/Exception";
import Locale from "../structures/Locale";
import Util from "../utils/Util";
import db from "../providers/Mysql";
import CustomBot from "../structures/CustomBot";
import app from "../app";
import User from "../structures/User";
import { v4 as uuidv4 } from "uuid";

export default class CustomBotsManager {
  public async fetch(userId: string, tierId: PatreonTierId) {
    if (
      CustomBotsManager.getCustomBotQuantityBySubscriptionTierId(tierId) !== 0
    )
      return this.result([], tierId);
    let raws: any[] = await db.query(
      `select BIN_TO_UUID(id) as id, token, username, discriminator, avatar, botId, ownerId, tokenValidation, unix_timestamp(createdAt) as createdTimestampAt from \`Custom.Bots\` where ownerId = ? and tierId = ?`,
      [userId, tierId]
    );

    return this.result(
      raws.map(
        (raw) =>
          new CustomBot(
            raw.id,
            raw.token,
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
    checkLimit?: {
      tierId: PatreonTierId;
    }
  ): Promise<CustomBot> {
    const validation = await app.customBots.validation(
      token,
      user.id,
      app.locales.get(user.locale)
    );
    if (checkLimit) {
      const bots = await this.fetch(user.id, checkLimit.tierId);
      if (bots.remaining <= 0)
        throw new Exception(
          "Custom bot creation limit reached.",
          Severity.COMMON
        );
    }
    const id = uuidv4();
    await db.query(
      "insert into `Custom.Bot` (id, token, botId, ownerId, username, discriminator, avatar, tokenValidation) values (UUID_TO_BIN(?), ?, ?, ?, ?, ?, ?, ?)",
      [
        id,
        token,
        validation.bot.id,
        user.id,
        validation.bot.username,
        validation.bot.discriminator,
        validation.bot.avatar,
        true,
      ]
    );
    return new CustomBot(
      id,
      token,
      validation.bot.username,
      validation.bot.discriminator,
      validation.bot.avatar,
      user.id,
      true,
      new Date()
    );
  }

  public static getCustomBotQuantityBySubscriptionTierId(
    tierId: PatreonTierId
  ): number {
    return PatreonTierId.ONE_CUSTOM_BOT ? 1 : 0;
  }

  public async validation(token: string, userId: string, locale: Locale) {
    if (!/[a-z0-9-_.]{32,}/i.test(token))
      throw new Exception(
        locale.origin.commands.subscriptions.manage.one.bot.validations.invalidToken,
        Severity.COMMON
      );

    const fetchInit = {
      method: "get",
      headers: {
        authorization: "Bot " + token,
      },
    };
    const applicationReq = await fetch(
      "https://discord.com/api/v10/oauth2/applications/@me",
      fetchInit
    );
    if (applicationReq.status !== 200) {
      if (applicationReq.status === 401)
        throw new Exception(
          locale.origin.commands.subscriptions.manage.one.bot.validations.invalidToken,
          Severity.COMMON
        );
      throw new Exception(
        `Unexpected Discord API status code: ${applicationReq.status}`,
        Severity.FAULT
      );
    }

    const applicationData = await applicationReq.json();

    if (applicationData?.owner?.id !== userId)
      throw new Exception(
        locale.origin.commands.subscriptions.manage.one.bot.validations.ownedByUser,
        Severity.COMMON
      );
    if (applicationData.bot_public != false)
      throw new Exception(
        Util.quickFormatContext(
          locale.origin.commands.subscriptions.manage.one.bot.validations
            .public,
          { "bot.id": applicationData.id }
        ),
        Severity.COMMON
      );
    if (
      applicationData.flags === 0 ||
      (applicationData.flags & (1 << 19)) === 0
    )
      throw new Exception(
        Util.quickFormatContext(
          locale.origin.commands.subscriptions.manage.one.bot.validations
            .messageContentIntent,
          { "bot.id": applicationData.id }
        ),
        Severity.COMMON
      );

    const botReq = await fetch(
      "https://discord.com/api/v10/users/@me",
      fetchInit
    );

    if (botReq.status !== 200) {
      if (botReq.status === 401)
        throw new Exception(
          locale.origin.commands.subscriptions.manage.one.bot.validations.invalidToken,
          Severity.COMMON
        );
      throw new Exception(
        `Unexpected Discord API status code: ${botReq.status}`,
        Severity.FAULT
      );
    }

    const botData = await botReq.json();
    if ((botData.flags & (1 << 16)) !== 0)
      throw new Exception(
        locale.origin.commands.subscriptions.manage.one.bot.validations.verified,
        Severity.COMMON
      );

    const guildsReq = await fetch(
      "https://discord.com/api/v10/users/@me/guilds",
      fetchInit
    );

    if (guildsReq.status !== 200) {
      if (guildsReq.status === 401)
        throw new Exception(
          locale.origin.commands.subscriptions.manage.one.bot.validations.invalidToken,
          Severity.COMMON
        );
      throw new Exception(
        `Unexpected Discord API status code: ${guildsReq.status}`,
        Severity.FAULT
      );
    }

    const guildsData: any[] = await guildsReq.json();

    if (guildsData.length > 3)
      throw new Exception(
        locale.origin.commands.subscriptions.manage.one.bot.validations.maximumServers,
        Severity.COMMON
      );

    return {
      application: {
        id: applicationData.id,
        name: applicationData.name,
        icon: applicationData.icon,
        description: applicationData.description,
        ownerId: applicationData.owner.id,
      },
      bot: {
        id: botData.id,
        username: botData.id,
        discriminator: botData.discriminator,
        avatar: botData.avatar,
      },
      guilds: guildsData.map((guild) => ({
        id: guild.id,
        name: guild.name,
        icon: guild.icon,
        ownerId: guild.owner_id,
      })),
    };
  }

  private result(customBots: CustomBot[], tierId: PatreonTierId) {
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
