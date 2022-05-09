import {
  AutocompleteInteraction,
  Guild,
  InteractionReplyOptions,
  ThreadChannel,
} from "discord.js";
import { AnyInteraction } from "../commands/CommandMethod";
import { LocaleTag } from "../managers/LocaleManager";
import RatelimitManager from "../managers/RatelimitManager";
import RequestHumanAssistant from "../plugins/RequestHumanAssistant";
import Constants from "../utils/Constants";
import Exception, { Severity } from "../utils/Exception";
import User from "./User";
type Diff<T, U> = T extends U ? never : T;
export default class AssistanceThread {
  public readonly userId: string;
  public readonly interaction: Diff<AnyInteraction, AutocompleteInteraction>;
  public readonly thread: ThreadChannel;
  public readonly locale: LocaleTag;
  public readonly createdAt: Date = new Date();
  public status: AThreadStatus = AThreadStatus.ACTIVE;
  public assistantId: string | null = null;
  public spamerUsers = new RatelimitManager<User>(120000, 5);
  constructor(
    userId: string,
    interaction: Diff<AnyInteraction, AutocompleteInteraction>,
    thread: ThreadChannel,
    locale: LocaleTag
  ) {
    this.userId = userId;
    this.interaction = interaction;
    this.thread = thread;
    this.locale = locale;
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
      this.interaction.followUp({ ...followUp, ephemeral: true });
    return this;
  }

  public isInteractionExpired(): boolean {
    return (
      this.interaction.createdTimestamp <=
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
