import {
  ChannelType,
  InteractionReplyOptions,
  InteractionWebhook,
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

export default class AssistanceThread {
  public readonly id: string;
  public readonly userId: string;
  public readonly webhook: InteractionWebhook;
  public readonly thread: ThreadChannel | null;
  public readonly locale: LocaleTag;
  public readonly createdAt: Date = new Date();
  public status: AThreadStatus = AThreadStatus.ACTIVE;
  public assistantId: string | null = null;
  public spamerUsers = new RatelimitManager<User>(120000, 5);
  constructor(
    threadId: string,
    userId: string,
    webhook: InteractionWebhook,
    thread: ThreadChannel | null,
    locale: LocaleTag,
    createdAt?: Date
  ) {
    this.id = threadId;
    this.userId = userId;
    this.webhook = webhook;
    this.thread = thread;
    this.locale = locale;
    this.createdAt = createdAt ?? new Date();
  }

  private setStatus(status: AThreadStatus): this {
    if (this.status !== AThreadStatus.ACTIVE)
      throw new Exception("Thread status is unchangeable", Severity.SUSPICIOUS);
    this.status = status;
    return this;
  }

  public setAssistant(id: string): this {
    this.assistantId = id;
    return this;
  }

  public async close(
    status: AThreadStatus,
    followUp?: InteractionReplyOptions,
    cfx?: ContextFormats
  ): Promise<this> {
    if (!this.thread) throw new Exception("Thread not exist!", Severity.FAULT);

    this.setStatus(status);

    await this.thread.fetch();
    if (!this.thread.archived) {
      if (!this.thread.locked) await this.thread.setLocked(true);
      this.thread.setArchived(true);
    }

    const member = await this.thread.guild.members
      .fetch(this.userId)
      .catch(() => null);
    const guildAssistants = RequestHumanAssistant.getGuildAssistants(
      this.thread.guild
    );
    if (
      guildAssistants.role &&
      member?.roles.cache.get(guildAssistants.role.id)
    )
      await member.roles.remove(guildAssistants.role);
    if (followUp) {
      cfx ??= new ContextFormats();
      if (this.assistantId) {
        const assistant = await app.client.users.fetch(this.assistantId);
        cfx.setObject("assistant", assistant);
        cfx.formats.set("assistant.tag", assistant.tag);
      }

      if (member && !this.isInteractionExpired())
        this.webhook.send({ ...cfx.resolve(followUp), ephemeral: true });
    }
    /*
     Send Request Assistant Log
    */
    (
      this.thread.guild.channels.cache.find(
        (channel) =>
          channel.name.toLowerCase() ===
            Constants.DEFAULT_NAME_ASSISATANT_REQUEST_LOG_CHANNEL.toLowerCase() &&
          channel.type === ChannelType.GuildText
      ) as TextChannel | undefined
    )?.send({
      content: `<#${this.id}> Thread Belongs to (<@${this.userId}>[${
        member?.user.tag ?? ""
      }]) ${
        this.assistantId
          ? `**\`Solved\`** By <@${this.assistantId}>.`
          : `**\`Closed\`**.`
      } **(It took ${moment(this.createdAt).fromNow(true)})**`,
    });

    //Update row in database
    await db.query(
      "update `Assistance.Threads` set status = ?, assistantId = ? where threadId = ?",
      [status, this.assistantId ?? null, this.id]
    );

    return this;
  }

  public isInteractionExpired(): boolean {
    return (
      this.createdAt.getTime() <=
      Date.now() - Constants.DEFAULT_INTERACTION_EXPIRES
    );
  }
}

export enum AThreadStatus {
  ACTIVE,
  SOLVED, //Summoner issue was solved by assistant
  INACTIVE, // Summoner was inactive with assistant
  CLOSED, // Summoner left the thread.
}
