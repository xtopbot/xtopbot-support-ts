import User, { UserFlagsPolicy } from "../structures/User";
import { User as DiscordUser } from "discord.js";
import CacheManager from "./CacheManager";
import db from "../providers/Mysql";
import app from "../app";
import Exception, { Severity } from "../utils/Exception";
import Logger from "../utils/Logger";
export default class UserManager extends CacheManager<User> {
  constructor() {
    super();
  }

  public async fetch(
    user: DiscordUser | string,
    force: boolean = true
  ): Promise<User> {
    user = await this.resolveDiscordUser(user);
    if (!force) {
      const cached = this.cache.get(user.id);
      if (cached instanceof User) return cached;
    }
    const raw = await db.query(
      "SELECT userId, SUM(flags) as flags, locale, createdAt FROM `Users` WHERE userId = ?",
      [user.id]
    );
    if (!raw[0].userId) {
      await this.create(user);
      return this.fetch(user, true);
    }
    return this._add(new User(raw[0]));
  }

  public async create(
    user: DiscordUser | string,
    locale?: string | null
  ): Promise<void> {
    user = await this.resolveDiscordUser(user);
    Logger.info(`Create ${user.tag}<${user.id}> in datebase.`);
    locale = locale ?? null;
    await db.query(
      "INSERT INTO `Users` SET userId = ?, locale = ? ON DUPLICATE KEY UPDATE `locale` = CASE ? WHEN null THEN `locale` ELSE ? END;",
      [user.id, locale, locale, locale]
    );
  }

  private async resolveDiscordUser(
    _user: DiscordUser | string
  ): Promise<DiscordUser> {
    return _user instanceof DiscordUser
      ? _user
      : await app.client.users.fetch(_user).catch((err) => {
          throw new Exception(
            (err as Error).message,
            Severity.FAULT,
            err as Error
          );
        });
  }
}

//Only fields will be usable in this project.
export interface UserData {
  userId: string;
  locale: string | null;
  flags: UserFlagsPolicy;
  createdAt: Date;
}
