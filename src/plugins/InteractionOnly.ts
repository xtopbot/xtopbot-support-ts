import {
  ButtonStyle,
  ChannelType,
  ComponentType,
  Guild,
  Message,
  User as DiscordUser,
} from "discord.js";
import app from "../app";
import RatelimitManager from "../managers/RatelimitManager";
import ContextFormats from "../utils/ContextFormats";
import { UserFlagsPolicy } from "../structures/User";
import Logger from "../utils/Logger";
import Constants from "../utils/Constants";

export default class InteractionOnly {
  private static readonly ratelimit = new RatelimitManager<DiscordUser>(
    120000,
    5
  );

  public static async onMessage(d: Message) {
    if (!(await this.isExecutable(d, d.author))) return;
    d.delete(); // Delete author message from the channel :)
    const userRL = this.ratelimit.get(d.author);
    if (userRL.isAllowed()) {
      const user = await app.users.fetch(d.author, false);

      const locale = app.locales.get(user.locale);
      const cfx = new ContextFormats();
      cfx.setObject("user", d.author);
      cfx.formats.set("user.tag", d.author.tag);
      cfx.formats.set("emoji.slash", Constants.SLASH_EMOJI);
      if (userRL.remaining >= 4) {
        const m = await d.channel.send(
          cfx.resolve({
            ...locale.origin.plugins.interactionOnly,
            // Temporarily suspended
            /*components: [
              {
                type: ComponentType.ActionRow,
                components: [
                  {
                    type: ComponentType.Button,
                    emoji: {
                      name: "✋", // ✋ | 🤚
                    },
                    customId: "requestAssistant:create",
                    style: ButtonStyle.Secondary,
                    label: locale.origin.plugins.interactionOnly.buttons[0],
                  },
                ],
              },
            ],*/
          })
        );
        setTimeout(
          () =>
            m
              .delete()
              .catch((onrejected) =>
                Logger.warn(
                  `[InteractionOnly] Failed to delete message reason: ${onrejected?.message}`
                )
              ),
          180000
        );
      }
    } else {
      d.member?.disableCommunicationUntil(
        userRL.blockedEndAt?.getTime() ?? Date.now() + 5 * 60 * 1000,
        `Spam in (#${d.channel.id}) channel.`
      );
    }
  }

  public static async isExecutable(
    d: Message,
    d_user: DiscordUser
  ): Promise<boolean> {
    if (!d.inGuild() || d.author.bot) return false;
    const interactionChannels = this.getInteractionChannel(d.guild);
    if (!interactionChannels.map((channel) => channel.id).includes(d.channelId))
      return false;
    const user = await app.users.fetch(d_user, false);
    if (
      (user.flags & UserFlagsPolicy.SUPPORT) === UserFlagsPolicy.SUPPORT ||
      (user.flags & UserFlagsPolicy.MODERATOR) === UserFlagsPolicy.MODERATOR ||
      (user.flags & UserFlagsPolicy.DEVELOPER) === UserFlagsPolicy.DEVELOPER
    )
      return false;
    return true;
  }

  public static getInteractionChannel(guild: Guild) {
    return (
      guild.channels.cache.filter(
        (channel) =>
          channel.type === ChannelType.GuildText &&
          /commands?/i.test(channel.name)
      ) ?? []
    );
  }
}
