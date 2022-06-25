import {
  ButtonStyle,
  ChannelType,
  ComponentType,
  escapeMarkdown,
  Guild,
  InteractionWebhook,
  TextChannel,
  User as DiscordUser,
} from "discord.js";
import CacheManager from "./CacheManager";
import db from "../providers/Mysql";
import RequestAssistant from "../structures/RequestAssistant";
import app from "../app";
import User from "../structures/User";
import Util from "../utils/Util";
import Locale from "../structures/Locale";
import Exception, { Severity } from "../utils/Exception";
import ContextFormats from "../utils/ContextFormats";
import Constants from "../utils/Constants";
export default class RequestsAssistantManager extends CacheManager<RequestAssistant> {
  constructor() {
    super();
  }

  public async createRequest(
    issue: string,
    user: DiscordUser,
    guild: Guild,
    interactionWebhook: InteractionWebhook,
    locale: Locale
  ): Promise<RequestAssistant> {
    const req = new RequestAssistant(
      Util.textEllipsis(issue, 100),
      user.id,
      guild.id,
      interactionWebhook,
      locale.tag
    );
    await this.sendMessageIntoRequestsChannel(req, guild, user, locale);
    await db.query(
      "INSERT INTO `Request.Human.Assistant` (uuid, userId, guildId, interactionToken, locale, issue) values (UUID_TO_BIN(?), ?, ?, ?, ?, ?)",
      [
        req.id,
        user.id,
        guild.id,
        interactionWebhook.token,
        locale.tag,
        req.issue,
      ]
    );
    return this._add(req);
  }

  private async sendMessageIntoRequestsChannel(
    req: RequestAssistant,
    guild: Guild,
    user: DiscordUser,
    locale: Locale
  ): Promise<void> {
    const requestsChannel = guild.channels.cache.find(
      (channel) =>
        channel.type === ChannelType.GuildText && channel.name == "rha"
    );
    if (!requestsChannel)
      throw new Exception(
        "Something was wrong while Sending your request to staff channel",
        Severity.SUSPICIOUS,
        "Unable to find Channel for Requests Assistant in cache."
      );

    const cfx = new ContextFormats();
    cfx.setObject("user", user);
    cfx.formats.set(
      "request.issue",
      escapeMarkdown(Util.textEllipsis(req.issue, 100))
    );
    cfx.formats.set("user.tag", user.tag);
    cfx.formats.set("request.uuid", req.id);
    cfx.formats.set(
      "request.expires.in.minutes",
      String(Constants.DEFAULT_INTERACTION_EXPIRES / 1000 / 60)
    );
    cfx.formats.set(
      "request.expires.timestamp",
      String(
        Math.round(
          req.requestedAt.getTime() +
            Constants.DEFAULT_INTERACTION_EXPIRES / 1000
        )
      )
    );
    cfx.formats.set(
      "request.timestamp",
      String(Math.round(req.requestedAt.getTime() / 1000))
    );
    cfx.formats.set("locale.name", locale.origin.name);
    await (requestsChannel as TextChannel).send(
      cfx.resolve({
        ...locale.origin.plugins.requestHumanAssistant.requestCreated.admins,
        components: [
          {
            type: ComponentType.ActionRow,
            components: [
              {
                type: ComponentType.Button,
                style: ButtonStyle.Primary,
                customId: `requestAssistant:accept:${req.id}`,
                label:
                  locale.origin.plugins.requestHumanAssistant.requestCreated
                    .admins.buttons[0],
              },
            ],
          },
        ],
      })
    );
  }

  public async fetch(
    ut: string, // Thread Id or uuid
    force: boolean = false
  ): Promise<RequestAssistant | null> {
    if (!force) {
      const cached =
        this.cache.get(ut) || this.cache.find((r) => r.threadId == ut);
      if (cached instanceof RequestAssistant) return cached;
    }
    const [raw] = await db.query(
      `
     select BIN_TO_UUID(rha.uuid) as uuid, rha.userId, rha.guildId, rha.interactionToken, rha.locale, rha.issue, unix_timestamp(rha.createdAt) as requestedAt, unix_timestamp(rha.cancelledAt) as cancelledAt, t.threadId, t.assistantId, unix_timestamp(t.createdAt) as threadCreatedAt, ts.survery, ts.relatedArticleId, ts.requesterInactive, unix_timestamp(ts.closedAt) as closedAt from
      \`Request.Human.Assistant\` rha
      left join \`Request.Human.Assistant.Thread\` t
        on t.uuid = rha.uuid
      left join \`Request.Human.Assistant.Thread.Status\` ts
        on t.uuid = ts.uuid
      where BIN_TO_UUID(rha.uuid) = ? or t.threadId = ?;
     `,
      [ut, ut]
    );
    if (!raw?.uuid) return null;
    return this._add(this.resolve(raw));
  }

  public async fetchUser(
    user: User,
    limit: number = 5
  ): Promise<RequestAssistant[]> {
    const raw: any[] = await db.query(
      `
     select BIN_TO_UUID(rha.uuid) as uuid, rha.userId, rha.guildId, rha.interactionToken, rha.locale, rha.issue, unix_timestamp(rha.createdAt) as requestedAt, unix_timestamp(rha.cancelledAt) as cancelledAt, t.threadId, t.assistantId, unix_timestamp(t.createdAt) as threadCreatedAt, ts.survery, ts.relatedArticleId, ts.requesterInactive, unix_timestamp(ts.closedAt) as closedAt from
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

  private resolve(raw: any): RequestAssistant {
    const assistanceThread = new RequestAssistant(
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
    assistanceThread.threadCreatedAt = raw.threadCreatedAt
      ? new Date(Math.round(raw.threadCreatedAt * 1000))
      : null;
    assistanceThread.closedAt = raw.closedAt
      ? new Date(Math.round(raw.closedAt * 1000))
      : raw.cancelledAt
      ? new Date(Math.round(raw.cancelledAt * 1000))
      : null;
    assistanceThread.requesterInactive = !!raw.requesterInactive;
    return assistanceThread;
  }
}