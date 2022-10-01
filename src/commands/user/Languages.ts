import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  AutocompleteInteraction,
  ButtonInteraction,
  ChatInputCommandInteraction,
  ComponentType,
  Guild,
  GuildMember,
  InteractionType,
  SelectMenuInteraction,
} from "discord.js";
import app from "../../app";
import { UserFlagsPolicy } from "../../structures/User";
import Response, {
  Action,
  MessageResponse,
  ResponseCodes,
} from "../../utils/Response";
import { BaseCommand } from "../BaseCommand";
import { AnyInteraction, Method } from "../CommandMethod";
import Fuse from "fuse.js";
import { LocaleTag } from "../../managers/LocaleManager";
import Util from "../../utils/Util";
import Constants from "../../utils/Constants";
import ComponentMethod from "../ComponentMethod";

export default class Languages extends BaseCommand {
  constructor() {
    super({
      flag: UserFlagsPolicy.NONE,
      memberPermissions: [],
      botPermissions: ["SendMessages", "EmbedLinks", "ManageRoles"],
      applicationCommandData: [
        {
          dmPermission: true,
          name: "user",
          description: "Shows/Edits your user language.",
          type: ApplicationCommandType.ChatInput,
          options: [
            {
              name: "language",
              description: "Shows/Edits your user language.",
              type: ApplicationCommandOptionType.Subcommand,
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
                  required: false,
                },
              ],
            },
          ],
        },
      ],
      messageComponent: (d) => {
        return d.matches("languages");
      },
    });
  }

  protected async chatInputCommandInteraction(
    dcm: Method<ChatInputCommandInteraction>
  ) {
    const localeArg = dcm.d.options.getString("locale", false);
    if (localeArg) return Languages.setLocale(dcm, localeArg as LocaleTag);

    return Languages.getLocales(dcm);
  }

  protected async buttonInteraction(dcm: Method<ButtonInteraction>) {
    return Languages.getLocales(dcm);
  }

  protected async selectMenuInteraction(dcm: Method<SelectMenuInteraction>) {
    if (dcm.getValue("languages", false) === "set")
      return Languages.setLocale(dcm, dcm.d.values[0] as LocaleTag);
  }

  public static async setLocale(
    dcm: Method<AnyInteraction>,
    localeTag: LocaleTag
  ): Promise<Response<MessageResponse>> {
    const locale = app.locales.get(localeTag, true);
    await dcm.user.setLocale(locale.tag);
    await app.locales.checkUserRoles(
      dcm.user,
      (dcm.d.guild as Guild) ??
        app.client.guilds.cache.get(Constants.supportServerId),
      (dcm.d.member as GuildMember) ??
        (await app.client.guilds.cache
          .get(Constants.supportServerId)
          ?.members.fetch(dcm.user.id))
    );
    return Languages.getLocales(dcm);
  }

  public static getLocales(
    dcm: Method<AnyInteraction>,
    customId?: string
  ): Response<MessageResponse> {
    return new Response(
      ResponseCodes.SUCCESS,
      {
        ...Util.addFieldToEmbed(
          dcm.locale.origin.commands.language,
          0,
          "color",
          Constants.defaultColors.BLUE
        ),
        components: [
          {
            type: ComponentType.ActionRow,
            components: [
              {
                type: ComponentType.SelectMenu,
                customId: customId ?? "languages:set",
                placeholder:
                  dcm.locale.origin.commands.language.selectMenu[0].placeholder,
                minValues: 1,
                maxValues: 1,
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
      },
      Action.UPDATE_WHILE_EPHEMERAL
    );
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
