import { AutocompleteInteraction, ThreadChannel } from "discord.js";
import { AnyInteraction } from "../commands/CommandMethod";
import { LocaleTag } from "../managers/LocaleManager";
import RatelimitManager from "../managers/RatelimitManager";
import Exception, { Severity } from "../utils/Exception";
import User from "./User";
type Diff<T, U> = T extends U ? never : T;
export default class AssistanceThread {
  public readonly userId: string;
  public readonly interaction: Diff<AnyInteraction, AutocompleteInteraction>;
  public readonly thread: ThreadChannel;
  public readonly locale: LocaleTag;
  public readonly createdAt: Date = new Date();
  public status: SummonerStatus = SummonerStatus.ACTIVE;
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

  private setStatus(status: SummonerStatus): this {
    if (this.status !== SummonerStatus.ACTIVE)
      throw new Exception(
        "Summoner status is unchangeable",
        Severity.SUSPICIOUS
      );
    this.status = status;
    return this;
  }

  public setAssistant(id: string): this {
    this.assistantId = id;
    return this;
  }

  public solved() {
    this.setStatus(SummonerStatus.SOLVED);
  }

  public inactive() {
    this.setStatus(SummonerStatus.INACTIVE);
  }

  public closed() {
    this.setStatus(SummonerStatus.CLOSED);
  }
}

export enum SummonerStatus {
  ACTIVE,
  SOLVED, //Summoner issue was solved by assistant
  INACTIVE, // Summoner was inactive with assistant
  CLOSED, // Summoner left the thread.
}
