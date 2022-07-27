import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  ComponentType,
  Guild,
  GuildMember,
  SelectMenuInteraction,
} from "discord.js";
import app from "../../app";
import { UserFlagsPolicy } from "../../structures/User";
import Exception, { Severity } from "../../utils/Exception";
import Response, { MessageResponse, ResponseCodes } from "../../utils/Response";
import { BaseCommand } from "../BaseCommand";
import { AnyMethod, Method } from "../CommandMethod";
import Fuse from "fuse.js";
import { LocaleTag } from "../../managers/LocaleManager";

export default class Languages extends BaseCommand {
  constructor() {
    super({
      flag: UserFlagsPolicy.NONE,
      memberPermissions: [],
      botPermissions: ["SendMessages", "EmbedLinks", "ManageRoles"],
      applicationCommandData: [
        {
          name: "languages",
          description: "...",
          type: ApplicationCommandType.ChatInput,
          options: [
            {
              name: "locale",
              type: ApplicationCommandOptionType.String,
              description: "...",
              /*choices: app.locales.cache.map((locale) => ({
                              name: locale.tag,
                              value: locale.tag,
                            })),*/
              autocomplete: true,
              required: true,
            },
          ],
        },
      ],
      messageComponent: (d) => {
        console.log(d.customIds);
        console.log(d.d.customId);
        if (d.matches("languages")) {
          return true;
        }
        return false;
      },
    });
  }

  public async chatInputCommandInteraction(
    dcm: Method<ChatInputCommandInteraction>
  ) {
    const localeArg = dcm.d.options.getString("locale", true);
    return Languages.setLocale(dcm, localeArg as LocaleTag);
  }

  public async selectMenuInteraction(dcm: Method<SelectMenuInteraction>) {
    if (dcm.getValue("languages", false) === "set")
      return Languages.setLocale(dcm, dcm.d.values[0] as LocaleTag);
    throw new Exception("Unknown Argument", Severity.FAULT, dcm);
  }

  public static async setLocale(
    dcm: AnyMethod,
    localeTag: LocaleTag
  ): Promise<Response<MessageResponse>> {
    const locale = app.locales.get(localeTag, true);
    await dcm.user.setLocale(locale.tag);
    //Get locale roles from guild;
    if (!app.locales.getGuildLocaleRoles(dcm.d.guild as Guild).get(localeTag))
      return new Response(ResponseCodes.LOCALE_ROLE_NOT_FOUND, {
        content: "Role not found.",
        ephemeral: true,
      }); // related to locale system.
    await app.locales.checkUserRoles(
      dcm.user,
      dcm.d.guild as Guild,
      dcm.d.member as GuildMember
    );
    return new Response(ResponseCodes.SUCCESS, {
      ...locale.origin.language.set,
      ephemeral: true,
    });
  }

  private getLocales(dcm: AnyMethod): Response<MessageResponse> {
    return new Response(ResponseCodes.SUCCESS, {
      content: "\n",
      components: [
        {
          type: ComponentType.ActionRow,
          components: [
            {
              type: ComponentType.SelectMenu,
              customId: "language:set",
              placeholder: "Select language you might understand", // related to locale system.
              minValues: 1,
              maxValues: app.locales.cache.size,
              options: app.locales.cache.map((locale) => ({
                label: locale.origin.name,
                value: locale.tag,
                default: dcm.user.locale == locale.tag,
              })),
            },
          ],
        },
      ],
      ephemeral: true,
    });
  }

  public async autoCompleteInteraction(dcm: Method<AutocompleteInteraction>) {
    const focused = dcm.d.options.getFocused(true);
    if (focused.name === "locale") {
      const value: string = (focused.value as string).trim();
      const fuse = new Fuse(
        app.locales.cache.map((locale) => locale),
        {
          threshold: 0.3,
          keys: ["tags", "tag", "origin.name"],
        }
      );
      return new Response(
        ResponseCodes.SUCCESS,
        value
          ? fuse.search(value).map((fu) => ({
              name: fu.item.origin.name,
              value: fu.item.tag,
            }))
          : app.locales.cache.map((locale) => ({
              name: locale.origin.name,
              value: locale.tag,
            }))
      );
    }
  }
}
