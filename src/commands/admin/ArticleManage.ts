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
import CommandMethod, { AnyInteraction, Method } from "../CommandMethod";
import app from "../../app";
import Article from "../../structures/Article";
import Util from "../../utils/Util";
import moment from "moment";
import ComponentMethod, { AnyComponentInteraction } from "../ComponentMethod";
import Exception, { Severity } from "../../utils/Exception";
import { LocaleTag } from "../../managers/LocaleManager";
import ArticleLocalization from "../../structures/ArticleLocalization";
import Constants from "../../utils/Constants";

export default class ArticleManage extends BaseCommand {
  constructor() {
    super({
      flag:
        UserFlagsPolicy.SUPPORT |
        UserFlagsPolicy.MODERATOR |
        UserFlagsPolicy.ADMIN |
        UserFlagsPolicy.DEVELOPER,
      memberPermissions: [],
      botPermissions: ["SendMessages", "EmbedLinks"],
      applicationCommandData: [
        {
          dmPermission: true,
          defaultMemberPermissions: ["ManageMessages"],
          name: "article",
          description: "Manages your articles or all articles.",
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

  protected async chatInputCommandInteraction(
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

  protected async selectMenuInteraction(
    dcm: ComponentMethod<SelectMenuInteraction>
  ) {
    const firstValue = dcm.d.values[0];
    if (dcm.getKey("manageAll")) {
      if (Util.isUUID(firstValue)) {
        const article = await app.articles.fetch({ id: dcm.d.values[0] }, true);
        if (!article)
          return new Response(ResponseCodes.ARTICLE_NOT_FOUND, {
            ...dcm.locale.origin.commands.article.notFound.single,
            ephemeral: true,
          });
        return ArticleManage.manageSingleArticle(dcm, article);
      }
    } else if (dcm.getKey("localization")) {
      const article = await this.getArticleFromCustomId(dcm);
      if (!article)
        return new Response(ResponseCodes.ARTICLE_NOT_FOUND, {
          ...dcm.locale.origin.commands.article.notFound.single,
          ephemeral: true,
        });

      if (Util.isUUID(firstValue)) {
        const localization = article.localizations.get(firstValue);
        dcm.cf.formats.set("article.id", article.id);
        dcm.cf.formats.set("article.localization.id", firstValue);
        // UUID Localization
        if (!localization)
          return new Response(ResponseCodes.ARTICLE_LOCALIZATION_NOT_FOUND, {
            ...dcm.locale.origin.commands.article.notFound.localization,
            ephemeral: true,
          });
        return ArticleManage.manageArticleLocalization(dcm, localization);
      }
      // Local Tag
      const locale = app.locales.get(firstValue as LocaleTag, true);
      return new Response(
        ResponseCodes.SUCCESS,
        {
          title: Util.textEllipsis(
            Util.quickFormatContext(
              dcm.locale.origin.commands.article.manage.localization.modal[2]
                .title,
              { "locale.tag": locale.tag }
            ),
            45
          ),
          customId: `articleManage:manageSingle:${article.id}:localization:${locale.tag}:create`,
          components: [
            {
              type: ComponentType.ActionRow,
              components: [
                {
                  type: ComponentType.TextInput,
                  style: TextInputStyle.Short,
                  ...dcm.locale.origin.commands.article.manage.localization
                    .modal[2].textInput[0],
                  customId: "title",
                  minLength: 3,
                  maxLength: 100,
                },
              ],
            },
          ],
        },
        Action.MODAL
      );
    } else if (dcm.getKey("manageLocalization")) {
      const articleLocalization = await app.articles.fetchLocalization(
        dcm.getValue("manageLocalization", true)
      );
      if (!articleLocalization)
        return new Response(ResponseCodes.ARTICLE_LOCALIZATION_NOT_FOUND, {
          ...dcm.locale.origin.commands.article.notFound.localization,
          ephemeral: true,
        });

      if (dcm.getKey("removeTags")) {
        const unselectedValue = dcm.d.component.options
          .filter((option) => !dcm.d.values.includes(option.value))
          .map((option) => option.value);

        if (unselectedValue.length)
          await articleLocalization.removeTags(dcm.user.id, unselectedValue);

        return ArticleManage.manageArticleLocalization(
          dcm,
          articleLocalization
        );
      }
    }
  }

  protected async buttonInteraction(dcm: ComponentMethod<ButtonInteraction>) {
    if (dcm.getKey("manageSingle")) {
      const article = await this.getArticleFromCustomId(dcm);

      if (!article)
        return new Response(ResponseCodes.ARTICLE_NOT_FOUND, {
          ...dcm.locale.origin.commands.article.notFound.single,
          ephemeral: true,
        });
      if (dcm.getKey("editNote")) {
        if (article.creatorId !== dcm.user.id)
          return new Response(ResponseCodes.INSUFFICIENT_PERMISSION, {
            ...dcm.locale.origin.requirement.insufficientPermission,
            ephemeral: true,
          });
        return new Response(
          ResponseCodes.SUCCESS,
          {
            title: Util.textEllipsis(
              dcm.locale.origin.commands.article.manage.single.modals[0].title,
              45
            ),
            customId: `articleManage:manageSingle:${article.id}:editNote`,
            components: [
              {
                type: ComponentType.ActionRow,
                components: [
                  {
                    type: ComponentType.TextInput,
                    ...dcm.locale.origin.commands.article.manage.single
                      .modals[0].textInput[0],
                    style: TextInputStyle.Short,
                    minLength: 3,
                    maxLength: 100,
                    customId: "note",
                  },
                ],
              },
            ],
          },
          Action.MODAL
        );
      } else if (dcm.getKey("delete")) {
        if (
          article.creatorId !== dcm.user.id &&
          (dcm.user.flags &
            (Constants.StaffBitwise & ~UserFlagsPolicy.SUPPORT)) ===
            0
        )
          return new Response(ResponseCodes.INSUFFICIENT_PERMISSION, {
            ...dcm.locale.origin.requirement.insufficientPermission,
            ephemeral: true,
          });
        dcm.cf.formats.set("article.id", article.id);
        dcm.cf.formats.set(
          "article.localization.size",
          String(article.localizations.size)
        );
        if (dcm.getKey("confirmed")) {
          await article.delete();
          return new Response(
            ResponseCodes.SUCCESS,
            {
              ...dcm.locale.origin.commands.article.manage.single.delete
                .confirmed,
              components: [],
              ephemeral: true,
            },
            Action.UPDATE
          );
        }
        return new Response(
          ResponseCodes.SUCCESS,
          {
            ...dcm.locale.origin.commands.article.manage.single.delete,
            ephemeral: true,
            components: [
              {
                type: ComponentType.ActionRow,
                components: [
                  {
                    type: ComponentType.Button,
                    style: ButtonStyle.Danger,
                    label:
                      dcm.locale.origin.commands.article.manage.single.delete
                        .buttons[0],
                    customId: `articleManage:manageSingle:${article.id}:delete:confirmed`,
                  },
                  {
                    type: ComponentType.Button,
                    style: ButtonStyle.Secondary,
                    label:
                      dcm.locale.origin.commands.article.manage.single.delete
                        .buttons[1],
                    customId: `articleManage:manageSingle:${article.id}`,
                  },
                ],
              },
            ],
          },
          Action.UPDATE
        );
      }
      return ArticleManage.manageSingleArticle(dcm, article);
    } else if (dcm.getKey("manageAll")) {
      if (
        ["!userOnly", "userOnly", "refresh"].includes(dcm.getValue("manageAll"))
      )
        return ArticleManage.manageALlArticles(dcm, dcm.getKey("userOnly"));
    } else if (dcm.getKey("manageLocalization")) {
      const articleLocalization = await app.articles.fetchLocalization(
        dcm.getValue("manageLocalization", true)
      );
      if (!articleLocalization)
        return new Response(ResponseCodes.ARTICLE_LOCALIZATION_NOT_FOUND, {
          ...dcm.locale.origin.commands.article.notFound.localization,
          ephemeral: true,
        });

      if (dcm.getKey("editMessage")) {
        const message = articleLocalization.messageId
          ? await app.messages.fetch(articleLocalization.messageId, true)
          : null;
        return new Response(
          ResponseCodes.SUCCESS,
          {
            title: Util.textEllipsis(
              Util.quickFormatContext(
                dcm.locale.origin.commands.article.manage.localization.modal[0]
                  .title,
                { "article.localization.tag": articleLocalization.locale }
              ),
              45
            ),
            customId: `articleManage:manageLocalization:${articleLocalization.id}:editMessage`,
            components: [
              {
                type: ComponentType.ActionRow,
                components: [
                  {
                    type: ComponentType.TextInput,
                    style: TextInputStyle.Short,
                    customId: "title",
                    ...dcm.locale.origin.commands.article.manage.localization
                      .modal[0].textInput[0],
                    value: articleLocalization.title,
                    minLength: 3,
                    maxLength: 100,
                  },
                ],
              },
              {
                type: ComponentType.ActionRow,
                components: [
                  {
                    type: ComponentType.TextInput,
                    style: TextInputStyle.Paragraph,
                    customId: "description",
                    ...dcm.locale.origin.commands.article.manage.localization
                      .modal[0].textInput[1],
                    value: message?.embeds?.at(0)?.description ?? "",
                    minLength: 1,
                    maxLength: 4000,
                  },
                ],
              },
            ],
          },
          Action.MODAL
        );
      } else if (dcm.getKey("publish") || dcm.getKey("unpublish")) {
        if (
          articleLocalization.article.creatorId !== dcm.user.id &&
          (dcm.user.flags &
            (Constants.StaffBitwise & ~UserFlagsPolicy.SUPPORT)) ===
            0
        )
          return new Response(ResponseCodes.INSUFFICIENT_PERMISSION, {
            ...dcm.locale.origin.requirement.insufficientPermission,
            ephemeral: true,
          });
        await articleLocalization.edit(dcm.user.id, {
          published: dcm.getKey("publish"),
        });
        return ArticleManage.manageArticleLocalization(
          dcm,
          articleLocalization
        );
      } else if (dcm.getKey("revoke")) {
        if (
          articleLocalization.article.creatorId !== dcm.user.id &&
          (dcm.user.flags &
            (Constants.StaffBitwise & ~UserFlagsPolicy.SUPPORT)) ===
            0
        )
          return new Response(ResponseCodes.INSUFFICIENT_PERMISSION, {
            ...dcm.locale.origin.requirement.insufficientPermission,
            ephemeral: true,
          });
        dcm.cf.formats.set(
          "article.localization.tag",
          articleLocalization.locale
        );
        dcm.cf.formats.set("article.localization.id", articleLocalization.id);
        dcm.cf.formats.set("article.id", articleLocalization.article.id);
        await articleLocalization.revoke(dcm.user.id);
        return new Response(
          ResponseCodes.SUCCESS,
          {
            ...Util.addFieldToEmbed(
              dcm.locale.origin.commands.article.manage.localization.revoke,
              0,
              "color",
              Constants.defaultColors.RED
            ),
            components: [
              {
                type: ComponentType.ActionRow,
                components: [
                  {
                    type: ComponentType.Button,
                    style: ButtonStyle.Secondary,
                    label:
                      dcm.locale.origin.commands.article.manage.localization
                        .buttons[0],
                    customId: `articleManage:manageSingle:${articleLocalization.article.id}`,
                  },
                ],
              },
            ],
          },
          Action.UPDATE
        );
      } else if (dcm.getKey("addTag")) {
        return new Response(
          ResponseCodes.SUCCESS,
          {
            title: Util.quickFormatContext(
              dcm.locale.origin.commands.article.manage.localization.modal[1]
                .title,
              { "article.localization.tag": articleLocalization.locale }
            ),
            customId: `articleManage:manageLocalization:${articleLocalization.id}:addTag`,
            components: [
              {
                type: ComponentType.ActionRow,
                components: [
                  {
                    type: ComponentType.TextInput,
                    style: TextInputStyle.Short,
                    ...dcm.locale.origin.commands.article.manage.localization
                      .modal[1].textInput[0],
                    customId: "tag",
                    minLength: 3,
                    maxLength: 100,
                  },
                ],
              },
            ],
          },
          Action.MODAL
        );
      }
    }
  }

  protected async modalSubmitInteraction(
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
        if (article.creatorId !== dcm.user.id)
          return new Response(ResponseCodes.INSUFFICIENT_PERMISSION, {
            ...dcm.locale.origin.requirement.insufficientPermission,
            ephemeral: true,
          });

        const noteTextInput = dcm.d.fields.getField(
          "note",
          ComponentType.TextInput
        ).value;

        await article.edit({ note: noteTextInput });

        return ArticleManage.manageSingleArticle(dcm, article);
      } else if (dcm.getKey("localization")) {
        const locale = app.locales.get(
          dcm.getValue("localization", true) as LocaleTag,
          true
        );
        if (dcm.getKey("create")) {
          const titleTextInput = dcm.d.fields.getField(
            "title",
            ComponentType.TextInput
          ).value;

          const articleLocalization = await article.createLocalization(
            dcm.user.id,
            titleTextInput,
            locale.tag
          );
          return ArticleManage.manageArticleLocalization(
            dcm,
            articleLocalization
          );
        }
      }
    }
    if (dcm.getKey("manageLocalization")) {
      const articleLocalization = await app.articles.fetchLocalization(
        dcm.getValue("manageLocalization", true)
      );
      if (!articleLocalization)
        return new Response(ResponseCodes.ARTICLE_LOCALIZATION_NOT_FOUND, {
          ...dcm.locale.origin.commands.article.notFound.localization,
          ephemeral: true,
        });
      if (dcm.getKey("editMessage")) {
        const title = dcm.d.fields.getTextInputValue("title");
        const description = dcm.d.fields.getTextInputValue("description");

        let message = articleLocalization.messageId
          ? await app.messages.fetch(articleLocalization.messageId, true)
          : null;
        // edit message
        if (message) {
          await message.edit(null, [
            {
              description: description,
            },
          ]);
        } else if (typeof description === "string" && description.length > 0) {
          message = await app.messages.create(null, [
            {
              description: description,
            },
          ]);
        }

        await articleLocalization.edit(dcm.user.id, {
          title: title,
          messageId: message?.id ?? null,
        });
        return ArticleManage.manageArticleLocalization(
          dcm,
          articleLocalization
        );
      } else if (dcm.getKey("addTag")) {
        if (articleLocalization.tags.size >= 25)
          throw new Exception("Tags maximum limit reached", Severity.COMMON);
        const tag = dcm.d.fields.getTextInputValue("tag");
        if (typeof tag !== "string" || tag.length < 3 || tag.length > 100)
          throw new Exception(
            "Tag must be string and length between 3 to 100 .",
            Severity.SUSPICIOUS
          );

        await articleLocalization.addTags(dcm.user.id, tag);

        return ArticleManage.manageArticleLocalization(
          dcm,
          articleLocalization
        );
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

  public static async manageArticleLocalization(
    dcm: CommandMethod<AnyInteraction>,
    articleLocalization: ArticleLocalization
  ): Promise<Response<MessageResponse>> {
    const message = articleLocalization.messageId
      ? await app.messages.fetch(articleLocalization.messageId, true)
      : null;
    dcm.cf.formats.set("article.localization.tag", articleLocalization.locale);
    dcm.cf.formats.set("article.localization.id", articleLocalization.id);
    const contributors = await articleLocalization.fetchContributors();
    dcm.cf.formats.set(
      "article.localization.contributors.mention",
      contributors.length
        ? contributors.map((userId) => `<@${userId}>`).join(", ")
        : "N/A"
    );
    dcm.cf.formats.set(
      "article.localization.lastUpdatedTimestamp",
      String(
        Math.round(
          message?.updatedAt.getTime() ??
            articleLocalization.createdAt.getTime() / 1000
        )
      )
    );
    dcm.cf.formats.set("article.note", articleLocalization.article.note);
    dcm.cf.formats.set("article.id", articleLocalization.article.id);
    dcm.cf.formats.set("article.localization.title", articleLocalization.title);
    dcm.cf.formats.set(
      "article.localization.tags.size",
      String(articleLocalization.tags.size)
    );
    dcm.cf.formats.set(
      "article.localization.description",
      message?.embeds[0].description ?? ""
    );

    const tagsOptions = articleLocalization.tags
      .map((tag, key) => ({
        label: tag.name,
        description: Util.quickFormatContext(
          dcm.locale.origin.commands.article.manage.localization.selectMenu[0]
            .options[0].description,
          {
            "tag.createdAt": moment(tag.createdAt)
              .locale(dcm.locale.tag)
              .format("lll"),
          }
        ),
        default: true,
        value: key,
      }))
      .slice(0, 25);

    return new Response(
      ResponseCodes.SUCCESS,
      {
        ...dcm.locale.origin.commands.article.manage.localization,
        embeds:
          dcm.locale.origin.commands.article.manage.localization.embeds.concat([
            {
              author: {
                name: dcm.locale.origin.commands.article.manage.localization
                  .extra[0],
              },
              ...dcm.locale.origin.article.embeds[0],
            } as any,
          ]),
        components: [
          {
            type: ComponentType.ActionRow,
            components: [
              {
                type: ComponentType.Button,
                style: ButtonStyle.Secondary,
                label:
                  dcm.locale.origin.commands.article.manage.localization
                    .buttons[0],
                customId: `articleManage:manageSingle:${articleLocalization.article.id}`,
              },
              {
                type: ComponentType.Button,
                style: ButtonStyle.Secondary,
                label:
                  dcm.locale.origin.commands.article.manage.localization
                    .buttons[1],
                customId: `articleManage:manageLocalization:${articleLocalization.id}:editMessage`,
              },
              {
                type: ComponentType.Button,
                style: articleLocalization.published
                  ? ButtonStyle.Primary
                  : ButtonStyle.Secondary,
                label: articleLocalization.published
                  ? dcm.locale.origin.commands.article.manage.localization
                      .buttons[4]
                  : dcm.locale.origin.commands.article.manage.localization
                      .buttons[3],
                customId: `articleManage:manageLocalization:${
                  articleLocalization.id
                }:${articleLocalization.published ? "unpublish" : "publish"}`,
              },
              {
                type: ComponentType.Button,
                style: ButtonStyle.Secondary,
                label:
                  dcm.locale.origin.commands.article.manage.localization
                    .buttons[5] +
                  (articleLocalization.tags.size >= 25
                    ? " " +
                      dcm.locale.origin.commands.article.manage.localization
                        .extra[1]
                    : ""),
                customId: `articleManage:manageLocalization:${articleLocalization.id}:addTag`,
                disabled: articleLocalization.tags.size >= 25,
              },
              {
                type: ComponentType.Button,
                style: ButtonStyle.Danger,
                label:
                  dcm.locale.origin.commands.article.manage.localization
                    .buttons[2],
                customId: `articleManage:manageLocalization:${articleLocalization.id}:revoke`,
                disable: true,
              },
            ],
          },
          (articleLocalization.tags.size >= 1
            ? {
                type: ComponentType.ActionRow,
                components: [
                  {
                    type: ComponentType.SelectMenu,
                    placeholder:
                      dcm.locale.origin.commands.article.manage.localization
                        .selectMenu[0].placeholder,
                    customId: `articleManage:manageLocalization:${articleLocalization.id}:removeTags`,
                    options: tagsOptions,
                    minValues: 0,
                    maxValues: Math.min(articleLocalization.tags.size, 25), // Edit this
                  },
                ],
              }
            : undefined) as any,
        ].filter((row) => typeof row !== "undefined"),
        ephemeral: true,
      },
      Action.UPDATE
    );
  }

  public static async manageALlArticles(
    dcm: CommandMethod<AnyInteraction>,
    userOnly: boolean,
    options?: { page?: number }
  ): Promise<Response<MessageResponse>> {
    const articles = userOnly
      ? await app.articles.fetch({ userId: dcm.user.id }, false)
      : await app.articles.fetch();

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
          selectMenuOptions.push({
            ...Util.quickFormatContext(
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
            ),
            value: article.id,
          })
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
    dcm: Method<AnyInteraction>,
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

    return new Response<MessageResponse>(
      ResponseCodes.SUCCESS,
      {
        ...dcm.locale.origin.commands.article.manage.single,
        ephemeral: true,

        components: [
          {
            type: ComponentType.ActionRow,
            components: [
              {
                type: ComponentType.SelectMenu,
                customId: `articleManage:manageSingle:${article.id}:localization`,
                placeholder:
                  dcm.locale.origin.commands.article.manage.single.selectMenu[0]
                    .placeholder,
                options: app.locales.cache.map((locale) => {
                  const localization = article.localizations.find(
                    (localization) => localization.locale == locale.tag
                  );
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
                          .locale(dcm.locale.tag)
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
      },
      [InteractionType.MessageComponent, InteractionType.ModalSubmit].includes(
        dcm.d.type
      )
        ? Action.UPDATE
        : Action.REPLY
    );
  }
}
