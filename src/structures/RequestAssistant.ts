import {
  ChannelType,
  Guild,
  InteractionReplyOptions,
  InteractionWebhook,
  Role,
  SnowflakeUtil,
  TextChannel,
  ThreadChannel,
} from "discord.js";
import moment from "moment";
import app from "../app";
import { LocaleTag } from "../managers/LocaleManager";
import RatelimitManager from "../managers/RatelimitManager";
import RequestHumanAssistant from "../plugins/RequestHumanAssistant";
import Constants from "../utils/Constants";
import ContextFormats from "../utils/ContextFormats";
import Exception, { Severity } from "../utils/Exception";
import User from "./User";
import db from "../providers/Mysql";
import Util from "../utils/Util";
import { v4 as uuidv4 } from "uuid";

export default class RequestAssistant {
  public readonly id: string = uuidv4();
  public readonly userId: string;
  public readonly webhook: InteractionWebhook;
  public readonly locale: LocaleTag;
  public readonly guildId: string;
  public threadId: string | null = null;
  public readonly requestedAt: Date = new Date();
  public threadCreatedAt: Date | null = null;
  public closedAt: Date | null = null; // may be thread closed or request cancelled
  public assistantId: string | null = null;
  public spamerUsers = new RatelimitManager<User>(120000, 5);
  public requesterInactive: boolean = false;
  public issue: string;
  constructor(
    issue: string,
    userId: string,
    guildId: string,
    webhook: InteractionWebhook,
    locale: LocaleTag,
    uuid?: string,
    requestedAt?: Date
  ) {
    this.issue = issue;
    this.userId = userId;
    this.webhook = webhook;
    this.guildId = guildId;
    this.locale = locale;
    this.requestedAt = requestedAt ?? this.requestedAt;
    this.id = uuid ?? this.id;
    console.log("Request UUID: ", this.id);
  }

  get status(): RequestAssistantStatus {
    if (!this.threadId) {
      if (this.closedAt) {
        if (
          this.closedAt.getTime() -
            SnowflakeUtil.timestampFrom(this.webhook.id) >
          Constants.DEFAULT_INTERACTION_EXPIRES
        ) {
          return RequestAssistantStatus.EXPIRED;
        } else return RequestAssistantStatus.CANCEL;
      }
    } else if (this.closedAt)
      return this.requesterInactive
        ? RequestAssistantStatus.INACTIVE
        : RequestAssistantStatus.SOLVED;
    if (!this.threadId) return RequestAssistantStatus.SEARCHING;
    return RequestAssistantStatus.ACTIVE;
  }

  private get guild(): Guild {
    const guild = app.client.guilds.cache.get(this.guildId);
    if (!guild)
      throw new Exception("Unable to get guild.", Severity.SUSPICIOUS);
    return this.guild;
  }

  public async getThread(force = false): Promise<ThreadChannel> {
    if (!this.threadId)
      throw new Exception("Thread not created yet!", Severity.COMMON);

    const thread = await this.guild.channels.fetch(this.threadId, {
      force: force,
    });
    if (!thread) throw new Exception("thread not found.", Severity.COMMON);

    return thread as unknown as ThreadChannel;
  }

  public async createThread(assistantId: string): Promise<ThreadChannel> {
    if (this.threadId)
      throw new Exception("Thread already created!", Severity.SUSPICIOUS);
    this.assistantId = assistantId;
    const guildAssistants = RequestHumanAssistant.getGuildAssistants(
      this.guild
    );

    const member = await this.guild.members.fetch(this.userId).catch((err) => {
      throw new Exception(
        "Member not found in support guild",
        Severity.SUSPICIOUS,
        err
      );
    });
    await member.roles.add(guildAssistants.role as Role);
    const thread = await (
      guildAssistants.channel as TextChannel
    ).threads.create({
      name: Util.textEllipsis(this.issue, 100),
      autoArchiveDuration: 60,
      type:
        this.guild.premiumTier >= 2
          ? ChannelType.GuildPrivateThread
          : ChannelType.GuildPublicThread,
      invitable: false,
    });
    const locale = app.locales.get(this.locale, true);
    const assistant = guildAssistants.assistants.get(this.locale);

    const cfx = new ContextFormats();
    await thread.members.add(member.user.id);
    cfx.setObject("user", member.user);
    cfx.formats.set("user.tag", member.user.tag);
    cfx.formats.set("support.role.id", assistant?.role.id ?? "");
    cfx.formats.set("thread.id", thread.id);
    thread.send(
      cfx.resolve(
        locale.origin.plugins.requestHumanAssistant.threadCreated.thread
      )
    );
    return thread;
  }

  public async closeThread(
    status: RequestAssistantStatus.SOLVED | RequestAssistantStatus.INACTIVE,
    followUp?: InteractionReplyOptions,
    cfx?: ContextFormats
  ): Promise<this> {
    const thread = await this.getThread();

    const member = await thread.guild.members
      .fetch(this.userId)
      .catch(() => null);
    const guildAssistants = RequestHumanAssistant.getGuildAssistants(
      thread.guild
    );

    if (
      guildAssistants.role &&
      member?.roles.cache.get(guildAssistants.role.id)
    )
      await member.roles.remove(guildAssistants.role);
    cfx ??= new ContextFormats();
    if (this.assistantId) {
      const assistant = await app.client.users.fetch(this.assistantId);
      cfx.setObject("assistant", assistant);
      cfx.formats.set("assistant.tag", assistant.tag);
    }
    console.log(followUp);
    const survery = followUp && member && !this.isInteractionExpired();
    if (survery)
      this.webhook.send({ ...cfx.resolve(followUp), ephemeral: true });

    await thread.send({
      content: "**Thread closed.**",
    });
    await thread.edit({ archived: true, locked: true });

    /*
     Send Request Assistant Log
    */
    (
      thread.guild.channels.cache.find(
        (channel) =>
          channel.name.toLowerCase() ===
            Constants.DEFAULT_NAME_ASSISATANT_REQUEST_LOG_CHANNEL.toLowerCase() &&
          channel.type === ChannelType.GuildText
      ) as TextChannel | undefined
    )?.send({
      embeds: [
        {
          title: `Thread **\`${RequestAssistantStatus[status]}\`**`,
          description:
            (this.assistantId ? `Assisted By <@${this.assistantId}>` : "") +
            `(its took ${moment(thread.createdTimestamp).fromNow(true)})`,
          color: !this.assistantId ? 12235697 /* Silver */ : 4553134 /* Blue */,
          fields: [
            {
              name: "Thread",
              value: `<#${this.threadId}>`,
              inline: true,
            },
            {
              name: "Summoner",
              value: `<@${this.userId}> (${member?.user.tag ?? ""})`,
              inline: true,
            },
            {
              name: "Requested At",
              value: `<t:${Math.round(this.requestedAt.getTime() / 1000)}:F>`,
              inline: true,
            },
            {
              name: "Language",
              value: `${this.locale}`,
              inline: true,
            },
            {
              name: "Survery",
              value: survery ? "True" : "False",
              inline: true,
            },
            {
              name: "Closed At",
              value: `<t:${Math.round(Date.now() / 1000)}:F>`,
              inline: true,
            },
          ],
        },
      ],
    });

    //Update row in database
    await db.query(
      "insert into `Assistance.Threads` set status = ?, assistantId = ? where threadId = ?",
      [status, this.assistantId ?? null, this.id]
    );

    return this;
  }

  public isInteractionExpired(): boolean {
    return (
      this.requestedAt.getTime() <=
      Date.now() - Constants.DEFAULT_INTERACTION_EXPIRES
    );
  }
}

export enum RequestAssistantStatus {
  SOLVED = 1, //Summoner issue was solved by assistant
  INACTIVE, // Summoner was inactive with assistant
  ACTIVE, // Thread is active
  SEARCHING, // Waiting for assistant accept summoner
  CANCEL, // Summoner cancel when searching for assistant
  EXPIRED, // Take to long to find assistant
  CLOSED,
}
