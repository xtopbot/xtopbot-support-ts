import { InteractionWebhook, ThreadChannel } from "discord.js";
import CacheManager from "./CacheManager";
import db from "../providers/Mysql";
import AssistanceThread from "../structures/AssistanceThread";
import app from "../app";
import User from "../structures/User";
export default class UserManager extends CacheManager<AssistanceThread> {
  constructor() {
    super();
  }
  public async fetch(
    threadId: string,
    force: boolean = false,
    fetchThread: boolean = true
  ): Promise<AssistanceThread | null> {
    if (!force) {
      const cached = this.cache.get(threadId);
      if (cached instanceof AssistanceThread) {
        if (fetchThread) await cached.thread?.fetch();
        return cached;
      }
    }
    const [raw] = await db.query(
      "SELECT threadId, userId, guildId, interactionToken, assistantId, (`status` + 0) as status, locale, createdAt FROM `Assistance.Threads` WHERE threadId = ?",
      [threadId]
    );
    if (!raw?.threadId) return null;
    let thread = fetchThread
      ? ((await (
          await app.client.guilds.fetch(raw.guildId)
        ).channels.fetch(threadId)) as ThreadChannel | null)
      : null;
    const AT = new AssistanceThread(
      threadId,
      raw.userId,
      new InteractionWebhook(
        app.client,
        app.client.application?.id as string,
        raw.interactionToken
      ),
      thread,
      raw.locale,
      new Date(raw.createdAt)
    );
    AT.assistantId ??= raw.assistantId;
    AT.status = raw.status;
    return this._add(AT);
  }

  /**/
  public async fetchUser(
    user: User,
    fetchThreads: boolean = false,
    limit: number = 5
  ): Promise<AssistanceThread[]> {
    const raw: any[] = await db.query(
      "SELECT threadId, userId, guildId, interactionToken, assistantId, (`status` + 0) as status, locale, createdAt, updatedAt FROM `Assistance.Threads` WHERE userId = ? order by createdAt desc LIMIT ?",
      [user.id, limit]
    );
    if (!raw.length) return [];
    const AThreads: AssistanceThread[] = [];
    for (let i = 0; i < raw.length; i++) {
      const thread = fetchThreads
        ? ((await (await app.client.guilds.fetch(raw.at(i).guildId)).channels
            .fetch(raw.at(i).threadId)
            .catch(() => null)) as ThreadChannel | null) ?? null
        : null;
      const AT = new AssistanceThread(
        raw.at(i).threadId,
        raw.at(i).userId,
        new InteractionWebhook(
          app.client,
          app.client.application?.id as string,
          raw.at(i).interactionToken
        ),
        thread,
        raw.at(i).locale,
        new Date(raw.at(i).createdAt)
      );
      AT.assistantId ??= raw.at(i).assistantId;
      AT.status = raw.at(i).status;
      AT.closedAt = raw.at(i).updatedAt;
      AThreads.push(AT);
    }
    return AThreads;
  }
}
