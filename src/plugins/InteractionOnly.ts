import { ChannelType, Guild, Message, User as DiscordUser } from "discord.js";
import app from "../app";
import RatelimitManager from "../managers/RatelimitManager";
import ContextFormats from "../utils/ContextFormats";
import User, { UserFlagsPolicy } from "../structures/User";

export default class InteractionOnly {
  private static readonly ratelimit = new RatelimitManager<DiscordUser>(
    120000,
    5
  );

  public static async onMessage(d: Message) {
    const user = await app.users.fetch(d.author);
    if (!this.isExecutable(d, user)) return;
    d.delete(); // Delete author message from the channel :)
    const userRL = this.ratelimit.get(d.author);
    if (userRL.isAllowed()) {
      const locale = app.locales.get(user.locale ?? "");
      const cfx = new ContextFormats();
      cfx.setObject("user", d.author);
      cfx.formats.set("user.tag", d.author.tag);
      if (userRL.remaining >= 4)
        d.channel.send(cfx.resolve(locale.origin.plugins.interactionOnly));
    } else {
      d.member?.disableCommunicationUntil(
        userRL.blockedEndAt?.getTime() ?? Date.now() + 5 * 60 * 1000,
        `Spam in commands channel (#${d.channel.id}).`
      );
    }
  }

  public static isExecutable(d: Message, user: User): boolean {
    if (!d.inGuild() || d.author.bot) return false;
    const interactionChannels = this.getInteractionChannel(d.guild);
    if (!interactionChannels.map((channel) => channel.id).includes(d.channelId))
      return false;
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
