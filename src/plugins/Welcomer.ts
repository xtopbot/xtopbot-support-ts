import {
  ButtonStyle,
  ChannelType,
  ComponentType,
  GuildMember,
  Role,
  TextChannel,
} from "discord.js";
import app from "../app";
import WelcomerManager from "../managers/WelcomerManager";
import Constants from "../utils/Constants";
import Exception, { Severity } from "../utils/Exception";
import Logger from "../utils/Logger";

export default class Welcomer {
  private static manager = new WelcomerManager();

  public static async onMemberJoin(member: GuildMember): Promise<void> {
    const user = await app.users.fetch(member.user);

    const localeRoles = this.getLocaleRoles(member);
    if (!localeRoles.length)
      return Logger.warn(
        `[Welcomer] Unable to find locale roles in ${member.guild.name} (${member.guild.id})`
      );

    const userLocaleRole = localeRoles.find(
      (localeRole) => localeRole.locale == user.locale
    );
    if (userLocaleRole) {
      // Auto role when this user he selected locale before.
      Logger.info(
        `[Welcomer](Auto) Add ${userLocaleRole.locale}(@${userLocaleRole.role?.name}) to user ${member.user.tag} (${member.id}) [GuildId: ${member.guild.id}] `
      );
      await member.roles.add(userLocaleRole.role as Role);
    } else {
      const message: string = localeRoles
        .filter((localeRole) => !!localeRole.message)
        .map((localeRole) => localeRole.message)
        .join("\n\n");
      if (!message)
        return Logger.debug(
          "[Welcomer] Unable to find content to send a message!"
        );
      const channel = this.getWelcomerChannel(member);
      const response = await channel.send({
        content: message,
        components: [
          {
            type: ComponentType.ActionRow,
            components: localeRoles
              .map((localeRole) => ({
                type: ComponentType.Button,
                style: ButtonStyle.Secondary,
                customId: `locale:${localeRole.locale}`,
                label: localeRole.button.label,
                emoji: localeRole.button.emoji,
              }))
              .slice(0, 5),
          },
        ],
      });
      this.manager.cache.set(member.id, response);
    }
  }

  public static onMemberLeave(member: GuildMember): void {
    const welcomerMessage = this.manager.cache.get(member.id);
    if (welcomerMessage) {
      welcomerMessage.delete();
      this.manager.cache.delete(member.id);
    }
  }

  private static getWelcomerChannel(member: GuildMember): TextChannel {
    const channel: TextChannel = member.guild.channels.cache.find(
      (channel) =>
        channel.type === ChannelType.GuildText &&
        channel.name.toLowerCase() ===
          Constants.DEFAULT_WELCOME_CHANNEL_NAME.toLowerCase()
    ) as TextChannel;
    if (!channel)
      throw new Exception(
        `Welcome channel unable to find. [Guild Id: ${member.guild.id}]`,
        Severity.FAULT
      );
    return channel;
  }

  private static getLocaleRoles(member: GuildMember) {
    return app.locales.cache
      .map((locale) => ({
        locale: locale.tag,
        role: member.guild.roles.cache.find(
          (role) =>
            role.name.toLowerCase() == locale.origin.roleName.toLowerCase()
        ),
        ...locale.origin.welcomer.memberJoin,
      }))
      .filter(
        (localeRole) =>
          typeof localeRole.role !== undefined && !!localeRole.message
      );
  }
}
