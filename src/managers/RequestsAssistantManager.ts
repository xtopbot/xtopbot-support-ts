import { InteractionWebhook, ThreadChannel } from "discord.js";
import CacheManager from "./CacheManager";
import db from "../providers/Mysql";
import AssistanceThread from "../structures/RequestAssistant";
import app from "../app";
import User from "../structures/User";
import { LocaleTag } from "./LocaleManager";
import Util from "../utils/Util";
export default class RequestsAssistantManager extends CacheManager<AssistanceThread> {
  constructor() {
    super();
  }

  public async createRequest(
    issue: string,
    userId: string,
    guidId: string,
    interactionWebhook: InteractionWebhook,
    locale: LocaleTag
  ): Promise<AssistanceThread> {
    const request = new AssistanceThread(
      Util.textEllipsis(issue, 100),
      userId,
      guidId,
      interactionWebhook,
      locale
    );
    await db.query(
      "INSERT INTO `Request.Human.Assistant` (uuid, userId, guildId, interactionToken, locale, issue) values (UUID_TO_BIN(?), ?, ?, ?, ?, ?)",
      [
        request.id,
        userId,
        guidId,
        interactionWebhook.token,
        locale,
        request.issue,
      ]
    );
    return this._add(request);
  }

  public async fetch(
    ut: string, // Thread Id or uuid
    force: boolean = false
  ): Promise<AssistanceThread | null> {
    if (!force) {
      const cached =
        this.cache.get(ut) || this.cache.find((r) => r.threadId == ut);
      if (cached instanceof AssistanceThread) return cached;
    }
    const [raw] = await db.query(
      `
     select BIN_TO_UUID(rha.uuid) as uuid, rha.userId, rha.guildId, rha.interactionToken, rha.locale, rha.issue, rha.createdAt as requestedAt, rha.cancelledAt, t.threadId, t.assistantId, t.createdAt as threadCreatedAt, ts.survery, ts.relatedArticleId, ts.requesterInactive, ts.closedAt from
      \`Request.Human.Assistant\` rha
      left join \`Request.Human.Assistant.Thread\` t
        on t.uuid = rha.uuid
      left join \`Request.Human.Assistant.Thread.Status\` ts
        on t.uuid = ts.uuid
      where rha.uuid = ? or t.threadId = ?;
     `,
      [ut, ut]
    );
    if (!raw?.uuid) return null;
    return this._add(this.resolve(raw));
  }

  public async fetchUser(
    user: User,
    limit: number = 5
  ): Promise<AssistanceThread[]> {
    const raw: any[] = await db.query(
      `
     select BIN_TO_UUID(rha.uuid) as uuid, rha.userId, rha.guildId, rha.interactionToken, rha.locale, rha.issue, rha.createdAt as requestedAt, rha.cancelledAt, t.threadId, t.assistantId, t.createdAt as threadCreatedAt, ts.survery, ts.relatedArticleId, ts.requesterInactive, ts.closedAt from
      \`Request.Human.Assistant\` rha
      left join \`Request.Human.Assistant.Thread\` t
        on t.uuid = rha.uuid
      left join \`Request.Human.Assistant.Thread.Status\` ts
        on t.uuid = ts.uuid
      where rha.userId = ? limit ?;
     `,
      [user.id, limit]
    );
    if (!raw.length) return [];
    const resolvedRequests = raw.map((r) => this.resolve(r));
    resolvedRequests.forEach((r) => this._add(r));
    return resolvedRequests;
  }

  private resolve(raw: any): AssistanceThread {
    const assistanceThread = new AssistanceThread(
      raw.issue,
      raw.userId,
      raw.guildId,
      new InteractionWebhook(
        app.client,
        app.client.application?.id as string,
        raw.interactionToken
      ),
      raw.locale,
      raw.uuid,
      raw.requestedAt
    );
    assistanceThread.assistantId = raw.assistantId ?? null;
    assistanceThread.threadId = raw.threadId ?? null;
    assistanceThread.threadCreatedAt = raw.threadCreatedAt ?? null;
    assistanceThread.closedAt = raw.closedAt ?? null;
    assistanceThread.requesterInactive = !!raw.requesterInactive;
    return assistanceThread;
  }
}
