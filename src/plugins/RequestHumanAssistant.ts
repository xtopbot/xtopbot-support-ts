import {
  ChannelType,
  Collection,
  DiscordAPIError,
  Guild,
  Role,
  TextChannel,
  ThreadChannel,
} from "discord.js";
import app from "../app";
import CommandMethod, {
  AnyInteraction,
  Method,
} from "../commands/CommandMethod";
import ComponentMethod, {
  AnyComponentInteraction,
} from "../commands/ComponentMethod";
import { LocaleTag } from "../managers/LocaleManager";
import User from "../structures/User";
import ContextFormats from "../utils/ContextFormats";
import Logger from "../utils/Logger";
import Response, {
  Action,
  MessageResponse,
  ResponseCodes,
} from "../utils/Response";
import Util from "../utils/Util";

export default class RequestHumanAssistantPlugin {
  public static readonly requests: Collection<string, RequestHumanAssistant> =
    new Collection();
  private static readonly defaultInteractionExpires =
    1000 /*MiliSecond*/ * 60 /*Minute*/ * 15; //ms
  private static readonly defaultAssistantRoleName = "assistant";
  private static readonly defaultAssistanceRoleName = "assistance";
  private static readonly defaultAssistanceChannelName = "assistance";

  public static async request(
    issue: string,
    dcm: Method<AnyInteraction>,
    guild: Guild
  ): Promise<Response<MessageResponse>> {
    const guildAssistants = this.getGuildAssistants(guild);
    const availability = await this.checkAvailability(guildAssistants, dcm);
    if (availability) return availability;
    const requested = this.requests.get(dcm.user.id);
    if (requested) {
      if (
        requested.interaction.createdTimestamp >
          Date.now() - this.defaultInteractionExpires &&
        dcm.member.roles.cache.get((guildAssistants.role as Role).id)
      ) {
        return new Response(ResponseCodes.ALREADY_REQUESTED_ASSISTANT, {
          content: "Already requested",
          ephemeral: true,
        });
      }
      await this.removeRequestedUser(dcm.user.id, guild);
    }
    await dcm.member.roles.add(guildAssistants.role as Role);
    const thread = await (
      guildAssistants.channel as TextChannel
    ).threads.create({
      name: Util.textEllipsis(issue, 100),
      autoArchiveDuration: 60,
      type:
        guild.premiumTier >= 2
          ? ChannelType.GuildPrivateThread
          : ChannelType.GuildPublicThread,
      invitable: false,
    });
    const locale = app.locales.get(dcm.user.locale);
    const assistant = guildAssistants.assistants.get(locale.tag) as {
      role: Role;
    };
    await thread.members.add(dcm.d.user.id);
    dcm.cf.setObject("user", dcm.d.user);
    dcm.cf.formats.set("user.tag", dcm.d.user.tag);
    dcm.cf.formats.set("support.role.id", assistant.role.id);
    dcm.cf.formats.set("thread.id", thread.id);
    thread.send(
      dcm.cf.resolve(
        locale.origin.plugins.requestHumanAssistant.threadCreated.thread
      )
    );
    this.requests.set(dcm.d.user.id, {
      interaction: dcm.d,
      locale: locale.tag,
      requestedAt: new Date(),
      thread: thread,
    });
    return new Response(
      ResponseCodes.PLUGIN_SUCCESS,
      {
        ...locale.origin.plugins.requestHumanAssistant.threadCreated
          .interaction,
        ephemeral: true,
      },
      Action.REPLY
    );
  }

  public static async checkAvailability(
    guildAssistants: GuildAssistants,
    dcm: Method<AnyInteraction>
  ): Promise<Response<MessageResponse> | null> {
    const locale = app.locales.get(dcm.user.locale);
    if (!dcm.user.locale)
      return new Response(
        ResponseCodes.REQUIRED_USER_LOCALE,
        { content: "You must Have lang", ephemeral: true },
        Action.REPLY
      ); // User must have lang
    if (!guildAssistants.role || !guildAssistants.channel)
      return new Response(
        ResponseCodes.LOCALE_ASSISTANT_NOT_FOUND,
        {
          ...locale.origin.plugins.serverNotMeetPluginCriteria,
          ephemeral: true,
        },
        Action.REPLY
      );
    const oldRequest = this.requests.get(dcm.user.id);
    if (oldRequest) {
      const thread = await dcm.d.guild?.channels.fetch(oldRequest.thread.id);
      if (thread) {
        dcm.cf.formats.set("thread.id", thread.id);
        if (!dcm.member.roles.cache.get(guildAssistants.role.id))
          await dcm.member.roles.add(guildAssistants.role);
        if ((thread as unknown as ThreadChannel)?.archived === false)
          return new Response(
            ResponseCodes.LOCALE_ASSISTANT_NOT_FOUND,
            {
              ...locale.origin.plugins.requestHumanAssistant.activeThread,
              ephemeral: true,
            },
            Action.REPLY
          );
      }
    }
    const assistant = guildAssistants.assistants.get(dcm.user.locale);
    if (!assistant)
      return new Response(
        ResponseCodes.LOCALE_ASSISTANT_NOT_FOUND,
        { content: "Unable to find Assistant for your lang", ephemeral: true },
        Action.REPLY
      );
    return null;
  }

  public static async removeRequestedUser(
    id: string,
    guild?: Guild
  ): Promise<void> {
    if (guild) {
      const request = this.requests.get(id);
      if (request) {
        const guildAssistants = this.getGuildAssistants(guild);
        if (guildAssistants.role) {
          try {
            await (
              await guild.members.fetch(id)
            ).roles.remove(guildAssistants.role);
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

  public static getGuildAssistants(guild: Guild): GuildAssistants {
    const assistants: Collection<LocaleTag, { role: Role }> = new Collection();
    app.locales.cache.forEach((locale) => {
      const role = guild.roles.cache.find(
        (role) =>
          !!locale.tags.find(
            (tag) =>
              role.name.toLowerCase() ==
              this.defaultAssistantRoleName.toLowerCase() +
                " " +
                tag.toLowerCase()
          )
      );
      if (role)
        assistants.set(locale.tag, {
          role: role,
        });
    });
    return {
      channel:
        (guild.channels.cache.find(
          (channel) =>
            channel.name.toLowerCase() ==
              this.defaultAssistanceChannelName.toLowerCase() &&
            channel.type === ChannelType.GuildText
        ) as TextChannel) ?? null,
      role:
        guild.roles.cache.find(
          (role) =>
            role.name.toLowerCase() ==
            this.defaultAssistanceRoleName.toLowerCase()
        ) ?? null,
      assistants: assistants,
    };
  }
}

type RequestHumanAssistant = {
  requestedAt: Date;
  interaction: AnyInteraction;
  thread: ThreadChannel;
  locale: LocaleTag;
};

type GuildAssistants = {
  role: Role | null;
  channel: TextChannel | null;
  assistants: Collection<LocaleTag, { role: Role }>;
};
