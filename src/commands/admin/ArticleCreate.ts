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
import CommandMethod from "../CommandMethod";
import app from "../../app";
import ArticleManage from "./ArticleManage";

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
    });
  }

  public async chatInputCommandInteraction(
    dcm: CommandMethod<ChatInputCommandInteraction>
  ): Promise<Response<MessageResponse | ModalResponse> | void> {
    const note = dcm.d.options.getString("note", true);

    const article = await app.articles.create(dcm.user.id, note);

    dcm.cf.formats.set("article.id", article.id);

    return new Response(ResponseCodes.SUCCESS, {
      ...dcm.locale.origin.commands.article.created,
      components: [
        {
          type: ComponentType.ActionRow,
          components: [
            {
              type: ComponentType.Button,
              style: ButtonStyle.Secondary,
              label: dcm.locale.origin.commands.article.created.button[0],
              customId: `articleManage:${article.id}`,
            },
          ],
        },
      ],
    });
  }
}
