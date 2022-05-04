import {
  ChannelType,
  Collection,
  ComponentType,
  DiscordAPIError,
  Guild,
  GuildMember,
  Role,
  TextChannel,
  TextInputStyle,
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
  ModalResponse,
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
    issue: null,
    dcm: Method<AnyInteraction>,
    guild: Guild
  ): Promise<Response<MessageResponse | ModalResponse>>;
  public static async request(
    issue: string,
    dcm: Method<AnyInteraction>,
    guild: Guild
  ): Promise<Response<MessageResponse>>;
  public static async request(
    issue: string | null,
    dcm: Method<AnyInteraction>,
    guild: Guild
  ): Promise<Response<MessageResponse | ModalResponse>> {
    const guildAssistants = this.getGuildAssistants(guild);

    const locale = app.locales.get(dcm.user.locale);
    if (!dcm.user.locale)
      return new Response(
        ResponseCodes.REQUIRED_USER_LOCALE,
        {
          ...locale.origin.plugins.pluginRequiredUserLocale,
          components: app.locales.getMessageWithMenuOfLocales(
            dcm.user,
            "helpdesk:requestAssistant:setLocale"
          ).components,
          ephemeral: true,
        },
        Action.REPLY
      ); // User must have lang
    await app.locales.checkUserRoles(
      dcm.user,
      dcm.d.guild as Guild,
      dcm.d.member as GuildMember
    );
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
        {
          content: "Unable to find Assistant for your lang",
          ephemeral: true,
        },
        Action.REPLY
      );
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
    if (issue === null) return this.openModal();
    //
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

  private static openModal(): Response<ModalResponse> {
    return new Response<ModalResponse>(
      ResponseCodes.SUCCESS,
      {
        customId: "helpdesk:requestAssistant",
        title: "Request Assistant",
        components: [
          {
            type: ComponentType.ActionRow,
            components: [
              {
                type: ComponentType.TextInput,
                customId: "issue",
                label: "issue",
                required: true,
                minLength: 5,
                maxLength: 100,
                style: TextInputStyle.Paragraph,
              },
            ],
          },
        ],
      },
      Action.MODAL
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
