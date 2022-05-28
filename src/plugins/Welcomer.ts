import {
  ButtonStyle,
  GuildMember,
  Role,
  ComponentType,
  MessageActionRowComponentData,
  PartialGuildMember,
} from "discord.js";
import app from "../app";
import WelcomerManager from "../managers/WelcomerManager";
import ContextFormat from "../utils/ContextFormats";
import Logger from "../utils/Logger";
import Response, { MessageResponse, ResponseCodes } from "../utils/Response";
import ServerUtil from "../utils/ServerUtil";

export default class WelcomerPlugin {
  private static manager = new WelcomerManager();

  public static async onMemberJoin(member: GuildMember): Promise<void> {
    const user = await app.users.fetch(member.user);

    const localeRoles = ServerUtil.getLocaleRoles(member.guild);
    if (!localeRoles.length)
      return Logger.warn(
        `[Welcomer] Unable to find locale roles in ${member.guild.name} (${member.guild.id})`
      );

    const userLocaleRole = localeRoles.find(
      (localeRole) => localeRole.locale == user.locale
    );
    if (userLocaleRole) {
      // Auto role when this user he selected locale before.
      Logger.info(
        `[Welcomer](Auto) Add ${userLocaleRole.locale}(@${userLocaleRole.role?.name}) to user ${member.user.tag} (${member.id}) [GuildId: ${member.guild.id}] `
      );
      console.log(userLocaleRole);
      await member.roles.add(userLocaleRole.role as Role);
    } else {
      const content: string = localeRoles
        .filter((localeRole) => !!localeRole.content)
        .map((localeRole) => localeRole.content)
        .join("\n\n");
      if (!content)
        return Logger.debug(
          "[Welcomer] Unable to find content to send a message!"
        );
      const channel = ServerUtil.getWelcomerChannel(member.guild);
      const cfx = new ContextFormat();
      cfx.setObject("user", member.user);
      cfx.formats.set("user.tag", member.user.tag);
      const _response = new Response<MessageResponse>(
        ResponseCodes.PLUGIN_SUCCESS,
        {
          content: content,
          components: [
            {
              type: ComponentType.ActionRow,
              components: localeRoles
                .map((localeRole) => ({
                  type: ComponentType.Button,
                  style: ButtonStyle.Secondary,
                  customId: `locale:${localeRole.locale}:plugin(welcomer)`,
                  label: localeRole.button[0].label,
                  emoji: localeRole.button[0].emoji,
                }))
                .slice(0, 5) as MessageActionRowComponentData[],
            },
          ],
        }
      );
      const response = await channel.send(cfx.resolve(_response));
      this.manager.cache.set(member.id, response);
    }
  }

  public static async onMemberLeave(member: GuildMember | PartialGuildMember) {
    const welcomerMessage = this.manager.cache.get(member.id);
    if (welcomerMessage) {
      welcomerMessage.delete();
      this.manager.cache.delete(member.id);
    }
  }
}
