import { LocaleTag } from "../managers/LocaleManager";
import { MessageOptions } from "discord.js";
import Article from "./Article";

export default class ArticleLocalization {
  public readonly article: Article;
  public readonly id: string;
  public readonly translatorId: string;
  public readonly title: string;
  public readonly locale: LocaleTag;
  public readonly messageId: string | null;
  //public message: ArticleMessage;
  public readonly createdAt: Date;
  constructor(
    article: Article,
    id: string,
    //message: ArticleMessage,
    translatorId: string,
    title: string,
    locale: LocaleTag,
    messageId: string | null,
    createdAt: Date
  ) {
    this.article = article;
    this.id = id;
    //this.message = message;
    this.translatorId = translatorId;
    this.title = title;
    this.locale = locale;
    this.messageId = messageId;
    this.createdAt = createdAt;
  }

  public edit(options: {
    message?: ArticleLocalization;
    title?: string;
    note?: string;
  }) {}

  public feedback(userId: string, helpful: boolean) {}
}

type ArticleMessage = Pick<MessageOptions, "content" | "embeds">;
