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
      `insert into \`Article.Localization\` (id, articleId, title, locale, messageId) values (UUID_TO_BIN(?), UUID_TO_BIN(?), ?, ?, ?)`,
      [id, this.id, title, locale, messageId ?? null]
    );

    let actions = 1 >> 0; //Create
    if (title) actions |= 1 >> 1; // Edit title
    if (messageId) actions |= 1 >> 2; // Edit Message

    await db.query(
      `replace into \`Article.Localization.Contributor\` (userId, articleLocalizationId, actions) values (?, UUID_TO_BIN(?), ?)`,
      [translatorId, id, actions]
    );

    const localization = new ArticleLocalization(
      this,
      id,
      title,
      locale,
      messageId ?? null
    );

    this.localizations.set(localization.id, localization);

    return localization;
  }

  public async edit(options: { note: string }) {
    await db.query("update `Article` set note = ? where BIN_TO_UUID(id) = ?", [
      options.note,
      this.id,
    ]);
    this.note = options.note;
  }

  public async fetch(): Promise<Article> {
    const article = await app.articles.fetch({ id: this.id }, true);
    if (!article)
      throw new Exception(
        `\`${this.id}\` Article no longer exists!`,
        Severity.SUSPICIOUS
      );

    return article;
  }
}
