import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  ComponentType,
  InteractionType,
  ModalSubmitInteraction,
  SelectMenuInteraction,
  TextInputStyle,
} from "discord.js";
import { UserFlagsPolicy } from "../../structures/User";
import Response, {
  Action,
  MessageResponse,
  ResponseCodes,
} from "../../utils/Response";
import { BaseCommand } from "../BaseCommand";
import CommandMethod, { AnyInteraction } from "../CommandMethod";
import app from "../../app";
import Article from "../../structures/Article";
import Util from "../../utils/Util";
import moment from "moment";
import ComponentMethod, { AnyComponentInteraction } from "../ComponentMethod";
import ArticleCreate from "./ArticleCreate";

export default class ArticleManage extends BaseCommand {
  constructor() {
    super({
      flag:
        UserFlagsPolicy.SUPPORT &
        UserFlagsPolicy.MODERATOR &
        UserFlagsPolicy.ADMIN &
        UserFlagsPolicy.DEVELOPER,
      memberPermissions: [],
      botPermissions: ["SendMessages", "EmbedLinks"],
      applicationCommandData: [
        {
          dmPermission: true,
          defaultMemberPermissions: ["ManageMessages"],
          name: "article",
          description: "Manage your articles or all articles.",
          type: ApplicationCommandType.ChatInput,
          options: [
            {
              name: "manage",
              description: "Manage your articles or all articles.",
              type: ApplicationCommandOptionType.Subcommand,
              options: [
                {
                  name: "id",
                  description: "Manage specific article",
                  type: ApplicationCommandOptionType.String,
                  maxLength: 36,
                  minLength: 36,
                  required: false,
                },
              ],
            },
          ],
        },
      ],
      messageComponent: (d) => {
        return d.matches("articleManage");
      },
    });
  }

  public async chatInputCommandInteraction(
    dcm: CommandMethod<ChatInputCommandInteraction>
  ) {
    const articleId = dcm.d.options.getString("id", false);

    if (!articleId) return ArticleManage.manageALlArticles(dcm, false);
    const article = Util.isUUID(articleId)
      ? await app.articles.fetch({ id: articleId }, true)
      : null;

    if (!article)
      return new Response(ResponseCodes.ARTICLE_NOT_FOUND, {
        ...dcm.locale.origin.commands.article.notFound,
        ephemeral: true,
      });

    return ArticleManage.manageSingleArticle(dcm, article);
  }

  public async selectMenuInteraction(
    dcm: ComponentMethod<SelectMenuInteraction>
  ) {
    if (dcm.getKey("manageAll")) {
      if (Util.isUUID(dcm.d.values[0])) {
        const article = await app.articles.fetch({ id: dcm.d.values[0] }, true);
        if (!article)
          return new Response(ResponseCodes.ARTICLE_NOT_FOUND, {
            ...dcm.locale.origin.commands.article.notFound,
            ephemeral: true,
          });
        return ArticleManage.manageSingleArticle(dcm, article);
      }
    }
  }

  public async buttonInteraction(dcm: ComponentMethod<ButtonInteraction>) {
    if (dcm.getKey("manageSingle")) {
      const article = await this.getArticleFromCustomId(dcm);

      if (!article)
        return new Response(ResponseCodes.ARTICLE_NOT_FOUND, {
          ...dcm.locale.origin.commands.article.notFound,
          ephemeral: true,
        });
      if (dcm.getKey("editNote"))
        return new Response(ResponseCodes.SUCCESS, {
          title: dcm.locale.origin.commands.article.manage.editNote.title,
          customId: `articleManage:manageSingle:${article.id}`,
          components: [
            {
              type: ComponentType.ActionRow,
              components: [
                {
                  type: ComponentType.TextInput,
                  ...dcm.locale.origin.commands.article.manage.editNote
                    .textInput[0],
                  style: TextInputStyle.Short,
                  minLength: 3,
                  maxLength: 100,
                  customId: "note",
                },
              ],
            },
          ],
        });
      return ArticleManage.manageSingleArticle(dcm, article);
    } else if (dcm.getKey("manageAll")) {
      if (
        ["!userOnly", "userOnly", "refresh"].includes(dcm.getValue("manageAll"))
      )
        return ArticleManage.manageALlArticles(dcm, dcm.getKey("userOnly"));
    }
  }

  public async modalSubmitInteraction(
    dcm: ComponentMethod<ModalSubmitInteraction>
  ) {
    if (dcm.getKey("manageSingle")) {
      const article = await this.getArticleFromCustomId(dcm);

      if (!article)
        return new Response(ResponseCodes.ARTICLE_NOT_FOUND, {
          ...dcm.locale.origin.commands.article.notFound,
          ephemeral: true,
        });

      if (dcm.getKey("editNote")) {
        const noteTextInput = dcm.d.fields.getField(
          "note",
          ComponentType.TextInput
        ).value;

        await article.edit({ note: noteTextInput });

        return ArticleManage.manageSingleArticle(dcm, article);
      }
    }
  }

  private async getArticleFromCustomId(
    dcm: ComponentMethod<AnyComponentInteraction>
  ): Promise<Article | null> {
    const articleId = dcm.getValue("manageSingle", false);

    return articleId && Util.isUUID(articleId)
      ? await app.articles.fetch({ id: articleId }, true)
      : null;
  }

  public static async manageALlArticles(
    dcm: CommandMethod<AnyInteraction>,
    userOnly: boolean,
    options?: { page?: number }
  ): Promise<Response<MessageResponse>> {
    const articles = userOnly
      ? await app.articles.fetch({ userId: dcm.user.id }, false)
      : await app.articles.fetch();

    console.log(articles);
    const selectMenuOptions = [];

    const selectedPage =
      typeof options?.page === "number" && options.page > 0 ? options.page : 1;

    if (articles.length > 0) {
      const selectMenuPages = Util.selectMenuPages(articles.length);

      const selectMenuPage =
        selectMenuPages[Math.min(selectedPage, selectMenuPages.length) - 1];

      if (selectMenuPage.page > 1) {
        dcm.cf.formats.set(
          "articles.previous.length",
          String(selectMenuPage.firstIndex + 1)
        );
        selectMenuOptions.push({
          ...dcm.locale.origin.commands.article.manage.all.selectMenu[0]
            .options[3],
          value: selectMenuPage.page - 1,
        }); // previous option
      }

      articles
        .slice(selectMenuPage.firstIndex, selectMenuPage.lastIndex + 1)
        .map((article) =>
          selectMenuOptions.push(
            Util.quickFormatContext(
              article.localizations.size > 0
                ? dcm.locale.origin.commands.article.manage.all.selectMenu[0]
                    .options[1]
                : dcm.locale.origin.commands.article.manage.all.selectMenu[0]
                    .options[0],
              {
                note: Util.textEllipsis(article.note, 100),
                "article.lastUpdate": moment(
                  article.localizations
                    .sort(
                      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
                    )
                    .first()?.createdAt
                )
                  .locale(dcm.locale.tag)
                  .format("lll"),
              }
            )
          )
        );

      if (selectMenuPages.length > selectMenuPage.page) {
        dcm.cf.formats.set(
          "articles.next.length",
          String(articles.length - selectMenuPage.lastIndex + 1)
        );
        selectMenuOptions.push({
          ...dcm.locale.origin.commands.article.manage.all.selectMenu[0]
            .options[4],
          value: selectMenuPage.page + 1,
        }); // next option
      }
    }

    selectMenuOptions.push({
      ...dcm.locale.origin.commands.article.manage.all.selectMenu[0].options[2],
      emoji: {
        name: "➕",
      },
      value: "create",
    }); // Create Article Option

    return new Response(
      ResponseCodes.SUCCESS,
      {
        ...dcm.locale.origin.commands.article.manage.all,
        ephemeral: true,
        components: [
          {
            type: ComponentType.ActionRow,
            components: [
              {
                type: ComponentType.SelectMenu,
                customId: "articleManage:manageAll",
                placeholder:
                  dcm.locale.origin.commands.article.manage.all.selectMenu[0]
                    .placeholder,
                options: selectMenuOptions as any,
                minValues: 1,
                maxValues: 1,
              },
            ],
          },
          {
            type: ComponentType.ActionRow,
            components: [
              {
                type: ComponentType.Button,
                style: ButtonStyle.Secondary,
                label: dcm.locale.origin.commands.article.manage.all.buttons[0],
                customId: `articleManage:manageAll:refresh`,
              },
              {
                type: ComponentType.Button,
                style: userOnly ? ButtonStyle.Primary : ButtonStyle.Secondary,
                label: dcm.locale.origin.commands.article.manage.all.buttons[1], // Own Only
                customId: `articleManage:manageAll:${
                  userOnly ? "!" : ""
                }userOnly`,
              },
            ],
          },
        ],
      },
      [InteractionType.MessageComponent, InteractionType.ModalSubmit].includes(
        dcm.d.type
      )
        ? Action.UPDATE
        : Action.REPLY
    );
  }

  public static async manageSingleArticle(
    dcm: CommandMethod<AnyInteraction>,
    article: Article
  ): Promise<Response<MessageResponse>> {
    dcm.cf.formats.set("article.id", article.id);
    dcm.cf.formats.set("article.note", article.note);
    dcm.cf.formats.set(
      "article.createdTimestampAt",
      String(Math.round(article.createdAt.getTime() / 1000))
    );
    dcm.cf.formats.set("article.creator.id", article.creatorId);
    dcm.cf.formats.set(
      "article.localizations",
      article.localizations.size > 0
        ? article.localizations
            .map(
              (localization) =>
                app.locales.get(localization.locale)?.origin.name ?? "Unknown"
            )
            .join(", ")
        : dcm.locale.origin.commands.article.manage.single.selectMenu[0]
            .options[0]
    );

    return new Response<MessageResponse>(ResponseCodes.SUCCESS, {
      ...dcm.locale.origin.commands.article.manage.single,
      ephemeral: true,

      components: [
        {
          type: ComponentType.ActionRow,
          components: [
            {
              type: ComponentType.SelectMenu,
              customId: `articleManage:manageSingle:${article.id}`,
              placeholder:
                dcm.locale.origin.commands.article.manage.single.selectMenu[0]
                  .placeholder,
              options: app.locales.cache.map((locale) => {
                const localization = article.localizations.get(locale.tag);
                return {
                  label: locale.origin.name,
                  emoji: {
                    name: locale.origin.flag,
                  },
                  description: localization
                    ? `${
                        dcm.locale.origin.commands.article.manage.single
                          .selectMenu[0].options[1]
                      } ${moment(localization.createdAt)
                        .locale(locale.tag)
                        .format("lll")}`
                    : dcm.locale.origin.commands.article.manage.single
                        .selectMenu[0].options[0],
                  value: localization?.id ?? locale.tag,
                };
              }),
            },
          ],
        },
        {
          type: ComponentType.ActionRow,
          components: [
            {
              type: ComponentType.Button,
              label:
                dcm.locale.origin.commands.article.manage.single.buttons[0],
              customId: `articleManage:manageSingle:${article.id}:editNote`,
              style: ButtonStyle.Secondary,
            },
            {
              type: ComponentType.Button,
              label:
                dcm.locale.origin.commands.article.manage.single.buttons[1],
              customId: `articleManage:manageSingle:${article.id}:refresh`,
              style: ButtonStyle.Secondary,
            },
            {
              type: ComponentType.Button,
              label:
                dcm.locale.origin.commands.article.manage.single.buttons[2],
              customId: `articleManage:manageSingle:${article.id}:delete`,
              style: ButtonStyle.Danger,
            },
          ],
        },
      ],
    });
  }
}
