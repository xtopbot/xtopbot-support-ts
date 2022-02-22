import User from "../structures/User";
import { Collection, User as DiscordUser } from "discord.js";
import CacheManager from "./CacheManager";
import db from "../providers/Mysql";
import app from "../app";
import Exception, { Severity } from "../utils/Exception";
export default class UserManager extends CacheManager {
  constructor() {
    super();
  }

  public get cache(): Collection<string, User> {
    return this._cache;
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

    const raw: Array<UserData> = await db.query(
      "SELECT * FROM `Users` WHERE userId = ?",
      [user.id]
    );
    if (!raw.length) this.create(user);
    const u: User = new User(raw[0]);
    return this._add(u);
  }

  async create(_user: DiscordUser | string, locale?: string): Promise<void> {
    const _locale = locale ?? null;
    const user: DiscordUser =
      _user instanceof DiscordUser ? _user : await this._fetch(_user);
    await db.query(
      "INSERT INTO `Users` SET userId = ?, locale = ? ON DUPLICATE KEY UPDATE `locale` = CASE ? WHEN null THEN `locale` ELSE ? END CASE;",
      [user.id, _locale, _locale, _locale]
    );
  }
}

//Only fields will be usable in this project.
export interface UserData {
  userId: string;
  locale: string | null;
  flag: UserDataFlags;
  createdAt: Date;
}

export enum UserDataFlags {
  TESTER = 1 << 0,
  SUPPORT = 1 << 1,
  MODERATOR = 1 << 2,
  ADMIN = 1 << 3,
  DEVELOPER = 1 << 4,
}
