import {
  InteractionWebhook,
  ThreadChannel,
  User as DiscordUser,
} from "discord.js";
import CacheManager from "./CacheManager";
import db from "../providers/Mysql";
import AssistanceThread from "../structures/AssistanceThread";
import app from "../app";
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
      "SELECT * FROM `Assistance.Threads` WHERE threadId = ?",
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
      raw.threadLocale,
      raw.createdAt
    );
    AT.assistantId ??= raw.assistantId;
    AT.status ??= raw.status;
    return this._add(AT);
  }
}
