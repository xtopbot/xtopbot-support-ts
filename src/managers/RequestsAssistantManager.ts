import {
  ButtonStyle,
  ChannelType,
  ComponentType,
  escapeMarkdown,
  Guild,
  InteractionWebhook,
  Message,
  TextChannel,
  User as DiscordUser,
} from "discord.js";
import CacheManager from "./CacheManager";
import db from "../providers/Mysql";
import RequestAssistant, {
  RequestAssistantStatus,
} from "../structures/RequestAssistant";
import app from "../app";
import User from "../structures/User";
import Util from "../utils/Util";
import Locale from "../structures/Locale";
import Exception, { Severity } from "../utils/Exception";
import ContextFormats from "../utils/ContextFormats";
import Constants from "../utils/Constants";
import RequestHumanAssistantPlugin from "../plugins/RequestHumanAssistant";
import Logger from "../utils/Logger";
import AuditLog from "../plugins/AuditLog";
import Subscription, { PatreonTierId } from "../structures/Subscription";
import CustomBotsManager from "./CustomBotsManager";
import { CustomBotStatus } from "../structures/CustomBot";
import ArticleLocalization from "../structures/ArticleLocalization";

export default class RequestsAssistantManager extends CacheManager<RequestAssistant> {
  public static readonly timeoutRequests = new Map<string, NodeJS.Timeout>();
  constructor() {
    super();
  }

  public async createRequest(
    issue: string,
    user: DiscordUser,
    guild: Guild,
    interactionWebhook: InteractionWebhook,
    locale: Locale,
    articleSuggested: ArticleLocalization | null
  ): Promise<RequestAssistant> {
    const req = new RequestAssistant(
      Util.textEllipsis(issue, 100),
      user.id,
      guild.id,
      interactionWebhook,
      locale.tag,
      articleSuggested?.id ?? null
    );
    const assistantMessage = await this.sendMessageIntoRequestsChannel(
      req,
      guild,
      user,
      locale,
      articleSuggested
    );
    req.setControlMessageForAssistant(
      assistantMessage.channel.id,
      assistantMessage.id
    );
    await db.query(
      "INSERT INTO `Request.Human.Assistant` (uuid, userId, guildId, interactionToken, locale, issue, assistantRequestsChannelId, assistantRequestMessageId, articleSuggestedId) values (UUID_TO_BIN(?), ?, ?, ?, ?, ?, ?, ?, UUID_TO_BIN(?))",
      [
        req.id,
        user.id,
        guild.id,
        interactionWebhook.token,
        locale.tag,
        req.issue,
        assistantMessage.channel.id,
        assistantMessage.id,
        articleSuggested?.id ?? null,
      ]
    );
    return this._add(req);
  }

  private async sendMessageIntoRequestsChannel(
    req: RequestAssistant,
    guild: Guild,
    user: DiscordUser,
    locale: Locale,
    articleSuggested: ArticleLocalization | null
  ): Promise<Message> {
    const guildAssistants =
      RequestHumanAssistantPlugin.getGuildAssistants(guild);
    const guildAssistantLocale = guildAssistants.assistants.get(locale.tag);
    const requestsChannel = guild.channels.cache.find(
      (channel) =>
        channel.type === ChannelType.GuildText && channel.name == "active-rha"
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
      "article.suggested.title",
      articleSuggested?.title ?? "N/A"
    );
    cfx.formats.set(
      "request.expires.in.minutes",
      String(Constants.DEFAULT_INTERACTION_EXPIRES / 1000 / 60)
    );
    cfx.formats.set(
      "request.expires.timestamp",
      String(
        Math.round(
          (req.requestedAt.getTime() + Constants.DEFAULT_INTERACTION_EXPIRES) /
            1000
        )
      )
    );
    cfx.formats.set(
      "request.timestamp",
      String(Math.round(req.requestedAt.getTime() / 1000))
    );
    cfx.formats.set("locale.name", locale.origin.name);

    return (requestsChannel as TextChannel).send(
      cfx.resolve({
        ...Util.addFieldToEmbed(
          locale.origin.plugins.requestHumanAssistant.requestCreated.admins,
          0,
          "color",
          15710560
        ),
        content: guildAssistantLocale
          ? `<@&${guildAssistantLocale.role.id}>`
          : null,
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

  public static async subscriptionDetailsEmbed(
    subscription: Subscription,
    locale: Locale,
    fetchCustomBot = true
  ) {
    const cf = new ContextFormats();
    cf.formats.set(
      "subscription.createdTimestamp",
      String(Math.round(subscription.getCreatedAt().getTime() / 1000))
    );
    cf.formats.set("tier.name", subscription.getTierName());
    cf.formats.set(
      "subscription.expiresTimestamp",
      String(Math.round(subscription.getExpires().getTime() / 1000))
    );
    cf.formats.set(
      "subscription.totalPaid",
      String(subscription.getTotalPaidAmount(false))
    );
    cf.formats.set(
      "subscription.transactions.paid.total",
      String(
        subscription.events.filter((event) => event.chargeStatus === "PAID")
          .length
      )
    );
    cf.formats.set(
      "subscription.transactions.last.amount",
      String((subscription.getLastEvent("PAID").amountCents / 100).toFixed(2))
    );
    cf.formats.set(
      "subscription.transactions.last.createdTimestamp",
      String(
        Math.round(
          subscription.getLastEvent("PAID").eventCreatedAt.getTime() / 1000
        )
      )
    );
    cf.formats.set(
      "subscription.uuid",
      subscription.getLastEvent("PAID")?.id ?? subscription.getLastEvent().id
    );
    cf.formats.set(
      "field[2].name",
      subscription.isActive()
        ? locale.origin.plugins.requestHumanAssistant
            .detailsOfRequesterSubscription.fieldNameExpires
        : locale.origin.plugins.requestHumanAssistant
            .detailsOfRequesterSubscription.fieldNameExpired
    );
    cf.formats.set(
      "author.name",
      subscription.isActive()
        ? locale.origin.plugins.requestHumanAssistant
            .detailsOfRequesterSubscription.authorActive
        : locale.origin.plugins.requestHumanAssistant
            .detailsOfRequesterSubscription.authorExpired
    );
    const embed = {
      ...cf.resolve({
        ...locale.origin.plugins.requestHumanAssistant
          .detailsOfRequesterSubscription.subscription.embed,
        color: subscription.isActive()
          ? Constants.defaultColors.GREEN
          : Constants.defaultColors.RED,
      }),
    };
    if (fetchCustomBot) {
      const customBots = await app.customBots.fetch(
        subscription.discordUserId,
        subscription.tierId
      );
      for (const bot of customBots.items) {
        const guilds = await bot.fetchGuilds(null).catch(() => []);
        embed.fields.push(
          Util.quickFormatContext(
            locale.origin.plugins.requestHumanAssistant
              .detailsOfRequesterSubscription.subscription.customBotField.setup,
            {
              "custom.bot.uuid.short": Util.getUUIDLowTime(bot.id),
              "bot.username": bot.username,
              "bot.discriminator": bot.discriminator,
              "bot.current.servers": guilds.length,
              "bot.status": Util.capitalize(
                Object.keys(CustomBotStatus)
                  [
                    Object.values(CustomBotStatus).indexOf(bot.getStatus())
                  ].replace(/_/g, " ")
                  .toLowerCase(),
                true
              ),
              "custom.bot.maximum.servers":
                CustomBotsManager.getCustomBotAccessServersSizeBySubscriptionTierId(
                  subscription.tierId
                ),
            }
          )
        );
      }

      for (let i = 0; i < customBots.remaining; i++)
        embed.fields.push(
          Util.quickFormatContext(
            locale.origin.plugins.requestHumanAssistant
              .detailsOfRequesterSubscription.subscription.customBotField
              .notSetupYet,
            {
              "custom.bot.maximum.servers":
                CustomBotsManager.getCustomBotQuantityBySubscriptionTierId(
                  subscription.tierId
                ),
            }
          )
        );
    }

    return embed;
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
     select BIN_TO_UUID(rha.uuid) as uuid, BIN_TO_UUID(rha.articleSuggestedId) as articleSuggestedId, rha.userId, rha.guildId, rha.interactionToken, rha.locale, rha.issue, unix_timestamp(rha.createdAt) as requestedAt, unix_timestamp(rha.cancelledAt) as cancelledAt, t.threadId, t.assistantId, unix_timestamp(t.createdAt) as threadCreatedAt, ts.relatedArticleId, (ts.status + 0) as status, unix_timestamp(ts.closedAt) as closedAt, rha.assistantRequestsChannelId, rha.assistantRequestMessageId from
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
    user: User | string,
    options?: {
      limit: number;
      where: string;
    }
  ): Promise<RequestAssistant[]> {
    const userId = user instanceof User ? user.id : user;
    const raw: any[] = await db.query(
      `
     select BIN_TO_UUID(rha.uuid) as uuid, BIN_TO_UUID(rha.articleSuggestedId) as articleSuggestedId, rha.userId, rha.guildId, rha.interactionToken, rha.locale, rha.issue, unix_timestamp(rha.createdAt) as requestedAt, unix_timestamp(rha.cancelledAt) as cancelledAt, t.threadId, t.assistantId, unix_timestamp(t.createdAt) as threadCreatedAt, ts.relatedArticleId, (ts.status + 0) as status, unix_timestamp(ts.closedAt) as closedAt, rha.assistantRequestsChannelId, rha.assistantRequestMessageId from
      \`Request.Human.Assistant\` rha
      left join \`Request.Human.Assistant.Thread\` t
        on t.uuid = rha.uuid
      left join \`Request.Human.Assistant.Thread.Status\` ts
        on t.uuid = ts.uuid
      where rha.userId = ? ${
        options?.where ? "and " + options.where : ""
      } limit ?;
     `,
      [userId, options?.limit ?? 5]
    );
    if (!raw.length) return [];
    const resolvedRequests = raw.map((r) => this.resolve(r));
    resolvedRequests.forEach((r) => this._add(r));
    return resolvedRequests;
  }

  public setTimeoutRequest(
    requestId: string,
    time: number = Constants.DEFAULT_INTERACTION_EXPIRES - 15000
  ) {
    RequestsAssistantManager.timeoutRequests.set(
      requestId,
      setTimeout(async () => {
        const request = await this.fetch(requestId, true);
        if (
          request?.getStatus(false) !== RequestAssistantStatus.SEARCHING &&
          request?.getStatus(false) !== RequestAssistantStatus.EXPIRED
        )
          return;
        const locale = app.locales.get(request.locale) || app.locales.get(null);
        const cfx = new ContextFormats();
        cfx.formats.set("request.uuid", request.id);
        cfx.formats.set("user.id", request.userId);
        request.webhook
          .editMessage("@original", {
            ...cfx.resolve(
              locale.origin.plugins.requestHumanAssistant.requestCanceled
                .expired.update
            ),
            components: [],
          })
          .catch((err) =>
            Logger.error(
              `Error Edit Interaction Message For Request Assistant Reason Of Edit: Request Expired. Message Error: ${err.message}`
            )
          );
        request.webhook
          .send({
            ...cfx.resolve(
              locale.origin.plugins.requestHumanAssistant.requestCanceled
                .expired.followUp
            ),
            ephemeral: true,
          })
          .catch((err) =>
            Logger.error(
              `Error FollowUp Interaction Message For Request Assistant Reason Of FollowUp: Request Expired. Message Error: ${err.message}`
            )
          );
        AuditLog.assistanceThreadClosed(request);
        request.deleteAssistantControlMessage();
        Logger.info(
          `[RHA: ${request.id} (${request.userId})] Request expired.`
        );
      }, time)
    );
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
      raw.articleSuggestedId,
      raw.uuid,
      raw.requestedAt
    );
    assistanceThread.assistantId = raw.assistantId ?? null;
    assistanceThread.threadId = raw.threadId ?? null;
    assistanceThread.threadCreatedAt = raw.threadCreatedAt
      ? new Date(Math.round(raw.threadCreatedAt * 1000))
      : null;
    assistanceThread.closedAt =
      typeof raw.closedAt === "number"
        ? new Date(Math.round(raw.closedAt * 1000))
        : typeof raw.cancelledAt === "number"
        ? new Date(Math.round(raw.cancelledAt * 1000))
        : null;
    assistanceThread.threadStatusClosed =
      typeof raw.status == "number" && raw.status > 0
        ? (raw.status as
            | RequestAssistantStatus.SOLVED
            | RequestAssistantStatus.REQUESTER_INACTIVE
            | RequestAssistantStatus.CLOSED)
        : null;
    assistanceThread.setControlMessageForAssistant(
      raw?.assistantRequestsChannelId ?? null,
      raw?.assistantRequestMessageId ?? null
    );
    return assistanceThread;
  }
}
