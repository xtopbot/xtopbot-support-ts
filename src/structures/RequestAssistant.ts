import {
  ChannelType,
  Guild,
  InteractionReplyOptions,
  InteractionWebhook,
  Message,
  Role,
  SnowflakeUtil,
  TextChannel,
  ThreadChannel,
  WebhookEditMessageOptions,
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
import Logger from "../utils/Logger";

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
  private assistantRequestsChannelId: string | null = null;
  private assistantRequestMessageId: string | null = null;
  private timeoutRequest: NodeJS.Timeout | null = null;
  constructor(
    issue: string,
    userId: string,
    guildId: string,
    webhook: InteractionWebhook,
    locale: LocaleTag,
    uuid?: string,
    requestedAt?: number
  ) {
    this.issue = issue;
    this.userId = userId;
    this.webhook = webhook;
    this.guildId = guildId;
    this.locale = locale;
    this.requestedAt = requestedAt
      ? new Date(Math.round(requestedAt * 1000))
      : this.requestedAt;
    this.id = uuid ?? this.id;
    console.log("Request UUID: ", this.id);
  }

  get status(): RequestAssistantStatus {
    if (this.closedAt) {
      if (!this.threadId) return RequestAssistantStatus.CANCELED;

      return this.requesterInactive
        ? RequestAssistantStatus.INACTIVE
        : RequestAssistantStatus.SOLVED;
    }
    if (!this.threadId) {
      if (
        Date.now() - this.requestedAt.getTime() >
        Constants.DEFAULT_INTERACTION_EXPIRES - 15000
      )
        return RequestAssistantStatus.EXPIRED;
      return RequestAssistantStatus.SEARCHING;
    }
    return RequestAssistantStatus.ACTIVE;
  }

  private get guild(): Guild {
    const guild = app.client.guilds.cache.get(this.guildId);
    if (!guild)
      throw new Exception("Unable to get guild.", Severity.SUSPICIOUS);
    return guild;
  }

  public setRequestTimeout(
    time: number = Constants.DEFAULT_INTERACTION_EXPIRES - 15000
  ) {
    if (this.timeoutRequest) clearTimeout(this.timeoutRequest);
    this.timeoutRequest = setTimeout(async () => {
      if (
        this.status === RequestAssistantStatus.SEARCHING ||
        this.status === RequestAssistantStatus.EXPIRED
      ) {
        const locale = app.locales.get(this.locale) || app.locales.get(null);
        const cfx = new ContextFormats();
        cfx.formats.set("request.uuid", this.id);
        cfx.formats.set("user.id", this.userId);
        this.webhook
          .editMessage("@original", {
            ...cfx.resolve(
              locale.origin.plugins.requestHumanAssistant.requestCanceled
                .expired.update
            ),
            components: [],
          })
          .catch((err) =>
            Logger.error(
              `Error Edit Interaction Message For Request Assistant Reason Of Edit: Request Expired. Message Error: ${err.message}`
            )
          );
        this.webhook
          .send({
            ...cfx.resolve(
              locale.origin.plugins.requestHumanAssistant.requestCanceled
                .expired.followUp
            ),
            ephemeral: true,
          })
          .catch((err) =>
            Logger.error(
              `Error FollowUp Interaction Message For Request Assistant Reason Of FollowUp: Request Expired. Message Error: ${err.message}`
            )
          );
      }
    }, time);
  }

  public async getControlMessageForAssistant(): Promise<Message> {
    if (!this.assistantRequestsChannelId || !this.assistantRequestMessageId)
      throw new Exception(
        "Control Assistant Message not setted!",
        Severity.FAULT
      );

    const channel = await this.guild.channels.fetch(
      this.assistantRequestsChannelId,
      { force: false }
    );
    if (!channel)
      throw new Exception(
        "Unable to find control requests channel",
        Severity.FAULT
      );
    return (channel as TextChannel).messages.fetch(
      this.assistantRequestMessageId
    );
  }

  public setControlMessageForAssistant(
    channelId: string,
    messageId: string
  ): void {
    this.assistantRequestsChannelId = channelId;
    this.assistantRequestMessageId = messageId;
  }

  public async getThread(force = false): Promise<ThreadChannel> {
    if (!this.threadId)
      throw new Exception("Thread not created yet!", Severity.SUSPICIOUS);

    const thread = await this.guild.channels.fetch(this.threadId, {
      force: force,
    });
    if (!thread) throw new Exception("thread not found.", Severity.COMMON);

    return thread as unknown as ThreadChannel;
  }

  public async createThread(assistantId: string): Promise<ThreadChannel> {
    if (this.threadId)
      throw new Exception("Thread already created!", Severity.SUSPICIOUS);
    if (this.status !== RequestAssistantStatus.SEARCHING)
      throw new Exception(
        "Status of request is unprepared to create a thread",
        Severity.SUSPICIOUS
      );
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
    this.threadCreatedAt = new Date();
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

    await db
      .query(
        "INSERT INTO `Request.Human.Assistant.Thread` (uuid, threadId, assistantId) values (UUID_TO_BIN(?), ?, ?)",
        [this.id, thread.id, assistantId]
      )
      .catch((rejected) => {
        thread.delete();
        throw new Exception(
          "Something was wrong please try again!",
          Severity.FAULT,
          rejected
        );
      });
    await member.roles.add(guildAssistants.role as Role);

    await thread.members.add(member.user.id);
    await thread.members.add(assistantId);

    const locale = app.locales.get(this.locale, true);
    const cfx = new ContextFormats();
    cfx.setObject("requester", member.user);
    cfx.formats.set("requester.tag", member.user.tag);
    cfx.formats.set("request.uuid", this.id);
    cfx.formats.set("thread.id", thread.id);
    cfx.formats.set("assistant.id", assistantId);
    cfx.formats.set("locale.name", locale.origin.name);
    cfx.formats.set(
      "request.timestamp",
      String(Math.round(this.requestedAt.getTime() / 1000))
    );
    cfx.formats.set(
      "thread.timestamp",
      String(Math.round(this.threadCreatedAt.getTime() / 1000))
    );
    this.webhook.editMessage("@original", {
      ...cfx.resolve(
        locale.origin.plugins.requestHumanAssistant.acceptedRequest.interaction
          .update
      ),
      ephemeral: true,
    });
    this.webhook.send({
      ...cfx.resolve(
        locale.origin.plugins.requestHumanAssistant.acceptedRequest.interaction
          .followUp
      ),
      ephemeral: true,
    });

    thread
      .send(
        cfx.resolve(
          locale.origin.plugins.requestHumanAssistant.acceptedRequest.thread
        )
      )
      .catch((rejected) =>
        Logger.error(
          `Failed to Send Message into thread. Error Message: ${rejected.message}`
        )
      );
    if (this.assistantRequestsChannelId && this.assistantRequestMessageId)
      (
        this.guild.channels.cache.get(this.assistantRequestsChannelId) as
          | TextChannel
          | undefined
      )?.messages
        .edit(
          this.assistantRequestMessageId,
          cfx.resolve(
            locale.origin.plugins.requestHumanAssistant.assistantAcceptsRequest
              .update
          )
        )
        .catch((rejected) =>
          Logger.error(
            `Failed to update Assistant Request Message. Error Message: ${rejected.message}`
          )
        );

    return thread;
  }

  public async cancelRequest(): Promise<void> {
    if (this.status !== RequestAssistantStatus.SEARCHING)
      throw new Exception(
        "Only while searching can the request be canceled",
        Severity.COMMON
      );
    this.closedAt = new Date();
    await db.query(
      "update `Request.Human.Assistant` set cancelledAt = ? where BIN_TO_UUID(uuid) = ?",
      [this.closedAt, this.id]
    );
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
  CANCELED, // Summoner cancel when searching for assistant
  EXPIRED, // Take to long to find assistant
  CLOSED,
}
