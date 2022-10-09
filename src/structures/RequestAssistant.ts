import {
  ButtonStyle,
  ChannelType,
  ComponentType,
  DiscordAPIError,
  Guild,
  InteractionWebhook,
  Message,
  Role,
  TextChannel,
  ThreadChannel,
  User as DiscordUser,
} from "discord.js";
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
import AuditLog from "../plugins/AuditLog";

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
  public spammerUsers = new RatelimitManager<User>(120000, 5);
  public threadStatusClosed:
    | RequestAssistantStatus.SOLVED
    | RequestAssistantStatus.REQUESTER_INACTIVE
    | RequestAssistantStatus.CLOSED
    | null = null;
  public issue: string;
  private assistantRequestsChannelId: string | null = null;
  private assistantRequestMessageId: string | null = null;
  public relatedArticleId: string | null = null;

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
  }

  public getStatus(fetchThread: false): RequestAssistantStatus;
  public async getStatus(fetchThread: true): Promise<RequestAssistantStatus>;
  public getStatus(
    checkStatusThread: boolean
  ): Promise<RequestAssistantStatus> | RequestAssistantStatus {
    if (this.closedAt) {
      if (!this.threadId) return RequestAssistantStatus.CANCELED;

      return this.threadStatusClosed || RequestAssistantStatus.CLOSED;
    }
    if (!this.threadId) {
      if (
        Date.now() - this.requestedAt.getTime() >
        Constants.DEFAULT_INTERACTION_EXPIRES - 15000
      )
        return RequestAssistantStatus.EXPIRED;
      return RequestAssistantStatus.SEARCHING;
    } else {
      if (Date.now() > (this.threadCreatedAt as Date).getTime() + 3_600_000)
        return RequestAssistantStatus.CLOSED;
      if (checkStatusThread) return this.checkStatusThread();
      const thread = this.guild.channels.cache.get(
        this.threadId
      ) as ThreadChannel | null;
      if (!thread || thread.archived) return RequestAssistantStatus.CLOSED;
      return RequestAssistantStatus.ACTIVE;
    }
  }

  public async checkStatusThread(): Promise<
    RequestAssistantStatus.ACTIVE | RequestAssistantStatus.CLOSED
  > {
    if (!this.threadId)
      throw new Exception("Thread not created yet!", Severity.SUSPICIOUS);
    const thread = await this.getThread(true).catch(() => null);
    if (!thread || thread.archived) {
      await this.closeThread(RequestAssistantStatus.CLOSED, {
        threadClosedAt: thread?.archivedAt ?? new Date(),
      });

      return RequestAssistantStatus.CLOSED;
    }
    return RequestAssistantStatus.ACTIVE;
  }

  private get guild(): Guild {
    const guild = app.client.guilds.cache.get(this.guildId);
    if (!guild)
      throw new Exception("Unable to get guild.", Severity.SUSPICIOUS);
    return guild;
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

    const thread = await this.guild.channels
      .fetch(this.threadId, {
        force: force,
      })
      .catch((err) => {
        Logger.debug("test");
        if (err instanceof DiscordAPIError && err.code === 10003) return null;
        throw new Exception(
          "Something was wrong with Discord API",
          Severity.SUSPICIOUS,
          err
        );
      });
    if (!thread) throw new Exception("thread not found.", Severity.COMMON);

    return thread as unknown as ThreadChannel;
  }

  public async createThread(assistant: DiscordUser): Promise<ThreadChannel> {
    if (this.threadId)
      throw new Exception("Thread already created!", Severity.SUSPICIOUS);
    if (this.getStatus(false) !== RequestAssistantStatus.SEARCHING)
      throw new Exception(
        "Status of request is unprepared to create a thread",
        Severity.SUSPICIOUS
      );
    this.assistantId = assistant.id;
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
    const thread = await (
      guildAssistants.channel as TextChannel
    ).threads.create({
      name: Util.textEllipsis(this.issue, 100),
      autoArchiveDuration: 60,
      reason: `Request Assistant Id: ${this.id}`,
      type:
        this.guild.premiumTier >= 2
          ? ChannelType.GuildPrivateThread
          : ChannelType.GuildPublicThread,
      invitable: false,
    });

    await db
      .query(
        "INSERT INTO `Request.Human.Assistant.Thread` (uuid, threadId, assistantId) values (UUID_TO_BIN(?), ?, ?)",
        [this.id, thread.id, assistant.id]
      )
      .catch((rejected) => {
        thread.delete();
        throw new Exception(
          "Something was wrong please try again!",
          Severity.FAULT,
          rejected
        );
      });
    this.threadId = thread.id;
    this.threadCreatedAt = new Date();
    await member.roles.add(guildAssistants.role as Role);

    await thread.members.add(member.user.id);
    await thread.members.add(assistant.id);

    const locale = app.locales.get(this.locale, true);
    const cfx = new ContextFormats();
    cfx.setObject("requester", member.user);
    cfx.formats.set("requester.tag", member.user.tag);
    cfx.formats.set("assistant.tag", assistant.tag);
    cfx.setObject("assistant", assistant);
    cfx.formats.set("request.uuid", this.id);
    cfx.formats.set("request.uuid.short", Util.getUUIDLowTime(this.id));
    cfx.formats.set("thread.id", thread.id);
    cfx.formats.set("locale.name", locale.origin.name);
    cfx.formats.set("request.issue", this.issue);
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
        Util.addFieldToEmbed(
          locale.origin.plugins.requestHumanAssistant.acceptedRequest
            .interaction.update,
          0,
          "color",
          Constants.defaultColors.GREEN
        )
      ),
      components: [],
      ephemeral: true,
    });
    this.webhook.send({
      ...cfx.resolve(
        Util.addFieldToEmbed(
          locale.origin.plugins.requestHumanAssistant.acceptedRequest
            .interaction.followUp,
          0,
          "color",
          Constants.defaultColors.GREEN
        )
      ),
      components: [
        {
          type: ComponentType.ActionRow,
          components: [
            {
              type: ComponentType.Button,
              style: ButtonStyle.Link,
              label:
                locale.origin.plugins.requestHumanAssistant.acceptedRequest
                  .interaction.followUp.buttons[0],
              url: thread.url,
            },
          ],
        },
      ],
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
          cfx.resolve({
            ...Util.addFieldToEmbed(
              locale.origin.plugins.requestHumanAssistant
                .assistantAcceptsRequest.update,
              0,
              "color",
              1797288
            ),
            components: [
              {
                type: ComponentType.ActionRow,
                components: [
                  {
                    type: ComponentType.SelectMenu,
                    maxValues: 1,
                    minValues: 1,
                    customId: `requestAssistant:close:${this.id}`,
                    placeholder:
                      locale.origin.plugins.requestHumanAssistant
                        .assistantAcceptsRequest.update.selectMenu[0]
                        .placeholder,
                    options: [
                      {
                        ...locale.origin.plugins.requestHumanAssistant
                          .assistantAcceptsRequest.update.selectMenu[0]
                          .options[0],
                        emoji: {
                          name: "✅",
                        },
                        value: "solved",
                      },
                      {
                        ...locale.origin.plugins.requestHumanAssistant
                          .assistantAcceptsRequest.update.selectMenu[0]
                          .options[1],
                        emoji: {
                          name: "⌛",
                        },
                        value: "inactive",
                      },
                    ],
                  },
                ],
              },
            ],
          })
        )
        .catch((rejected) =>
          Logger.error(
            `Failed to update Assistant Request Message (Admin). Error Message: ${rejected.message}`
          )
        );

    Logger.info(
      `[RHA: ${this.id} (${this.userId})] Thread Created, ID: ${thread.id}. Accepted By: ${assistant.tag} (${assistant.id})`
    );

    return thread;
  }

  public async cancelRequest(localeTag: LocaleTag | null): Promise<void> {
    const locale = app.locales.get(localeTag);
    if (this.getStatus(false) !== RequestAssistantStatus.SEARCHING)
      throw new Exception(
        locale.origin.plugins.requestHumanAssistant.failedCancelRequest,
        Severity.COMMON
      );
    this.closedAt = new Date();
    await db.query(
      "update `Request.Human.Assistant` set cancelledAt = ? where BIN_TO_UUID(uuid) = ?",
      [this.closedAt, this.id]
    );
    AuditLog.assistanceThreadClosed(this);
    this.deleteAssistantControlMessage();
    Logger.info(`[RHA: ${this.id} (${this.userId})] Canceled`);
  }

  public deleteAssistantControlMessage(): void {
    if (this.assistantRequestsChannelId && this.assistantRequestMessageId)
      (
        this.guild.channels.cache.get(this.assistantRequestsChannelId) as
          | TextChannel
          | undefined
      )?.messages
        .delete(this.assistantRequestMessageId)
        .catch((rejected) =>
          Logger.error(
            `Failed to delete Assistant Request Message (Admin). Error Message: ${rejected.message}`
          )
        );
  }

  public async closeThread(
    status:
      | RequestAssistantStatus.SOLVED
      | RequestAssistantStatus.REQUESTER_INACTIVE
      | RequestAssistantStatus.CLOSED,
    options?: {
      threadClosedAt?: Date;
      messageToThread?: any;
    }
  ): Promise<this> {
    if (
      this.getStatus(false) !== RequestAssistantStatus.CLOSED &&
      this.getStatus(false) !== RequestAssistantStatus.ACTIVE
    )
      throw new Exception(
        "This request cannot be closed due to status",
        Severity.SUSPICIOUS
      );

    await db.query(
      `INSERT INTO \`Request.Human.Assistant.Thread.Status\` (uuid, status, relatedArticleId, closedAt) values (UUID_TO_BIN(?), ?, ${
        Util.isUUID(this.relatedArticleId) ? "UUID_TO_BIN(?)" : "?"
      }, ?)`,
      [
        this.id,
        status,
        Util.isUUID(this.relatedArticleId) ? this.relatedArticleId : null,
        options?.threadClosedAt ?? new Date(),
      ]
    );

    this.closedAt = new Date();
    this.threadStatusClosed = status;

    AuditLog.assistanceThreadClosed(this);

    this.deleteAssistantControlMessage();

    Logger.info(
      `[RHA: ${this.id} (${this.userId})] Closed With Reason ${RequestAssistantStatus[status]}`
    );

    const thread = await this.getThread().catch((rejected) => {
      Logger.error(
        `[Assistance Request Id: ${this.id}] get Thread Error: ${rejected?.message}.`
      );
      return null;
    });
    if (!thread) return this;

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
    if (!thread.archived) {
      const tLocale = app.locales.get(this.locale, true);
      await thread.send(
        options?.messageToThread ??
          Util.quickFormatContext(
            tLocale.origin.plugins.requestHumanAssistant.threadClosed.thread,
            {
              "request.uuid.short": Util.getUUIDLowTime(this.id),
            }
          )
      );
      await thread.edit({ archived: true, locked: true });
    }

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
  REQUESTER_INACTIVE, // Summoner was inactive with assistant
  CLOSED, // Thread was closed for no reason.

  ACTIVE, // Thread is active
  SEARCHING, // Waiting for assistant accept summoner
  CANCELED, // Summoner cancel when searching for assistant
  EXPIRED, // Take to long to find assistant
}
