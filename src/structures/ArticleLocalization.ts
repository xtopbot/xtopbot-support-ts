import { LocaleTag } from "../managers/LocaleManager";
import Article from "./Article";
import Exception, { Severity } from "../utils/Exception";
import app from "../app";
import db from "../providers/Mysql";

export default class ArticleLocalization {
  public declare readonly article: Article;
  public readonly id: string;
  public readonly translatorId: string;
  public readonly locale: LocaleTag;
  public title: string;
  public messageId: string | null;
  public published: boolean = false; // Default value = false;
  public editable: boolean = true; // Default value = true;
  public readonly createdAt: Date = new Date();

  constructor(
    article: Article,
    id: string,
    translatorId: string,
    title: string,
    locale: LocaleTag,
    messageId: string | null,
    options?: {
      published: boolean | null;
      editable: boolean | null;
      createdAt?: Date;
    }
  ) {
    this.article = article;
    this.id = id;
    this.translatorId = translatorId;
    this.title = title;
    this.locale = locale;
    this.messageId = messageId;
    this.published =
      typeof options?.published === "boolean"
        ? options.published
        : this.published;
    this.editable =
      typeof options?.editable === "boolean" ? options.editable : this.editable;
    this.messageId = messageId;
    this.createdAt = options?.createdAt ?? this.createdAt;
  }

  public fetchMessage(force = false) {
    if (!this.messageId)
      throw new Exception(
        `${this.article.id} Article ${this.locale} Localization Message not created yet! `,
        Severity.COMMON
      );
    return app.messages.fetch(this.messageId, force);
  }

  public async edit(options: {
    title?: string;
    published?: boolean;
    editable?: boolean;
  }): Promise<this> {
    if (typeof options.title !== "string") delete options.title;
    if (typeof options.published !== "boolean") delete options.published;
    if (typeof options.editable !== "boolean") delete options.editable;

    if (!options.title && !options.published && !options.editable)
      throw new Exception(
        "Must have one param to edit Article Localization",
        Severity.SUSPICIOUS
      );

    await db.query(`update \`Article.Localization\` set ? where id = ?`, [
      options,
      this.id,
    ]);

    if (options.title) this.title = options.title;
    if (options.published) this.published = options.published;
    if (options.editable) this.editable = options.editable;

    return this;
  }

  public feedback(userId: string, helpful: boolean) {}
}
