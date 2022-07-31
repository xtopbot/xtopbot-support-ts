import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ButtonStyle,
  ChatInputCommandInteraction,
  ComponentType,
  SelectMenuInteraction,
  TextInputStyle,
} from "discord.js";
import { UserFlagsPolicy } from "../../structures/User";
import Response, {
  MessageResponse,
  ModalResponse,
  ResponseCodes,
} from "../../utils/Response";
import { BaseCommand } from "../BaseCommand";
import CommandMethod, { AnyMethod } from "../CommandMethod";
import app from "../../app";
import ComponentMethod from "../ComponentMethod";

export default class ArticleCreate extends BaseCommand {
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
          description: "Create a useful article for users",
          type: ApplicationCommandType.ChatInput,
          options: [
            {
              name: "create",
              description: "Create a useful article for users",
              type: ApplicationCommandOptionType.Subcommand,
              options: [
                {
                  name: "note",
                  description:
                    "The main idea of the article (this will appear to staff only)",
                  type: ApplicationCommandOptionType.String,
                  maxLength: 36,
                  minLength: 1,
                  required: true,
                },
              ],
            },
          ],
        },
      ],
      messageComponent: (d) => {
        if (
          d.matches("articleManage") &&
          d.d instanceof SelectMenuInteraction &&
          d.d.values[0] === "create"
        )
          return true;
        return d.matches("articleCreate");
      },
    });
  }

  public async chatInputCommandInteraction(
    dcm: CommandMethod<ChatInputCommandInteraction>
  ) {
    const note = dcm.d.options.getString("note", true);

    return ArticleCreate.createArticle(dcm, note);
  }

  public async selectMenuInteraction(
    dcm: ComponentMethod<SelectMenuInteraction>
  ) {
    if (dcm.getKey("manageAll") && dcm.d.values[0] === "create")
      return ArticleCreate.createArticle(dcm);
  }

  private static async createArticle(dcm: AnyMethod, note?: string) {
    if (!note)
      return new Response(ResponseCodes.ARTICLE_NEED_TO_FILL_NOTE_FIELD, {
        ...dcm.locale.origin.commands.article.create,
        customId: "articleCreate:create",
        components: [
          {
            type: ComponentType.ActionRow,
            components: [
              {
                type: ComponentType.TextInput,
                ...dcm.locale.origin.commands.article.create.textInput[0],
                style: TextInputStyle.Short,
                minLength: 3,
                maxLength: 100,
                customId: "note",
              },
            ],
          },
        ],
      });

    const article = await app.articles.create(dcm.user.id, note);

    dcm.cf.formats.set("article.id", article.id);

    return new Response(ResponseCodes.SUCCESS, {
      ...dcm.locale.origin.commands.article.created,
      ephemeral: true,
      components: [
        {
          type: ComponentType.ActionRow,
          components: [
            {
              type: ComponentType.Button,
              style: ButtonStyle.Secondary,
              label: dcm.locale.origin.commands.article.created.button[0],
              customId: `articleManage:manageSingle:${article.id}`,
            },
          ],
        },
      ],
    });
  }
}
