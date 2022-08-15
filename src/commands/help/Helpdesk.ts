import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  AutocompleteInteraction,
  ButtonInteraction,
  Guild,
  ModalSubmitInteraction,
  SelectMenuInteraction,
} from "discord.js";
import { UserFlagsPolicy } from "../../structures/User";
import Response, { ResponseCodes } from "../../utils/Response";
import CommandMethod, { Method } from "../CommandMethod";
import { BaseCommand } from "../BaseCommand";
import ComponentMethod from "../ComponentMethod";
import RequestHumanAssistantPlugin from "../../plugins/RequestHumanAssistant";
import Languages from "../user/Languages";
import { LocaleTag } from "../../managers/LocaleManager";

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
        if (d.matches("helpdesk")) return true;
        return false;
      },
    });
  }

  public async autoCompleteInteraction(dcm: Method<AutocompleteInteraction>) {
    return new Response(ResponseCodes.SUCCESS, []);
  }

  private async getArticle(
    dcm: CommandMethod<any> | ComponentMethod<any>,
    id: number
  ) {
    /*const article = dcm.locale.origin.helpdesk.articles.find(
          (article) => article.id == id
        );
        if (!article) throw new Exception("Article not found", Severity.FAULT);
        return article;*/
  }
}
