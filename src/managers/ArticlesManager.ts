import db from "../providers/Mysql";
import { LocaleTag } from "./LocaleManager";
import CacheManager from "./CacheManager";
import Article from "../structures/Article";
import ArticleLocalization, {
  ArticleLocalizationTags,
} from "../structures/ArticleLocalization";
import { v4 as uuidv4 } from "uuid";
import Util from "../utils/Util";

export default class ArticlesManager extends CacheManager<Article> {
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
  ): Promise<ArticleLocalization | null> {
    const resolved = this.resolve(
      await db.query(
        `
    select BIN_TO_UUID(a.id) as id, a.note, a.creatorId, unix_timestamp(a.createdAt) as createdTimestampAt, BIN_TO_UUID(al.id) as localizationId, al.title, al.locale, BIN_TO_UUID(al.messageId) as messageId, unix_timestamp(al.createdAt) as localizationCreatedTimestampAt, unix_timestamp(al.updatedAt) as localizationUpdatedTimestampAt, al.published, al.editable, alt.tag as localizationTagName, alt.creatorId as localizationTagCreatorId, unix_timestamp(alt.createdAt) as localizationTagCreatedTimestampAt, BIN_TO_UUID(alt.articleLocalizationId) as tagReferenceLocalizationId
    from \`Article.Localization\` al
    right join \`Article\` a on al.articleId = a.id
    left join \`Article.Localization.Tag\` alt on alt.articleLocalizationId = al.id
    where BIN_TO_UUID(al.id) = ?;
    `,
        [id]
      )
    );
    if (!resolved.length) return null;
    const localization = resolved[0].localizations[0];

    const cachedArticle = this.cache.get(resolved[0].id);
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

      return articleLocalization;
    }

    const article = new Article(
      resolved[0].id,
      resolved[0].creatorId,
      resolved[0].note,
      resolved[0].createdAt,
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

    return articleLocalization;
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
              typeof localization.published === "boolean"
                ? localization.published
                : null,
            editable:
              typeof localization.editable === "boolean"
                ? localization.editable
                : null,
            updatedAt: new Date(
              Math.round(localization.localizationUpdatedTimestampAt * 1000)
            ),
            createdAt: new Date(
              Math.round(localization.localizationCreatedTimestampAt * 1000)
            ),
            tags: raws
              .filter(
                (tag) => tag.tagReferenceLocalizationId === localization.id
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
