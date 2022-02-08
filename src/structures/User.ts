import { UserData, XtopTeam } from "../managers/UserManager";
import db from "../providers/Mysql";
import Constants from "../utils/Constants";
import Exception, { Severity } from "../utils/Exception";
export default class User {
  private data: UserData;
  public lastVotedAt: Date = new Date("1970-1-1");
  public features: Array<UserFeatures> = [];
  constructor(data: UserData) {
    this.data = data;
  }

  public _patch(data: UserData): void {
    this.data = data;
  }

  public get id(): string {
    if (!Constants.REGEX_SNOWFLAKE.test(this.data.id_discord))
      throw new Exception(
        `[${this.constructor.name}] Something was wrong with user id ${this.data.id_discord}`,
        Severity.FAULT
      );
    return this.data.id_discord;
  }

  public get createdAt(): Date {
    return new Date(this.data?.createdAt ?? "1970-1-1");
  }

  public get flag(): UserFlagPolicy {
    return this.data.xtopteam === XtopTeam.DEVELOPER
      ? UserFlagPolicy.DEVELOPER
      : UserFlagPolicy.USER;
  }

  public get lastVotedTimestampAt(): number {
    return Math.round(this.lastVotedAt.getTime() / 1000);
  }

  async isVoted(): Promise<boolean> {
    if (Math.round(Date.now() / 1000) - 43200 < this.lastVotedTimestampAt)
      return true;
    const raw = await db.query(
      "select * from usersVote where userId = ? AND unix_timestamp(createdAt) between unix_timestamp() - 43200 and unix_timestamp()",
      [this.id]
    );
    if (!!raw.length) this.lastVotedAt = raw[0].createdAt;
    return !!raw.length;
  }
}

export enum UserFeatures {
  VOTE,
  USER_PREMIUM,
  GUILD_PREMIUM,
}

export enum UserFlagPolicy {
  BLOCKED,
  USER,
  PREMIUM,
  SUPPORT,
  STAFF,
  ADMIN,
  DEVELOPER,
}
