import { PatreonTierId } from "../structures/Subscription";
import Exception, { Severity } from "../utils/Exception";
import Locale from "../structures/Locale";
import Util from "../utils/Util";
import db from "../providers/Mysql";
import CustomBot, { ValidationType } from "../structures/CustomBot";
import app from "../app";
import User from "../structures/User";
import { v4 as uuidv4 } from "uuid";

export default class CustomBotsManager {
  public async fetch(userId: string, tierId: PatreonTierId) {
    if (CustomBotsManager.getCustomBotQuantityBySubscriptionTierId(tierId) < 0)
      return this.result([], tierId);
    let raws: any[] = await db.query(
      `select BIN_TO_UUID(id) as id, token, username, discriminator, avatar, botId, ownerId, tokenValidation, unix_timestamp(createdAt) as createdTimestampAt from \`Custom.Bot\` where ownerId = ? and tierId = ?`,
      [userId, tierId]
    );

    return this.result(
      raws.map(
        (raw) =>
          new CustomBot(
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

  public static getCustomBotQuantityBySubscriptionTierId(
    tierId: PatreonTierId
  ): number {
    return PatreonTierId.ONE_CUSTOM_BOT ? 1 : 0;
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
