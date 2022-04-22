import User, { UserFlagsPolicy } from "../structures/User";
import { Collection, User as DiscordUser } from "discord.js";
import CacheManager from "./CacheManager";
import db from "../providers/Mysql";
import app from "../app";
import Exception, { Severity } from "../utils/Exception";
export default class UserManager extends CacheManager<User> {
  constructor() {
    super();
  }

  private async _fetch(userId: string): Promise<DiscordUser> {
    try {
      const user = app.client.users.fetch(userId);
      return user;
    } catch (err) {
      throw new Exception((err as Error).message, Severity.FAULT, err as Error);
    }
  }

  public async fetch(
    _user: DiscordUser | string,
    force: boolean = false
  ): Promise<User> {
    const user: DiscordUser =
      _user instanceof DiscordUser ? _user : await this._fetch(_user);
    if (!force) {
      const cached = this.cache.get(user.id);
      if (cached instanceof User) return cached;
    }

    const raw = await db.query(
      "SELECT userId, SUM(flags) as flags, locale, createdAt FROM `Users` WHERE userId = ?",
      [user.id]
    );
    if (!raw[0].userId) {
      console.log("User not found");
      await this.create(user);
      return this.fetch(_user, true);
    }
    return this._add(new User(raw[0]));
  }

  async create(_user: DiscordUser | string, locale?: string): Promise<void> {
    const _locale = locale ?? null;
    const user: DiscordUser =
      _user instanceof DiscordUser ? _user : await this._fetch(_user);
    await db.query(
      "INSERT INTO `Users` SET userId = ?, locale = ? ON DUPLICATE KEY UPDATE `locale` = CASE ? WHEN null THEN `locale` ELSE ? END;",
      [user.id, _locale, _locale, _locale]
    );
  }
}

//Only fields will be usable in this project.
export interface UserData {
  userId: string;
  locale: string | null;
  flags: UserFlagsPolicy;
  createdAt: Date;
}
