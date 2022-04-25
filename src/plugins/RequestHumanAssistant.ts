import {
  ChannelType,
  Collection,
  DiscordAPIError,
  Guild,
  Role,
  TextChannel,
} from "discord.js";
import app from "../app";
import CommandMethod, { AnyInteraction } from "../commands/CommandMethod";
import ComponentMethod, {
  AnyComponentInteraction,
} from "../commands/ComponentMethod";
import Logger from "../utils/Logger";
import Response, { Action, ResponseCodes } from "../utils/Response";

export default class RequestHumanAssistantPlugin {
  public static readonly requests: Collection<string, RequestHumanAssistant> =
    new Collection();
  private static readonly defaultInteractionExpires =
    1000 /*MiliSecond*/ * 60 /*Minute*/ * 15; //ms
  private static readonly defaultAssistanceRoleName = "assistance";
  private static readonly defaultAssistanceChannelName = "assistance";

  public static async request(
    issue: string,
    dcm:
      | CommandMethod<AnyInteraction>
      | ComponentMethod<AnyComponentInteraction>,
    guild: Guild
  ): Promise<Response<AnyInteraction>> {
    const guildAssistants = this.getGuildAssistants(guild);
    if (!dcm.user.locale)
      return new Response(
        ResponseCodes.REQUIRED_USER_LOCALE,
        { content: "You must Have lang", ephemeral: true },
        Action.REPLY
      ); // User must have lang
    const assistant = guildAssistants.get(dcm.user.locale);
    if (!assistant)
      return new Response(
        ResponseCodes.LOCALE_ASSISTANT_NOT_FOUND,
        { content: "Unable to find Assistant for your lang", ephemeral: true },
        Action.REPLY
      );
    const requested = this.requests.get(dcm.user.id);
    if (requested) {
      if (
        requested.interaction.createdTimestamp >
          Date.now() - this.defaultInteractionExpires &&
        dcm.member.roles.cache.get(assistant.role.id)
      ) {
        return new Response(
          ResponseCodes.ALREADY_REQUESTED_ASSISTANT,
          { content: "Already requested", ephemeral: true },
          Action.REPLY
        );
      }
      await this.removeRequestedUser(dcm.user.id, guild);
    }
    await dcm.member.roles.add(assistant.role);
    assistant.channel.send(`${dcm.d.user.tag} need help. issue: \`${issue}\``);
    return new Response(
      ResponseCodes.PLUGIN_SUCCESS,
      { content: `Done! Go to <#${assistant.channel.id}>`, ephemeral: true },
      Action.REPLY
    );
  }

  public static async removeRequestedUser(
    id: string,
    guild?: Guild
  ): Promise<void> {
    if (guild) {
      const request = this.requests.get(id);
      if (request) {
        const guildAssistants = this.getGuildAssistants(guild);
        const assistant = guildAssistants.get(request.locale);
        if (assistant) {
          try {
            await (await guild.members.fetch(id)).roles.remove(assistant.role);
          } catch (err) {
            Logger.error(
              `[RequestHumanAssistantPlugin] Role Remove Error: ${
                (err as DiscordAPIError).message
              }`
            );
          }
        }
      }
    }
    this.requests.delete(id);
  }

  public static getGuildAssistants(
    guild: Guild
  ): Collection<string, AssistanceUtil> {
    const assistances: Collection<string, AssistanceUtil> = new Collection();
    app.locales.cache.forEach((locale) => {
      const assistanceRole = guild.roles.cache.find(
        (role) =>
          !!locale.tags.find(
            (tag) =>
              role.name.toLowerCase() ==
              this.defaultAssistanceRoleName.toLowerCase() +
                " " +
                tag.toLowerCase()
          )
      );
      const assistanceChannel = guild.channels.cache.find(
        (channel) =>
          !!locale.tags.find(
            (tag) =>
              channel.name.toLowerCase() ==
              this.defaultAssistanceChannelName.toLowerCase() +
                "-" +
                tag.toLowerCase()
          ) && channel.type === ChannelType.GuildText
      );

      if (assistanceRole && assistanceChannel)
        assistances.set(locale.tag, {
          role: assistanceRole,
          channel: assistanceChannel as TextChannel,
        });
    });
    return assistances;
  }
}

type RequestHumanAssistant = {
  requestedAt: string;
  interaction: AnyInteraction;
  locale: string;
};

type AssistanceUtil = {
  role: Role;
  channel: TextChannel;
};
