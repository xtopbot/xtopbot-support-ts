import { User as DiscorUser } from "discord.js";
import db from "../providers/Mysql";
import Exception, { Severity } from "../utils/Exception";
export default class User {
  public id: string;
  public createdAt: Date;
  public lastVotedAt: Date = new Date("1970-1-1");
  public features: Array<UserFeatures> = [];
  //public fetched: boolean = false;
  constructor(raw: any) {
    this.id = raw.id_discord;
    this.createdAt = new Date();
    this._patch(raw);
  }

  private _patch(raw: any) {
    if ("createdAt" in raw) {
      this.createdAt = new Date(raw?.createdAt);
    }
  }

  public get lastVotedTimestampAt(): number {
    return Math.round(this.lastVotedAt.getTime() / 1000);
  }

  async isVoted(): Promise<boolean> {
    if (Math.round(Date.now() / 1000) - 43200000 < this.lastVotedTimestampAt)
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

export enum UserLevelPolicy {
  BLOCKED,
  USER,
  PREMIUM,
  SUPPORT,
  STAFF,
  ADMIN,
  DEVELOPER,
}
