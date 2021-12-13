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

  /*public async get(user: DiscordUser, force: boolean = true): Promise<User> {
    this.cache.get(user.id);
    return;
  }*/

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
    console.log(this.cache);

    const raw = await db.query("select * from profile where id_discord = ?", [
      user.id,
    ]);
    if (!raw.length) this.create(user);
    const u: User = new User(raw[0]);
    return this._add(u);
  }

  async create(_user: DiscordUser | string): Promise<void> {
    const user: DiscordUser =
      _user instanceof DiscordUser ? _user : await this._fetch(_user);
    await db.query(
      "INSERT INTO profile (id_discord, date_created) VALUES (?, ?);",
      [user.id, Math.round(Date.now() / 1000)]
    );
  }
}

//Only field will be usable in this project.
interface ProfileDB {
  id: number;
  id_discord: string;
  createdAt: Date;
}
