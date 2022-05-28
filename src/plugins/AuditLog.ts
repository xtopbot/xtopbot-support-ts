import {
  Attachment,
  ChannelType,
  Guild,
  GuildMember,
  Message,
  MessageOptions,
  PartialGuildMember,
  PartialMessage,
  TextChannel,
  Util,
} from "discord.js";
import app from "../app";

export default class AuditLogPlugin {
  public static readonly defaultLogChannelNames = {
    member: "member-log", // Leave & Join & Timeout
    message: "message-log", // Delete & Edit
    rha: "rha-log", // Request Human Assistant (Status)
  };

  public static async memberLeft(member: GuildMember | PartialGuildMember) {
    const user = await app.users.fetch(member.user, false);
    this.getAuditLogChannels(member.guild).memberLogChannel?.send({
      embeds: [
        {
          author: {
            name: `${member.user.tag} (${member.user.id})`,
            icon_url: member.user.displayAvatarURL({
              size: 32,
              extension: "png",
            }),
          },
          title: "Member Left",
          fields: [
            {
              name: "Date Of Join",
              value: member.joinedTimestamp
                ? `<t:${Math.round(
                    member.joinedTimestamp / 1000
                  )}:f> (<t:${Math.round(member.joinedTimestamp / 1000)}:R>)`
                : "uncached",
              inline: true,
            },
            {
              name: "Account Age",
              value: `<t:${Math.round(
                member.user.createdTimestamp / 1000
              )}:f> (<t:${Math.round(member.user.createdTimestamp / 1000)}:R>)`,
              inline: true,
            },
            {
              name: "User Language",
              value: user.locale ? user.locale : "None",
              inline: true,
            },
          ],
        },
      ],
    });
  }

  /*
    Message Log
  */
  public static async messageDelete(message: Message | PartialMessage) {
    if (!message.inGuild() || message.author.bot) return;
    const user = await app.users.fetch(message.author, false);
    const isPartial = message.content === null || message.content === undefined;
    const contentLines = message.content.match(/\n/g);
    const isLongerContent =
      !isPartial &&
      (message.content.length > 500 ||
        (contentLines && contentLines.length > 6));
    const log: MessageOptions = {
      embeds: [
        {
          author: {
            name: `${message.author.tag} (${message.author.id})`,
            icon_url: message.author.displayAvatarURL({
              size: 32,
              extension: "png",
            }),
          },
          title: "Message Deleted",
          description: ~isPartial
            ? isLongerContent
              ? "**`Message content length > 500 or lines > 6, was attached in txt format`**"
              : Util.escapeMarkdown(message.content)
            : "**`uncached message`**",
          fields: [
            {
              name: "Message Id",
              value: message.id,
              inline: true,
            },
            {
              name: "Message Date",
              value: `<t:${Math.round(message.createdTimestamp / 1000)}:f>`,
              inline: true,
            },
            {
              name: "Channel",
              value: `<#${message.channel.id}>`,
              inline: true,
            },
            {
              name: "User Account Age",
              value: `<t:${Math.round(
                message.author.createdTimestamp / 1000
              )}:f>`,
              inline: true,
            },
            {
              name: "User Profile",
              value: `<@${user.id}>`,
              inline: true,
            },
            {
              name: "User language",
              value: user.locale ? user.locale : "None",
              inline: true,
            },
          ],
        },
      ],
      files: [],
    };
    if (isLongerContent)
      log.files?.push(
        new Attachment(Buffer.from(message.content), "content.txt")
      );
    this.getAuditLogChannels(message.guild).messageLogChannel?.send(log);
  }

  public static getAuditLogChannels(guild: Guild) {
    return {
      memberLogChannel:
        (guild.channels.cache.find(
          (channel) =>
            channel.name.toLowerCase() ==
              this.defaultLogChannelNames.member.toLowerCase() &&
            channel.type === ChannelType.GuildText
        ) as TextChannel) ?? null,
      messageLogChannel:
        (guild.channels.cache.find(
          (channel) =>
            channel.name.toLowerCase() ==
              this.defaultLogChannelNames.message.toLowerCase() &&
            channel.type === ChannelType.GuildText
        ) as TextChannel) ?? null,
      rhaLogChannel:
        (guild.channels.cache.find(
          (channel) =>
            channel.name.toLowerCase() ==
              this.defaultLogChannelNames.rha.toLowerCase() &&
            channel.type === ChannelType.GuildText
        ) as TextChannel) ?? null,
    };
  }
}
