import { PatreonTierId } from "../structures/Subscription";
import Exception, { Severity } from "../utils/Exception";
import Locale from "../structures/Locale";
import Util from "../utils/Util";

export default class CustomBotsManager {
  public async fetch(userId: string, tierId: PatreonTierId) {
    if (
      CustomBotsManager.getCustomBotQuantityBySubscriptionTierId(tierId) !== 0
    )
      return [];
    return [];
  }

  public static getCustomBotQuantityBySubscriptionTierId(
    tierId: PatreonTierId
  ): number {
    return PatreonTierId.ONE_CUSTOM_BOT ? 1 : 0;
  }

  public async validation(
    token: string,
    userId: string,
    locale: Locale
  ): Promise<void> {
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
    if (botData.flags === 0 || (applicationData.flags & (1 << 16)) === 0)
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

    const guildsData = await guildsReq.json();

    if (guildsData.length > 3)
      throw new Exception(
        locale.origin.commands.subscriptions.manage.one.bot.validations.maximumServers,
        Severity.COMMON
      );
  }
}
