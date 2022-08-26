import { LocaleTag } from "../managers/LocaleManager";
import Article from "./Article";
import Exception, { Severity } from "../utils/Exception";
import app from "../app";
import db from "../providers/Mysql";
import Logger from "../utils/Logger";
import { v4 as uuidv4 } from "uuid";
import { Collection } from "discord.js";

export default class ArticleLocalization {
  public declare readonly article: Article;
  public readonly id: string;
  public readonly locale: LocaleTag;
  public title: string;
  public messageId: string | null;
  public published: boolean = false; // Default value = false;
  public editable: boolean = true; // Default value = true;
  public readonly createdAt: Date = new Date();
  public tags = new Collection<string, Omit<ArticleLocalizationTags, "id">>();

  constructor(
    article: Article,
    id: string,
    title: string,
    locale: LocaleTag,
    tags: ArticleLocalizationTags[],
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
    tags.map((tag) => this.tags.set(tag.id, tag));
    this.messageId = messageId;
    this.published =
      typeof options?.published === "boolean" ? this.published : this.published;
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
      values.push(key === "published" ? Number(value) : value);
    }
    values.push(this.id);

    await db.query(
      `update \`Article.Localization\` set ${keys.join(
        ", "
      )} where BIN_TO_UUID(id) = ?`,
      values
    );

    await this.addContributor(contributorId, actions);

    if (typeof options.title === "string") this.title = options.title;
    if (typeof options.messageId === "string")
      this.messageId = options.messageId;
    if (typeof options.published === "boolean")
      this.published = options.published;
    if (typeof options.editable === "boolean") this.editable = options.editable;

    return this;
  }

  public async addTags(contributorId: string, tags: string[]): Promise<void>;
  public async addTags(contributorId: string, tag: string): Promise<void>;
  public async addTags(
    contributorId: string,
    tag: string[] | string
  ): Promise<void> {
    const validation = (t: string) => {
      if (typeof t !== "string" || t.length < 3 || t.length > 100)
        throw new Exception(
          "Tag must be string and length > 3 && < 100",
          Severity.COMMON
        );
      return t;
    };
    const tags = Array.isArray(tag)
      ? tag.map((t) => ({ name: validation(t), id: uuidv4() }))
      : [{ name: validation(tag), id: uuidv4() }];

    await db.query(
      `insert into \`Article.Localization.Tag\` (id, articleLocalizationId, creatorId, tag) values ${tags
        .map((t) => "(UUID_TO_BIN(?), UUID_TO_BIN(?), ?, ?)")
        .join(", ")}`,
      tags.map((t) => [t.id, this.id, contributorId, t.name]).flat(1)
    );

    await this.addContributor(contributorId, ContributorActions.ADD_TAGS);
    tags.map((t) =>
      this.tags.set(t.id, {
        name: t.name,
        creatorId: contributorId,
        createdAt: new Date(),
      })
    );
  }

  public async removeTags(
    contributorId: string,
    tagId: string[]
  ): Promise<void>;
  public async removeTags(contributorId: string): Promise<void>;
  public async removeTags(contributorId: string, tagsId?: string[]) {
    const isSpecifiedTagId = Array.isArray(tagsId);

    await db.query(
      `delete from \`Article.Localization.Tag\` where BIN_TO_UUID(articleLocalizationId) = ? ${
        isSpecifiedTagId ? "and BIN_TO_UUID(id) IN (?)" : ""
      }`,
      [this.id, tagsId]
    );
    await this.addContributor(
      contributorId,
      isSpecifiedTagId
        ? ContributorActions.REMOVE_TAG
        : ContributorActions.REMOVE_ALL_TAGS
    );
    if (isSpecifiedTagId) tagsId.map((t) => this.tags.delete(t));
    else this.tags.clear();
  }

  public async revoke(contributorId: string) {
    await db.query(
      "delete from `Article.Localization` where BIN_TO_UUID(id) = ?",
      [this.id]
    );
    await this.addContributor(contributorId, ContributorActions.REVOKE);

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

  public async addFeedback(
    userId: string,
    helpful: boolean,
    userReference?: string
  ): Promise<void> {
    if (userReference) await app.users.fetch(userReference);
    await db.query(
      "insert into `Article.Localization.Stats` (id, userId, articleLocalizationId, issueSolved, userReference) values (UUID_TO_BIN(?), ?, UUID_TO_BIN(?), ?, ?)",
      [uuidv4(), userId, this.id, Number(helpful), userReference ?? null]
    );
  }

  public async getFeedback(
    articleLocalizationId: string,
    userId: string
  ): Promise<{
    userId: string;
    helpful: boolean;
    createdAt: Date;
  } | null> {
    const [raw] = await db.query(
      "select userId, issueSolved, unix_timestamp(createdAt) as createdTimestampAt from `Article.Localization.Stats` where userId = ? and BIN_TO_UUID(articleLocalizationId) = ? order by createdTimestampAt desc limit 1",
      [userId, articleLocalizationId]
    );

    if (!raw || !raw.userId) return null;
    return {
      userId: raw.userId,
      helpful: !!raw.issueSolved,
      createdAt: new Date(Math.round(raw.createdTimestampAt * 1000)),
    };
  }

  public async addContributor(userId: string, actions: number) {
    await db.query(
      `insert into \`Article.Localization.Contributor\` (userId, articleLocalizationId, actions) values (?, UUID_TO_BIN(?), ?)`,
      [userId, this.id, actions]
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
}
export enum ContributorActions {
  NONE = 0,
  CREATE = 1 << 0,
  EDIT_TITLE = 1 << 1,
  EDIT_MESSAGE = 1 << 2,
  REVOKE = 1 << 3,
  PUBLISHED = 1 << 4,
  UNPUBLISHED = 1 << 5,
  ADD_TAGS = 1 << 6,
  REMOVE_TAG = 1 << 7,
  REMOVE_ALL_TAGS = 1 << 8,
}

export interface ArticleLocalizationTags {
  id: string;
  name: string;
  creatorId: string;
  createdAt: Date;
}
