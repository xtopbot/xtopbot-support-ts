import app from "../app";
import { LocaleTag } from "../managers/LocaleManager";
import { UserData } from "../managers/UserManager";
import db from "../providers/Mysql";
export default class User {
  public id: string;
  public locale: LocaleTag | null = null;
  public flags: UserFlagsPolicy = UserFlagsPolicy.NONE;
  public createdAt: Date = new Date("1970-1-1");
  public lastVotedAt: Date | null = null;
  public features: Array<UserFeatures> = [];
  constructor(data: UserData) {
    this.id = data.userId;
    this._patch(data);
  }

  public _patch(data: UserData): void {
    if ("locale" in data)
      this.locale =
        data.locale == "ar_SA"
          ? "ar_SA"
          : data.locale == "en_US"
          ? "en_US"
          : null;
    if ("flags" in data) this.flags = Number(data.flags);
    if ("createdAt" in data) this.createdAt = new Date(data.createdAt);
  }

  public get lastVotedTimestampAt(): number {
    return this.lastVotedAt ? Math.round(this.lastVotedAt.getTime() / 1000) : 0;
  }

  public async isVoted(): Promise<boolean> {
    if (Math.round(Date.now() / 1000) - 43200 < this.lastVotedTimestampAt)
      return true;
    const raw = await db.query(
      "select * from usersVote where userId = ? AND unix_timestamp(createdAt) between unix_timestamp() - 43200 and unix_timestamp()",
      [this.id]
    );
    if (!!raw.length) this.lastVotedAt = raw[0].createdAt;
    return !!raw.length;
  }

  public async setFlags(flags: number): Promise<void> {
    await db.query("update Users set flags = ? where userId = ?", [
      flags,
      this.id,
    ]);
    this.flags = flags;
  }

  public async addFlag(flag: UserFlagsPolicy): Promise<void> {
    await db.query("update Users set flags = flags | ? where userId = ?", [
      flag,
      this.id,
    ]);
    await this.update();
  }

  public async setLocale(locale: LocaleTag): Promise<void> {
    await db.query("update Users set locale = ? where userId = ?", [
      locale,
      this.id,
    ]);
    this.locale = locale;
  }

  public async update(): Promise<void> {
    await app.users.fetch(this.id);
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
