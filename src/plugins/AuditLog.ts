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
  public static async timeoutMember(
    oldMember: GuildMember | PartialGuildMember,
    newMember: GuildMember
  ) {
    const timeoutType: "Add" | "Remove" | null =
      oldMember.communicationDisabledUntil == null &&
      newMember.communicationDisabledUntil !== null
        ? "Add"
        : oldMember.communicationDisabledUntil !== null &&
          newMember.communicationDisabledUntil == null
        ? "Remove"
        : null;

    if (!timeoutType) return;

    let moderator = (
      await newMember.guild.fetchAuditLogs({
        type: AuditLogEvent.MemberUpdate,
      })
    )?.entries.find(
      (entry) =>
        entry.createdTimestamp > Date.now() - 3000 &&
        entry.target?.id === newMember.user.id
    );

    const user = await app.users.fetch(newMember.user, false);

    const log: MessageOptions = {
      embeds: [
        {
          color: timeoutType == "Add" ? 12008772 : 15382153,
          author: {
            name: `${newMember.user.tag} (${newMember.user.id})`,
            icon_url: newMember.user.displayAvatarURL({
              size: 32,
              extension: "png",
            }),
          },
          title:
            timeoutType === "Add"
              ? "Member Timed Out"
              : "Member Time Out Removed",
          fields: [
            {
              name: "User",
              value: `${newMember.user.tag} <@${newMember.id}>`,
              inline: true,
            },
            {
              name: "Date Of Join",
              value: newMember.joinedTimestamp
                ? `<t:${Math.round(
                    newMember.joinedTimestamp / 1000
                  )}:f> (<t:${Math.round(newMember.joinedTimestamp / 1000)}:R>)`
                : "uncached",
              inline: true,
            },
            {
              name: "User Preferred Language",
              value: user.locale ? user.locale : "None",
              inline: true,
            },
            {
              name: "User Account Age",
              value: `<t:${Math.round(
                newMember.user.createdTimestamp / 1000
              )}:f> (<t:${Math.round(
                newMember.user.createdTimestamp / 1000
              )}:R>)`,
              inline: true,
            },
          ],
        },
      ],
    };

    if (timeoutType === "Add") {
      // @ts-ignore
      log.embeds[0].fields.push({
        name: "Duration",
        value: moment(newMember.communicationDisabledUntil).fromNow(true),
        inline: true,
      });
    }

    if (moderator && moderator.executor) {
      // @ts-ignore
      log.embeds[0].description = moderator.reason ?? "";
      // @ts-ignore
      log.embeds[0].fields.push({
        name: "Moderator",
        value: `${moderator.executor.tag} <@${moderator.executor.id}>`,
        inline: true,
      });
    }

    this.getAuditLogChannels(
      AuditLogChannelsName.MemberTimeout,
      newMember.guild
    )?.send(log);
  }

  public static async memberLeft(member: GuildMember | PartialGuildMember) {
    (
      await app.requests.fetchUser(member.user.id, {
        where: `rha.guildId = ${member.guild.id}`,
        limit: 5,
      })
    ).map((request) => {
      if (request.getStatus(false) === RequestAssistantStatus.SEARCHING)
        request.cancelRequest();
    }); // Cancel Active Request When the member left the server

    const user = await app.users.fetch(member.user, false);

    let moderator = (
      await member.guild.fetchAuditLogs<
        AuditLogEvent.MemberKick | AuditLogEvent.MemberBanAdd
      >()
    )?.entries.find(
      (entry) =>
        entry.createdTimestamp > Date.now() - 3000 &&
        entry.target?.id === member.user.id &&
        [
          AuditLogEvent[AuditLogEvent.MemberKick],
          AuditLogEvent[AuditLogEvent.MemberBanAdd],
        ].includes(entry.actionType)
    );

    const log: MessageOptions = {
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
              name: "User Account Age",
              value: `<t:${Math.round(
                member.user.createdTimestamp / 1000
              )}:f> (<t:${Math.round(member.user.createdTimestamp / 1000)}:R>)`,
              inline: true,
            },
            {
              name: "User Preferred Language",
              value: user.locale ? user.locale : "None",
              inline: true,
            },
          ],
        },
      ],
    };

    if (moderator && moderator.executor) {
      // @ts-ignore
      log.embeds[0].fields.push(
        {
          name: "Type",
          value:
            moderator.actionType === AuditLogEvent[AuditLogEvent.MemberKick]
              ? "Member Kick"
              : moderator.actionType ===
                AuditLogEvent[AuditLogEvent.MemberBanAdd]
              ? "Member Banned"
              : "Unknown",
          inline: true,
        },
        {
          name: "Moderator",
          value: `${moderator.executor.tag} <@${moderator.executor.id}>`,
          inline: true,
        },
        {
          name: "Reason",
          value: moderator.reason ?? "\n",
          inline: true,
        }
      );
    }

    this.getAuditLogChannels(AuditLogChannelsName.Member, member.guild)?.send(
      log
    );
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

    const moderator = (
      await message.guild.fetchAuditLogs({
        type: AuditLogEvent.MessageDelete,
      })
    )?.entries.find(
      (entry) =>
        entry.createdTimestamp > Date.now() - 3000 &&
        entry.target.id === message.author.id
    );

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
              name: "User Preferred Language",
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
              value:
                message.attachments.size > 0
                  ? String(message.attachments.size)
                  : "None",
              inline: true,
            },
          ],
          timestamp: message.createdAt.toISOString(),
        },
      ],
      files: [],
    };
    if (moderator && moderator.executor) {
      // @ts-ignore
      log.embeds[0].fields.push(
        {
          name: "Moderator",
          value: `${moderator.executor.tag} <@${moderator.executor.id}>`,
          inline: true,
        },
        {
          name: "Reason",
          value: moderator.reason ?? "\n",
          inline: true,
        }
      );
    }
    if (isLongerContent)
      log.files?.push(
        new AttachmentBuilder(Buffer.from(message.content), {
          name: "content.txt",
        })
      );
    this.getAuditLogChannels(AuditLogChannelsName.Message, message.guild)?.send(
      log
    );
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
      where: `unix_timestamp(rha.createdAt) between unix_timestamp("${startOfThisMonth.toISOString()}") and unix_timestamp("${endOfThisMonth.toISOString()}")`,
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
    this.getAuditLogChannels(AuditLogChannelsName.RHA, guild)?.send(message);
  }

  private static getAuditLogChannels(
    type: AuditLogChannelsName,
    guild: Guild
  ): TextChannel | null {
    return (
      (guild.channels.cache.find(
        (channel) =>
          channel.name.toLowerCase() == type.toLowerCase() &&
          channel.type === ChannelType.GuildText
      ) as TextChannel) ?? null
    );
  }
}

enum AuditLogChannelsName {
  Member = "member-log",
  MemberTimeout = "timeout-log",
  Message = "message-log",
  RHA = "rha-log",
}
