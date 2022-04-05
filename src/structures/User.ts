import { UserData } from "../managers/UserManager";
import db from "../providers/Mysql";
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
    return this.data.userId;
  }

  public get locale(): string | null {
    return this.data?.locale ?? null;
  }

  public get flags(): UserFlagsPolicy {
    return this.data?.flags ?? 0;
  }

  public get createdAt(): Date {
    return new Date(this.data?.createdAt ?? "1970-1-1");
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
    await db.query("update set flags = ? where userId = ?", [
      flags,
      this.data.userId,
    ]);
  }

  async addFlag(flag: UserFlagsPolicy): Promise<void> {
    await db.query("update set flags = flags | ? where userId = ?", [
      flag,
      this.data.userId,
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
