import { LocaleTag } from "../managers/LocaleManager";
import Article from "./Article";
import Exception, { Severity } from "../utils/Exception";
import app from "../app";
import db from "../providers/Mysql";
import mysql2 from "mysql2/promise";
import Logger from "../utils/Logger";

export default class ArticleLocalization {
  public declare readonly article: Article;
  public readonly id: string;
  public readonly locale: LocaleTag;
  public title: string;
  public messageId: string | null;
  public published: boolean = false; // Default value = false;
  public editable: boolean = true; // Default value = true;
  public readonly createdAt: Date = new Date();

  constructor(
    article: Article,
    id: string,
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

  public async edit(
    contributorId: string,
    options: {
      title?: string;
      messageId?: string | null;
      published?: boolean;
      editable?: boolean;
    }
  ): Promise<this> {
    let actions = 0;
    if (typeof options.title !== "string") delete options.title;
    else actions |= ContributorActions.EDIT_TITLE;
    if (typeof options.messageId !== "string" && options.messageId !== null)
      delete options.messageId;
    else actions |= ContributorActions.EDIT_MESSAGE;
    if (typeof options.published !== "boolean") delete options.published;
    else
      actions |= options.published
        ? ContributorActions.PUBLISHED
        : ContributorActions.UNPUBLISHED;
    if (typeof options.editable !== "boolean") delete options.editable;

    if (
      typeof options.title === "undefined" &&
      typeof options.published === "undefined" &&
      typeof options.editable === "undefined" &&
      typeof options.messageId === "undefined"
    )
      throw new Exception(
        "Must have one param to edit Article Localization",
        Severity.SUSPICIOUS
      );

    const keys = [];
    const values = [];
    for (const [key, value] of Object.entries(options)) {
      keys.push(`${key} = ${key === "messageId" ? "UUID_TO_BIN(?)" : "?"}`);
      values.push(value);
    }
    values.push(this.id);

    await db.query(
      `update \`Article.Localization\` set ${keys.join(
        ", "
      )} where BIN_TO_UUID(id) = ?`,
      values
    );

    await this.contributor(contributorId, actions);

    if (options.title) this.title = options.title;
    if (options.messageId) this.title = options.messageId;
    if (options.published) this.published = options.published;
    if (options.editable) this.editable = options.editable;

    return this;
  }

  public async contributor(userId: string, actions: number) {
    await db.query(
      `insert into \`Article.Localization.Contributor\` (userId, articleLocalizationId, actions) values (?, UUID_TO_BIN(?), ?)`,
      [userId, this.id, actions]
    );
  }

  public async revoke(contributorId: string) {
    await db.query(
      "delete from `Article.Localization` where BIN_TO_UUID(id) = ?",
      [this.id]
    );
    await this.contributor(contributorId, ContributorActions.REVOKE);

    if (this.messageId)
      await db
        .query("delete from `Message` where BIN_TO_UUID(id) = ?", [
          this.messageId,
        ])
        .catch((err) =>
          Logger.info(
            `Trying to delete ${this.messageId} Message but there exception ${err?.message}`
          )
        );
  }

  public async fetchContributors(actions = false): Promise<string[]> {
    const raws: any[] = await db.query(
      `select userId from \`Article.Localization.Contributor\` where BIN_TO_UUID(articleLocalizationId) = ? group by userId`,
      [this.id]
    );
    return (
      raws
        ?.filter((raw: any) => typeof raw?.userId === "string")
        .map((raw: any) => raw.userId) ?? []
    );
  }

  public feedback(userId: string, helpful: boolean) {}
}
export enum ContributorActions {
  NONE = 0,
  CREATE = 1 << 0,
  EDIT_TITLE = 1 << 1,
  EDIT_MESSAGE = 1 << 2,
  REVOKE = 1 << 3,
  PUBLISHED = 1 << 4,
  UNPUBLISHED = 1 << 5,
}
