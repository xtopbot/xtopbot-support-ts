import {
  InteractionReplyOptions,
  InteractionWebhook,
  ThreadChannel,
} from "discord.js";
import { LocaleTag } from "../managers/LocaleManager";
import RatelimitManager from "../managers/RatelimitManager";
import RequestHumanAssistant from "../plugins/RequestHumanAssistant";
import Constants from "../utils/Constants";
import Exception, { Severity } from "../utils/Exception";
import User from "./User";
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
    followUp?: InteractionReplyOptions
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
    if (followUp && member && !this.isInteractionExpired())
      this.webhook.send({ ...followUp, ephemeral: true });
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
