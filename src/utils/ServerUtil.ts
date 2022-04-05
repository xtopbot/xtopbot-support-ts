import { ChannelType, Guild, TextChannel } from "discord.js";
import app from "../app";
import Exception, { Severity } from "./Exception";

export default class ServerUtil {
  public static readonly DEFAULT_WELCOME_CHANNEL_NAME = "sign-up";

  public static getWelcomerChannel(guild: Guild) {
    const channel: TextChannel = guild.channels.cache.find(
      (channel) =>
        channel.type === ChannelType.GuildText &&
        channel.name.toLowerCase() ===
          this.DEFAULT_WELCOME_CHANNEL_NAME.toLowerCase()
    ) as TextChannel;
    if (!channel)
      throw new Exception(
        `Welcome channel unable to find. [Guild Id: ${guild.id}]`,
        Severity.FAULT
      );
    return channel;
  }

  public static getLocaleRoles(guild: Guild) {
    return app.locales.cache
      .map((locale) => ({
        locale: locale.tag,
        role: guild.roles.cache.find(
          (role) =>
            role.name.toLowerCase() == locale.origin.roleName.toLowerCase()
        ),
        ...locale.origin.plugins.welcomer.memberJoin,
      }))
      .filter((localeRole) => !!localeRole.role && !!localeRole.content);
  }
}
