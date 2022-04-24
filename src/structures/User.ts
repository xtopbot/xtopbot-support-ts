import { UserData } from "../managers/UserManager";
import db from "../providers/Mysql";
export default class User {
  public id: string = "";
  public locale: string | null = null;
  public flags: UserFlagsPolicy = UserFlagsPolicy.NONE;
  public createdAt: Date = new Date("1970-1-1");
  public lastVotedAt: Date = new Date("1970-1-1");
  public features: Array<UserFeatures> = [];
  constructor(data: UserData) {
    this.id = data.userId;
    this._patch(data);
  }

  public _patch(data: UserData): void {
    if ("locale" in data) this.locale = data.locale;
    if ("flags" in data) this.flags = Number(data.flags);
    if ("createdAt" in data) this.createdAt = data.createdAt;
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

  async setFlags(flags: number): Promise<void> {
    await db.query("update set flags = ? where userId = ?", [flags, this.id]);
  }

  async addFlag(flag: UserFlagsPolicy): Promise<void> {
    await db.query("update set flags = flags | ? where userId = ?", [
      flag,
      this.id,
    ]);
  }
}

export enum UserFeatures {
  VOTE,
  USER_PREMIUM,
  GUILD_PREMIUM,
}
export enum UserFlagsPolicy {
  NONE = 0,
  TESTER = 1 << 0,
  SUPPORT = 1 << 1,
  MODERATOR = 1 << 2,
  ADMIN = 1 << 3,
  DEVELOPER = 1 << 4,
}
