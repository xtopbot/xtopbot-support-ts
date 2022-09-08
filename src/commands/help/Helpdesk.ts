import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  AutocompleteInteraction,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  ComponentType,
} from "discord.js";
import { UserFlagsPolicy } from "../../structures/User";
import Response, { Action, ResponseCodes } from "../../utils/Response";
import CommandMethod, { Method } from "../CommandMethod";
import { BaseCommand } from "../BaseCommand";
import app from "../../app";
import Util from "../../utils/Util";
import ArticleLocalization from "../../structures/ArticleLocalization";
import Locale from "../../structures/Locale";
import ComponentMethod from "../ComponentMethod";

export default class HelpDesk extends BaseCommand {
  constructor() {
    super({
      flag: UserFlagsPolicy.NONE,
      memberPermissions: [],
      botPermissions: ["SendMessages", "EmbedLinks"],
      applicationCommandData: [
        {
          name: "helpdesk",
          description: "How can we help you?",
          type: ApplicationCommandType.ChatInput,
          options: [
            {
              name: "issue",
              description: "Describe your issue here",
              type: ApplicationCommandOptionType.String,
              autocomplete: true,
              required: true,
            },
          ],
        },
      ],
      messageComponent: (d) => {
        return d.matches("helpdesk");
      },
    });
  }

  public async chatInputCommandInteraction(
    dcm: CommandMethod<ChatInputCommandInteraction>
  ) {
    const issue = dcm.d.options.getString("issue");
    if (Util.isUUID(issue)) {
      const articleLocalization = await app.articles.fetchLocalization(
        issue as string
      );

      if (!articleLocalization || !articleLocalization.published)
        return new Response(ResponseCodes.SUCCESS, {
          ephemeral: true,
          ...dcm.locale.origin.commands.help.getArticle.articleNoLongerExits,
        });

      return new Response(ResponseCodes.SUCCESS, {
        ephemeral: true,
        ...(await HelpDesk.getArticleMessage(
          dcm.locale,
          articleLocalization,
          dcm.user.id
        )),
      });
    } else {
      const searchArticles = await app.articles.search(issue ?? "");
      if (!searchArticles.length)
        return new Response(ResponseCodes.NO_RESULTS_FOUND, {
          ephemeral: true,
          ...dcm.locale.origin.commands.help.noResultsFound,
        });

      return new Response(ResponseCodes.SUCCESS, {
        ephemeral: true,
        ...(await HelpDesk.getArticleMessage(
          dcm.locale,
          searchArticles[0],
          dcm.user.id
        )),
      });
    }
  }

  public async buttonInteraction(dcm: ComponentMethod<ButtonInteraction>) {
    if (dcm.getKey("article")) {
      const articleLocalizationId = dcm.getValue("article", true);
      const articleLocalization = await app.articles.fetchLocalization(
        articleLocalizationId
      );

      if (!articleLocalization || !articleLocalization.published)
        return new Response(ResponseCodes.SUCCESS, {
          ephemeral: true,
          ...dcm.locale.origin.commands.help.getArticle.articleNoLongerExits,
        });

      if (dcm.getKey("feedback")) {
        if (dcm.getKey("solved")) {
          await articleLocalization.addFeedback(dcm.user.id, true);
          return new Response(
            ResponseCodes.SUCCESS,
            await HelpDesk.getArticleMessage(
              dcm.locale,
              articleLocalization,
              dcm.user.id
            ),
            Action.UPDATE
          );
        } else if (dcm.getKey("unsolved")) {
          await articleLocalization.addFeedback(dcm.user.id, false);
          return new Response(
            ResponseCodes.SUCCESS,
            await HelpDesk.getArticleMessage(
              dcm.locale,
              articleLocalization,
              dcm.user.id
            ),
            Action.UPDATE
          );
        }
      } else if (dcm.getKey("asUser")) {
        return new Response(ResponseCodes.SUCCESS, {
          ephemeral: true,
          ...(await HelpDesk.getArticleMessage(
            dcm.locale,
            articleLocalization,
            dcm.user.id
          )),
        });
      }
    }
  }

  public static async getArticleMessage(
    locale: Locale,
    articleLocalization: ArticleLocalization,
    userId?: string
  ) {
    const message = articleLocalization.messageId
      ? await app.messages.fetch(articleLocalization.messageId, true)
      : null;
    const description = message?.embeds[0]?.description; //3159092
    const userFeedback = userId
      ? await articleLocalization.getFeedback(articleLocalization.id, userId)
      : null;
    const rowTwo = [
      {
        type: ComponentType.Button,
        style:
          userFeedback?.helpful === true
            ? ButtonStyle.Primary
            : ButtonStyle.Secondary,
        disabled: userFeedback?.helpful === true,
        label: locale.origin.article.buttons[1],
        customId: `helpdesk:article:${articleLocalization.id}:feedback:solved`,
      },
      {
        type: ComponentType.Button,
        style:
          userFeedback?.helpful === false
            ? ButtonStyle.Primary
            : ButtonStyle.Secondary,
        label: locale.origin.article.buttons[2],
        disabled: userFeedback?.helpful === false,
        customId: `helpdesk:article:${articleLocalization.id}:feedback:unsolved`,
      },
    ];
    if (userFeedback?.helpful === false)
      rowTwo.push({
        type: ComponentType.Button,
        style: ButtonStyle.Danger,
        label: locale.origin.plugins.interactionOnly.buttons[0],
        emoji: {
          name: "✋",
        },
        customId: `requestAssistant:create`,
      } as any);
    return {
      ...Util.addFieldToEmbed(
        Util.quickFormatContext(locale.origin.article, {
          "article.localization.title": articleLocalization.title,
          "article.localization.description": description ?? "",
        }),
        0,
        "color",
        3092790
      ),
      components: [
        {
          type: ComponentType.ActionRow,
          components: [
            {
              type: ComponentType.Button,
              style: ButtonStyle.Secondary,
              label: Util.textEllipsis(locale.origin.article.buttons[0], 80),
              customId: "#blank",
              disabled: true,
            },
          ],
        },
        {
          type: ComponentType.ActionRow,
          components: rowTwo,
        },
      ],
    };
  }

  protected async autoCompleteInteraction(
    dcm: Method<AutocompleteInteraction>
  ) {
    const focused = dcm.d.options.getFocused(true);
    if (focused.name === "issue") {
      const result = await app.articles.search(focused.value);
      return new Response(
        ResponseCodes.SUCCESS,
        result
          .filter(
            (article, index) =>
              result.map((article) => article.id).indexOf(article.id) === index
          )
          .map((localization) => ({
            name: localization.title,
            value: localization.id,
          }))
      );
    }
    return new Response(ResponseCodes.SUCCESS, []);
  }
}
