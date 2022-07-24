import { LocaleTag } from "../managers/LocaleManager";
import ArticleLocalization from "./ArticleLocalization";
import db from "../providers/Mysql";
import Exception, { Severity } from "../utils/Exception";
import { Collection } from "discord.js";
import app from "../app";
import { v4 as uuidv4 } from "uuid";

export default class Article {
  public readonly id: string;
  public readonly creatorId: string;
  public note: string;
  public readonly createdAt: Date;
  public declare fetchedType:
    | "SINGLE_ARTICLE_LOCALIZATIONS"
    | "ALL_ARTICLE_LOCALIZATIONS";
  public readonly localizations: Collection<string, ArticleLocalization> =
    new Collection();
  constructor(
    id: string,
    creatorId: string,
    note: string,
    createdAt: Date,
    fetchedType: "SINGLE_ARTICLE_LOCALIZATIONS" | "ALL_ARTICLE_LOCALIZATIONS"
  ) {
    this.id = id;
    this.creatorId = creatorId;
    this.note = note;
    this.createdAt = createdAt;
    this.fetchedType = fetchedType;
  }

  public async createLocalization(
    translatorId: string,
    title: string,
    locale: LocaleTag,
    messageId?: string
  ): Promise<ArticleLocalization> {
    await this.fetch();

    if (
      this.localizations.find((localization) => localization.locale === locale)
    )
      throw new Exception(
        `There ${locale} localization for this article`,
        Severity.COMMON
      );

    const id = uuidv4();
    await db.query(
      `insert into \`Article.Localization\` (id, articleId, translatorId, title, locale, messageId) values (UUID_TO_BIN(?), UUID_TO_BIN(?), ?, ?, ?, ?)`,
      [id, this.id, translatorId, title, locale, messageId ?? null]
    );

    const localization = new ArticleLocalization(
      this,
      id,
      translatorId,
      title,
      locale,
      messageId ?? null
    );

    this.localizations.set(localization.id, localization);

    return localization;
  }

  public async fetch(): Promise<Article> {
    const article = await app.articles.fetch(this.id, true);
    if (!article)
      throw new Exception(
        `\`${this.id}\` Article no longer exists!`,
        Severity.SUSPICIOUS
      );

    return article;
  }
}
