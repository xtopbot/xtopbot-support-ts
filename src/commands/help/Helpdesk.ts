import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  AutocompleteInteraction,
  ButtonInteraction,
  ChatInputCommandInteraction,
  ComponentType,
  Guild,
  ModalSubmitInteraction,
  SelectMenuInteraction,
  TextInputStyle,
} from "discord.js";
import { UserFlagsPolicy } from "../../structures/User";
import Exception, { Reason, Severity } from "../../utils/Exception";
import Response, {
  ResponseCodes,
  Action,
  ModalResponse,
  MessageResponse,
  AutocompleteResponse,
} from "../../utils/Response";
import CommandMethod, {
  AnyInteraction,
  AnyMethod,
  Method,
} from "../CommandMethod";
import { BaseCommand } from "../BaseCommand";
import ComponentMethod, { AnyComponentInteraction } from "../ComponentMethod";
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
        if (d.matches("helpdesk")) {
          if (d.getValue("helpdesk", false) == "requestAssistant") return true;
        }
        return false;
      },
    });
  }
  //chatInputCommandInteraction(dcm: CommandMethod<>)
  public async buttonInteraction(dcm: Method<ButtonInteraction>) {
    if (dcm.getValue("helpdesk", false) === "requestAssistant")
      return RequestHumanAssistantPlugin.request(
        null,
        dcm,
        dcm.d.guild as Guild
      );

    throw new Exception("Unknown Custom Id", Severity.FAULT, dcm);
  }

  public async selectMenuInteraction(dcm: Method<SelectMenuInteraction>) {
    if (dcm.getValue("helpdesk", false) === "requestAssistant") {
      if (dcm.getKey("setLocale")) {
        const res = await Languages.setLocale(
          dcm,
          dcm.d.values[0] as LocaleTag
        );
        if (res.code !== ResponseCodes.SUCCESS) return res;
        return RequestHumanAssistantPlugin.request(
          null,
          dcm,
          dcm.d.guild as Guild
        );
      }
    }
    throw new Exception("Unknown Custom Id", Severity.FAULT, dcm);
  }

  public async autoCompleteInteraction(dcm: Method<AutocompleteInteraction>) {
    return new Response(ResponseCodes.SUCCESS, []);
  }
  public async modalSubmitInteraction(dcm: Method<ModalSubmitInteraction>) {
    if (dcm.getValue("helpdesk", false) === "requestAssistant") {
      await dcm.d.deferReply({ ephemeral: true });
      return RequestHumanAssistantPlugin.request(
        dcm.d.fields.getTextInputValue("issue"),
        dcm,
        dcm.d.guild as Guild
      );
    }
    return new Response(
      ResponseCodes.SUCCESS,
      {
        content: "test",
        ephemeral: true,
      },
      Action.REPLY
    );
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
