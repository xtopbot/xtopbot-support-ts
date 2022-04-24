import {
  ChannelType,
  Collection,
  DiscordAPIError,
  Guild,
  Role,
  TextChannel,
} from "discord.js";
import app from "../app";
import CommandMethod, { InteractionsType } from "../commands/CommandMethod";
import ComponentMethod, { ComponentTypes } from "../commands/ComponentMethod";
import Logger from "../utils/Logger";
import Response, { Action, ResponseCodes } from "../utils/Response";

export default class RequestHumanAssistantPlugin {
  public readonly requests: Collection<string, RequestHumanAssistant> =
    new Collection();
  private readonly defaultInteractionExpires =
    1000 /*MiliSecond*/ * 60 /*Minute*/ * 15; //ms
  private readonly defaultAssistanceRoleName = "assistance";
  private readonly defaultAssistanceChannelName = "assistance";

  public async request(
    issue: string,
    dcm: CommandMethod<InteractionsType> | ComponentMethod<ComponentTypes>,
    guild: Guild
  ): Promise<Response<InteractionsType>> {
    const guildAssistants = this.getGuildAssistants(guild);
    if (!dcm.user.locale)
      return new Response(
        ResponseCodes.LOCALE_ASSISTANCE_ROLE_NOT_FOUND,
        { content: "You must Have lang" },
        Action.REPLY
      ); // User must have lang
    const assistant = guildAssistants.get(dcm.user.locale);
    if (!assistant)
      return new Response(
        ResponseCodes.LOCALE_ASSISTANCE_ROLE_NOT_FOUND,
        { content: "Unable to find Assistant for your lang" },
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
          { content: "Already requested" },
          Action.REPLY
        );
      }
      await this.removeRequestedUser(dcm.user.id, guild);
    }
    assistant.channel.send(`${dcm.d.user.tag} need help. issue: \`${issue}\``);
    return new Response(
      ResponseCodes.PLUGIN_SUCCESS,
      { content: `Done! Go to <#${assistant.channel.id}>` },
      Action.REPLY
    );
  }

  public async removeRequestedUser(id: string, guild?: Guild): Promise<void> {
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

  public getGuildAssistants(guild: Guild): Collection<string, AssistanceUtil> {
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
                " " +
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
  interaction: InteractionsType;
  locale: string;
};

type AssistanceUtil = {
  role: Role;
  channel: TextChannel;
};
