import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ButtonStyle,
  ChatInputCommandInteraction,
  ComponentType,
} from "discord.js";
import { UserFlagsPolicy } from "../../structures/User";
import Response, {
  MessageResponse,
  ModalResponse,
  ResponseCodes,
} from "../../utils/Response";
import { BaseCommand } from "../BaseCommand";
import CommandMethod, { AnyInteraction } from "../CommandMethod";
import app from "../../app";
import Article from "../../structures/Article";
import Util from "../../utils/Util";
import moment from "moment";

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
    });
  }

  public async chatInputCommandInteraction(
    dcm: CommandMethod<ChatInputCommandInteraction>
  ): Promise<Response<MessageResponse | ModalResponse> | void> {
    const id = dcm.d.options.getString("id", true);

    const article = Util.isUUID(id) ? await app.articles.fetch(id, true) : null;

    if (!article)
      return new Response(
        ResponseCodes.ARTICLE_NOT_FOUND,
        dcm.locale.origin.commands.article.notFound
      );

    return ArticleManage.manage(dcm, article);
  }

  public static async manage(
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
      article.localizations
        .map(
          (localization) =>
            app.locales.get(localization.locale)?.origin.name ?? "Unknown"
        )
        .join(", ")
    );

    return new Response<MessageResponse>(ResponseCodes.SUCCESS, {
      ...dcm.locale.origin.commands.article.manage.main,
      components: [
        {
          type: ComponentType.ActionRow,
          components: [
            {
              type: ComponentType.SelectMenu,
              customId: `articleManage:${article.id}`,
              placeholder:
                dcm.locale.origin.commands.article.manage.main.selectMenu[0]
                  .placeholder,
              options: app.locales.cache.map((locale) => {
                const localization = article.localizations.get(locale.tag);
                return {
                  label: locale.origin.name,
                  emoji: {
                    name: locale.origin.flag,
                  },
                  description: localization
                    ? `Last update ${moment(localization.createdAt)
                        .locale(locale.tag)
                        .format("lll")}`
                    : undefined,
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
              label: dcm.locale.origin.commands.article.manage.main.buttons[0],
              customId: `articleManage:${article.id}:editNote`,
              style: ButtonStyle.Secondary,
            },
            {
              type: ComponentType.Button,
              label: dcm.locale.origin.commands.article.manage.main.buttons[1],
              customId: `articleManage:${article.id}:refresh`,
              style: ButtonStyle.Secondary,
            },
            {
              type: ComponentType.Button,
              label: dcm.locale.origin.commands.article.manage.main.buttons[2],
              customId: `articleManage:${article.id}:delete`,
              style: ButtonStyle.Danger,
            },
          ],
        },
      ],
    });
  }
}
