import {
  AttachmentBuilder,
  AuditLogEvent,
  ChannelType,
  escapeMarkdown,
  Guild,
  GuildMember,
  Message,
  MessageOptions,
  PartialGuildMember,
  PartialMessage,
  TextChannel,
} from "discord.js";
import moment from "moment";
import app from "../app";
import RequestAssistant, {
  RequestAssistantStatus,
} from "../structures/RequestAssistant";
import Logger from "../utils/Logger";
import Util from "../utils/Util";

export default class AuditLogPlugin {
  public static readonly defaultLogChannelNames = {
    member: "member-log", // Leave & Join & Timeout
    message: "message-log", // Delete & Edit
    rha: "rha-log", // Request Human Assistant (Status)
  };

  public static async memberLeft(member: GuildMember | PartialGuildMember) {
    const user = await app.users.fetch(member.user, false);

    (
      await app.requests.fetchUser(user, {
        extraQuery: `and rha.guildId = ${member.guild.id}`,
        limit: 5,
      })
    ).map((request) => {
      if (request.getStatus(false) === RequestAssistantStatus.SEARCHING)
        request.cancelRequest();
    }); // Cancel Active Request When the member left the server

    this.getAuditLogChannels(member.guild).memberLogChannel?.send({
      embeds: [
        {
          color: 12008772, // Red Color
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
    if (!message.inGuild() || message.author.bot || message.partial) return;
    const user = await app.users.fetch(message.author, false);
    const contentLines = message.content.match(/\n/g);

    const isLongerContent =
      message.content.length > 500 || (contentLines && contentLines.length > 6);
    const auditLog = await message.guild.fetchAuditLogs({
      type: AuditLogEvent.MessageDelete,
    });
    const moderator = auditLog.entries.find(
      (entry) =>
        entry.createdTimestamp > Date.now() - 3000 &&
        entry.target.id === message.author.id
    )?.executor;

    const log: MessageOptions = {
      embeds: [
        {
          title: `Message Deleted (${message.id})`,
          description: message.content
            ? isLongerContent
              ? "**`Message content length > 500 or lines > 6, was attached in txt format`**"
              : escapeMarkdown(message.content)
            : "**`No content`**",
          fields: [
            {
              name: "User",
              value: `${message.author.tag} <@${user.id}>`,
              inline: true,
            },
            {
              name: "User Language",
              value: user.locale ? user.locale : "None",
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
              name: "Channel",
              value: `<#${message.channel.id}>`,
              inline: true,
            },
            {
              name: "Attachments",
              value: message.attachments.size ?? "None",
              inline: true,
            },
            (moderator
              ? {
                  name: "Moderator",
                  value: "<@" + moderator.id + ">",
                  inline: true,
                }
              : undefined) as any,
          ].filter((field) => field),
          timestamp: message.createdAt.toISOString(),
        },
      ],
      files: [],
    };
    if (isLongerContent)
      log.files?.push(
        new AttachmentBuilder(Buffer.from(message.content), {
          name: "content.txt",
        })
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

  public static async assistanceThreadClosed(
    requestAssistant: RequestAssistant
  ) {
    const guild = app.client.guilds.cache.get(requestAssistant.guildId);
    if (!guild) return Logger.debug(`guild not found to send RHA Log.`);
    const member = await guild.members
      .fetch(requestAssistant.userId)
      .catch(() => null);

    const date = new Date();
    const startOfThisMonth = new Date(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      1
    );
    const endOfThisMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    const requests = await app.requests.fetchUser(requestAssistant.userId, {
      limit: 1000,
      extraQuery: `time between unix_timestamp(${startOfThisMonth.toISOString()}) and unix_timestamp(${endOfThisMonth.toISOString()})`,
    });

    const message: MessageOptions = {
      embeds: [
        {
          title: `Thread **\`${
            RequestAssistantStatus[requestAssistant.getStatus(false)]
          }\`**`,
          description:
            (requestAssistant.assistantId
              ? `Assisted By <@${
                  requestAssistant.assistantId
                }> (its took ${moment(requestAssistant.threadCreatedAt).fromNow(
                  true
                )})`
              : "") + ``,
          color:
            requestAssistant.getStatus(false) ===
            RequestAssistantStatus.CANCELED
              ? 12235697 /* Silver */
              : 4553134 /* Blue */,
          fields: [
            {
              name: "User",
              value: `<@${requestAssistant.userId}> (${
                member?.user.tag ?? ""
              })`,
              inline: true,
            },
            {
              name: "Language",
              value: `${requestAssistant.locale}`,
              inline: true,
            },
            {
              name: "Requested At",
              value: `<t:${Math.round(
                requestAssistant.requestedAt.getTime() / 1000
              )}:F>`,
              inline: true,
            },
            {
              name: "Issue",
              value: Util.textEllipsis(requestAssistant.issue, 100),
              inline: true,
            },
          ],
          footer: {
            text: `This user has requested ${
              requests.length
            } times in ${startOfThisMonth.toLocaleString("default", {
              month: "long",
            })}`,
          },
        },
      ],
    };
    if (requestAssistant.getStatus(false) === RequestAssistantStatus.CANCELED) {
      // @ts-ignore
      message.embeds[0].fields.push({
        name: "Canceled At",
        value: `<t:${Math.round(Date.now() / 1000)}:F>`,
        inline: true,
      });
    } else if (
      [
        RequestAssistantStatus.REQUESTER_INACTIVE,
        RequestAssistantStatus.SOLVED,
        RequestAssistantStatus.CLOSED,
      ].includes(requestAssistant.getStatus(false))
    ) {
      // @ts-ignore
      message.embeds[0].fields.push(
        {
          name: "Thread",
          value: `<#${requestAssistant.threadId}>`,
          inline: true,
        },
        {
          name: "Closed At",
          value: `<t:${Math.round(Date.now() / 1000)}:F>`,
          inline: true,
        }
      );
    }
    this.getAuditLogChannels(guild).rhaLogChannel?.send(message);
  }
}
