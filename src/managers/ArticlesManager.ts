import db from "../providers/Mysql";
import { LocaleTag } from "./LocaleManager";
import CacheManager from "./CacheManager";
import Article from "../structures/Article";
import ArticleLocalization from "../structures/ArticleLocalization";
import { v4 as uuidv4 } from "uuid";

export default class ArticlesManager extends CacheManager<Article> {
  constructor() {
    super();
  }

  public async fetch(id: string, force: boolean): Promise<Article | null> {
    if (!force) {
      const cachedArticle = this.cache.get(id);
      if (
        cachedArticle &&
        cachedArticle.fetchedType !== "SINGLE_ARTICLE_LOCALIZATIONS"
      )
        return cachedArticle;
    }

    const resolved = this.resolve(
      await db.query(
        `
    select BIN_TO_UUID(a.id) as id, a.note, a.creatorId, unix_timestamp(a.createdAt) as createdTimestampAt, al.id as localizationId, al.translatorId, al.title, al.locale, al.messageId, unix_timestamp(al.createdAt) as localizationCreatedTimestampAt, alt.tag as localizationTagName, alt.creatorId as localizationTagCreatorId, unix_timestamp(alt.createdAt) as localizationTagCreatedTimestampAt, alt.articleLocalizationId as tagReferenceLocalizationId
    from \`Article\` a
    left join \`Article.Localization\` al on al.articleId = a.id
    left join \`Article.Localization.Tag\` alt on alt.articleLocalizationId = al.id
    where a.id = ?;
      `,
        [id]
      )
    );
    if (!resolved.id) return null;

    const article = new Article(
      resolved.id,
      resolved.creatorId,
      resolved.note,
      resolved.createdAt,
      "ALL_ARTICLE_LOCALIZATIONS"
    );
    resolved.localizations.map((localization) =>
      article.localizations.set(
        localization.id,
        new ArticleLocalization(
          article,
          localization.id,
          localization.translatorId,
          localization.title,
          localization.locale as LocaleTag,
          localization.messageId,
          localization.createdAt
        )
      )
    );

    return this._add(article);
  }
  public async fetchLocalization(
    id: string
  ): Promise<ArticleLocalization | null> {
    const resolved = this.resolve(
      await db.query(
        `
    select BIN_TO_UUID(a.id) as id, a.note, a.creatorId, unix_timestamp(a.createdAt) as createdTimestampAt, al.id as localizationId, al.translatorId, al.title, al.locale, al.messageId, unix_timestamp(al.createdAt) as localizationCreatedTimestampAt, alt.tag as localizationTagName, alt.creatorId as localizationTagCreatorId, unix_timestamp(alt.createdAt) as localizationTagCreatedTimestampAt, alt.articleLocalizationId as tagReferenceLocalizationId
    from \`Article.Localization\` al
    right join \`Article\` a on al.articleId = a.id
    left join \`Article.Localization.Tag\` alt on alt.articleLocalizationId = al.id
    where al.id = UUID_TO_BIN(?);
    `,
        [id]
      )
    );
    const localization = resolved?.localizations?.at(0);
    if (!resolved.id || !localization) return null;

    const cachedArticle = this.cache.get(resolved.id);
    if (cachedArticle) {
      const articleLocalization = new ArticleLocalization(
        cachedArticle,
        localization.id,
        localization.translatorId,
        localization.title,
        localization.locale as LocaleTag,
        localization.messageId,
        localization.createdAt
      );
      cachedArticle.localizations.delete(articleLocalization.id);
      cachedArticle.localizations.set(
        articleLocalization.id,
        articleLocalization
      );

      return articleLocalization;
    }

    const article = new Article(
      resolved.id,
      resolved.creatorId,
      resolved.note,
      resolved.createdAt,
      "SINGLE_ARTICLE_LOCALIZATIONS"
    );
    const articleLocalization = new ArticleLocalization(
      article,
      localization.id,
      localization.translatorId,
      localization.title,
      localization.locale as LocaleTag,
      localization.messageId,
      localization.createdAt
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
    return {
      id: raws?.at(0)?.id,
      note: raws?.at(0)?.note,
      creatorId: raws?.at(0)?.creatorId,
      createdAt: new Date(Math.round(raws?.at(0)?.createdTimestampAt * 1000)),
      localizations: raws
        ?.filter(
          (raw, index) =>
            raws
              .map((raw) => raw.localizationId)
              .indexOf(raw.localizationId) === index
        )
        .map((raw) => ({
          id: raw.localizationId,
          translatorId: raw.translatorId,
          title: raw.title,
          locale: raw.locale,
          messageId: raw.messageId,
          /*updatedAt: new Date(
            Math.round(raw.localizationUpdatedTimestampAt * 1000)
          ),*/
          createdAt: new Date(
            Math.round(raw.localizationCreatedTimestampAt * 1000)
          ),
          tags: raws
            .filter((raw2) => raw2.tagReferenceLocalizationId === raw.id)
            .map((raw2) => ({
              name: raw2.localizationTagName,
              creatorId: raw2.localizationTagCreatorId,
              createdAt: new Date(
                Math.round(raw2.localizationTagCreatedTimestampAt * 1000)
              ),
            })),
        })),
    };
  }
}
