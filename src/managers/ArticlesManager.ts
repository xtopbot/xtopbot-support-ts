import db from "../providers/Mysql";
import { LocaleTag } from "./LocaleManager";
import CacheManager from "./CacheManager";
import Article from "../structures/Article";
import ArticleLocalization from "../structures/ArticleLocalization";
import { v4 as uuidv4 } from "uuid";
import Util from "../utils/Util";
import Fuse from "fuse.js";
import app from "../app";
import {
  ButtonStyle,
  Collection,
  ComponentType,
  TextChannel,
} from "discord.js";
import schedule, { Job } from "node-schedule";
import Locale from "../structures/Locale";
import Logger from "../utils/Logger";
import message from "../listeners/Message";

export default class ArticlesManager extends CacheManager<Article> {
  private schedules = new Collection<string, Job>();
  constructor() {
    super();
  }

  public async fetch(): Promise<Article[]>;
  public async fetch(
    options?: { userId: string },
    force?: boolean
  ): Promise<Article[]>;
  public async fetch(
    options?: { id?: string },
    force?: boolean
  ): Promise<Article | null>;
  public async fetch(
    options?: { id?: string; userId: string },
    force?: boolean
  ): Promise<Article[] | Article | null> {
    const fetchType: "UserArticles" | "SingleArticle" | "AllArticles" =
      typeof options?.id === "string"
        ? "SingleArticle"
        : typeof options?.userId === "string"
        ? "UserArticles"
        : "AllArticles";

    if (fetchType === "SingleArticle" && !force) {
      const cachedArticle = this.cache.get(options?.id as string);
      if (
        cachedArticle &&
        cachedArticle.fetchedType !== "SINGLE_ARTICLE_LOCALIZATIONS"
      )
        return cachedArticle;
    }

    const resolved = this.resolve(
      await db.query(
        `
    select BIN_TO_UUID(a.id) as id, a.note, a.creatorId, unix_timestamp(a.createdAt) as createdTimestampAt, BIN_TO_UUID(al.id) as localizationId, al.title, al.locale, BIN_TO_UUID(al.messageId) as messageId, unix_timestamp(al.createdAt) as localizationCreatedTimestampAt, unix_timestamp(al.updatedAt) as localizationUpdatedTimestampAt, al.published, al.editable, alt.tag as localizationTagName, alt.creatorId as localizationTagCreatorId, unix_timestamp(alt.createdAt) as localizationTagCreatedTimestampAt, BIN_TO_UUID(alt.id) as localizationTagId
    from \`Article\` a
    left join \`Article.Localization\` al on al.articleId = a.id
    left join \`Article.Localization.Tag\` alt on alt.articleLocalizationId = al.id
    ${
      fetchType === "SingleArticle"
        ? "where BIN_TO_UUID(a.id) = ?;"
        : fetchType === "UserArticles"
        ? "where a.creatorId = ?"
        : ""
    }
      `,
        [options?.id ?? options?.userId]
      )
    );

    const articles = resolved.map((r) => {
      let article = new Article(
        r.id,
        r.creatorId,
        r.note,
        r.createdAt,
        "ALL_ARTICLE_LOCALIZATIONS"
      );
      r.localizations.map((localization) =>
        article.localizations.set(
          localization.id,
          new ArticleLocalization(
            article,
            localization.id,
            localization.title,
            localization.locale as LocaleTag,
            localization.tags,
            localization.messageId,
            {
              published: localization.published,
              editable: localization.editable,
              createdAt: localization.createdAt,
            }
          )
        )
      );
      this._add(article);
      return article;
    });

    if (fetchType === "SingleArticle") {
      if (!articles.length) return null;
      return articles[0];
    }

    return articles;
  }
  public async fetchLocalization(
    id: string
  ): Promise<ArticleLocalization | null>;
  public async fetchLocalization(id: string[]): Promise<ArticleLocalization[]>;
  public async fetchLocalization(
    id: string | string[]
  ): Promise<ArticleLocalization | ArticleLocalization[] | null> {
    const type: "SINGLE_FETCH" | "BULK_FETCH" = Array.isArray(id)
      ? "BULK_FETCH"
      : "SINGLE_FETCH";

    const ids = type === "BULK_FETCH" ? id : [id];

    const resolved = this.resolve(
      await db.query(
        `
    select BIN_TO_UUID(a.id) as id, a.note, a.creatorId, unix_timestamp(a.createdAt) as createdTimestampAt, BIN_TO_UUID(al.id) as localizationId, al.title, al.locale, BIN_TO_UUID(al.messageId) as messageId, unix_timestamp(al.createdAt) as localizationCreatedTimestampAt, unix_timestamp(al.updatedAt) as localizationUpdatedTimestampAt, al.published, al.editable, alt.tag as localizationTagName, alt.creatorId as localizationTagCreatorId, unix_timestamp(alt.createdAt) as localizationTagCreatedTimestampAt, BIN_TO_UUID(alt.id) as localizationTagId
    from \`Article.Localization\` al
    right join \`Article\` a on al.articleId = a.id
    left join \`Article.Localization.Tag\` alt on alt.articleLocalizationId = al.id
    where BIN_TO_UUID(al.id) in (?);
    `,
        [ids]
      )
    );

    if (!resolved.length) return type === "BULK_FETCH" ? [] : null;

    const localizations: ArticleLocalization[] = [];

    for (let i = 0; i < resolved.length; i++) {
      for (let ii = 0; ii < resolved[i].localizations.length; ii++) {
        const localization = resolved[i].localizations[ii];

        const cachedArticle = this.cache.get(resolved[i].id);
        if (cachedArticle) {
          const articleLocalization = new ArticleLocalization(
            cachedArticle,
            localization.id,
            localization.title,
            localization.locale as LocaleTag,
            localization.tags,
            localization.messageId,
            {
              published: localization.published,
              editable: localization.editable,
              createdAt: localization.createdAt,
            }
          );
          cachedArticle.localizations.delete(articleLocalization.id);
          cachedArticle.localizations.set(
            articleLocalization.id,
            articleLocalization
          );

          localizations.push(articleLocalization);
        }

        const article = new Article(
          resolved[i].id,
          resolved[i].creatorId,
          resolved[i].note,
          resolved[i].createdAt,
          "SINGLE_ARTICLE_LOCALIZATIONS"
        );
        const articleLocalization = new ArticleLocalization(
          article,
          localization.id,
          localization.title,
          localization.locale as LocaleTag,
          localization.tags,
          localization.messageId,
          {
            published: localization.published,
            editable: localization.editable,
            createdAt: localization.createdAt,
          }
        );
        article.localizations.set(articleLocalization.id, articleLocalization);

        this._add(article);
        localizations.push(articleLocalization);
      }
    }

    return type === "BULK_FETCH" ? localizations : localizations[0];
  }

  public async create(creatorId: string, note: string): Promise<Article> {
    const id = uuidv4();
    await db.query(
      "insert into `Article` (id, creatorId, note) values (UUID_TO_BIN(?), ?, ?)",
      [id, creatorId, note]
    );
    return new Article(
      id,
      creatorId,
      note,
      new Date(),
      "ALL_ARTICLE_LOCALIZATIONS"
    );
  }

  public async search(
    input: string,
    force = false
  ): Promise<ArticleLocalization[]> {
    if (force) await this.fetch();
    const fuse = new Fuse(
      app.articles.cache
        .map((article) =>
          article.localizations.map((localization) => localization)
        )
        .flat()
        .filter((localization) => localization.published),
      {
        threshold: 0.6,
        ignoreLocation: true,
        keys: [
          {
            weight: 0.9,
            name: "title",
          },
          {
            name: "localizationTags",
            weight: 0.6,
            getFn: (localization: ArticleLocalization) =>
              localization.tags.map((tag) => tag.name),
          },
          /*{
            name: "localizationDescription",
            weight: 0.1,
            getFn: (localization: ArticleLocalization) =>
              localization.messageId
                ? app.messages.cache.get(localization.messageId)?.embeds[0]
                    ?.description ?? ""
                : "",
          },*/
        ],
      }
    );
    return fuse.search(input).map((f) => f.item);
  }

  public async getCommonsArticles(
    locale: LocaleTag
  ): Promise<ArticleLocalization[]>;
  public async getCommonsArticles(): Promise<Article[]>;
  public async getCommonsArticles(
    locale?: LocaleTag
  ): Promise<Article[] | ArticleLocalization[]> {
    const type: "LOCALE_ONLY" | "GLOBAL" = locale ? "LOCALE_ONLY" : "GLOBAL";

    const raws: any[] = await db.query(
      `
    select  BIN_TO_UUID(al.id) as articleLocalizationId, BIN_TO_UUID(a.id) as articleId, count(distinct als.articleLocalizationId, als.userId) as uses
    from \`Article\` a
    right join \`Article.Localization\` al on al.articleId  = a.id
    left join \`Article.Localization.Stats\` als on al.id = als.articleLocalizationId
    where unix_timestamp(als.createdAt) between unix_timestamp() - 1209600 and unix_timestamp() and al.published = 1 ${
      type === "LOCALE_ONLY" ? "and al.locale = ?" : ""
    }
    or unix_timestamp(als.createdAt) between unix_timestamp() - 2419200 and unix_timestamp() and al.published = 1 ${
      type === "LOCALE_ONLY" ? "and al.locale = ?" : ""
    }
    or al.articleId = a.id and al.published = 1 ${
      type === "LOCALE_ONLY" ? "and al.locale = ?" : ""
    }
    group by al.id
    order by count(distinct als.articleLocalizationId, als.userId) DESC
    limit 10;
    `,
      [locale, locale, locale]
    );

    if (!raws.length) return [];

    if (type === "LOCALE_ONLY") {
      const localizations = await this.fetchLocalization(
        raws.map((raw) => raw.articleLocalizationId)
      );
      return raws.flatMap(
        (raw) =>
          localizations.find(
            (localization) => localization.id === raw.articleLocalizationId
          ) ?? []
      );
    }

    const articles = await this.fetch();
    return raws.flatMap(
      (raw) => articles.find((article) => article.id === raw.articleId) ?? []
    );
  }

  public setHelpdeskSchedule(channel: TextChannel, locale: Locale) {
    this.schedules.get(channel.id)?.cancel();

    const rule = new schedule.RecurrenceRule();
    rule.hour = 0;
    rule.minute = 0;
    rule.second = 0;
    rule.tz = "Etc/UTC";

    const job = schedule.scheduleJob(rule, async () => {
      const messages = await channel.messages.fetch();
      messages
        .filter((message) => message.author.id === app.client.user?.id)
        .forEach((message) => message.delete());

      const commonsArticles = await this.getCommonsArticles();
      await this.sendCommonsArticles(channel, locale, true, true);

      Logger.info("Help desk Schedule has been renew");
    });

    this.schedules.set(channel.id, job);

    return job;
  }

  public async sendCommonsArticles(
    channel: TextChannel,
    locale: Locale,
    withInteractions = true,
    withRequestAssistantInteraction = true
  ) {
    const commonsArticles = await this.getCommonsArticles(locale.tag);

    const rowOne = commonsArticles.slice(0, 5).map((article, index) => ({
      type: ComponentType.Button,
      style: ButtonStyle.Secondary,
      customId: `helpdesk:article:${article.id}:asUser`,
      label: `${index + 1}`,
    }));
    const rowTwo = commonsArticles.slice(5, 8).map((article, index) => ({
      type: ComponentType.Button,
      style: ButtonStyle.Secondary,
      customId: `helpdesk:article:${article.id}:asUser`,
      label: `${index + 5}`,
    }));
    if (withRequestAssistantInteraction) {
      const requestAssistanceButton = {
        type: ComponentType.Button,
        style: ButtonStyle.Danger,
        label: locale.origin.plugins.interactionOnly.buttons[0],
        emoji: {
          name: "✋",
        },
        customId: `requestAssistant:create`,
      };
      rowTwo.push(requestAssistanceButton);
    }

    let components = [];
    if (rowOne.length)
      components.push({
        type: ComponentType.ActionRow,
        components: rowOne,
      });
    if (rowTwo.length)
      components.push({
        type: ComponentType.ActionRow,
        components: rowTwo as any,
      });
    if (!withInteractions) components = [];
    await channel.send({
      embeds: [
        {
          color: 3092790,
          title: locale.origin.helpdesk.title,
          description:
            commonsArticles.length > 0
              ? commonsArticles
                  .slice(0, 8)
                  .map((article, index) => `\`${index + 1}.\` ${article.title}`)
                  .join("\n\n")
              : locale.origin.helpdesk.thereNoPublishedArticle,
        },
      ],
      components: components,
    });
  }

  private resolve(raws: any[]) {
    return raws
      ?.filter(
        (raw, index) =>
          Util.isUUID(raw.id) &&
          raws.map((raw) => raw.id).indexOf(raw.id) === index
      )
      .map((article) => ({
        id: article.id,
        note: article.note,
        creatorId: article.creatorId,
        createdAt: new Date(Math.round(article.createdTimestampAt * 1000)),
        localizations: raws
          ?.filter(
            (raw, index) =>
              Util.isUUID(raw.localizationId) &&
              raw.id === article.id &&
              raws
                .map((raw) => raw.localizationId)
                .indexOf(raw.localizationId) === index
          )
          .map((localization) => ({
            id: localization.localizationId,
            title: localization.title,
            locale: localization.locale,
            messageId: localization.messageId,
            published:
              typeof localization.published === "number"
                ? !!localization.published
                : null,
            editable:
              typeof localization.editable === "number"
                ? !!localization.editable
                : null,
            updatedAt: new Date(
              Math.round(localization.localizationUpdatedTimestampAt * 1000)
            ),
            createdAt: new Date(
              Math.round(localization.localizationCreatedTimestampAt * 1000)
            ),
            tags: raws
              .filter(
                (tag, index) =>
                  Util.isUUID(tag.localizationTagId) &&
                  tag.localizationId === localization.localizationId &&
                  raws
                    .map((raw) => raw.localizationTagId)
                    .indexOf(tag.localizationTagId) === index
              )
              .map((tag) => ({
                id: tag.localizationTagId,
                name: tag.localizationTagName,
                creatorId: tag.localizationTagCreatorId,
                createdAt: new Date(
                  Math.round(tag.localizationTagCreatedTimestampAt * 1000)
                ),
              })),
          })),
      }));
  }
}
