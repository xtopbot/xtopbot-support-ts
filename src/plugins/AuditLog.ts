import {
  Attachment,
  AuditLogEvent,
  BufferResolvable,
  ChannelType,
  FileOptions,
  Guild,
  GuildAuditLogsEntry,
  GuildMember,
  Message,
  PartialGuildMember,
  PartialMessage,
  TextChannel,
  Util,
} from "discord.js";
import type { Stream } from "stream";
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
    const contentLines = message.content.match(/\n/g);
    const isLongerContent =
      !message.partial &&
      (message.content.length > 500 ||
        (contentLines && contentLines.length > 6));
    const entry = await message.guild.fetchAuditLogs({ type: AuditLogEvent.MessageDelete });
    // removed : MessageOptions cause i need to add many "as" in the code
    const log = {
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
          description: ~message.partial
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
            }
           // no need for user language field,
          ],
        },
      ],
      files: [],
    };
    // created cause the default is [type | undefined]
    const e: GuildAuditLogsEntry<AuditLogEvent.MessageDelete, "Delete", "Message"> = entry.entries.first() as GuildAuditLogsEntry<AuditLogEvent.MessageDelete, "Delete", "Message">;
    // add moderator field if exist
    if (e && new Date().getTime() - new Date(parseInt(e.id) / 4194304 + 1420070400000).getTime() < 3000 && e.executor) {
      log.embeds[0].fields[6] = {
        name: "Moderator",
        value: "<@"+e.executor.id+">",
        inline: true
      };
    }
    else
    {
      log.embeds[0].fields[6] = {
        name: "User language",
        value: user.locale ? user.locale : "None",
        inline: true
      };
    }
    if (isLongerContent)
      (log.files as (FileOptions | BufferResolvable | Stream | Attachment)[]).push(
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
