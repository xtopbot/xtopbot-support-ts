import {
  AutocompleteInteraction,
  ChannelType,
  ChatInputCommandInteraction,
  Collection,
  ComponentType,
  Guild,
  GuildMember,
  Message,
  PartialThreadMember,
  Role,
  Snowflake,
  TextChannel,
  TextInputStyle,
  ThreadChannel,
  ThreadMember,
} from "discord.js";
import app from "../app";
import { AnyInteraction, Method } from "../commands/CommandMethod";
import { LocaleTag } from "../managers/LocaleManager";
import AssistanceThread, {
  SummonerStatus,
} from "../structures/AssistanceThread";
import User, { UserFlagsPolicy } from "../structures/User";
import Constants from "../utils/Constants";
import Response, {
  Action,
  MessageResponse,
  ModalResponse,
  ResponseCodes,
} from "../utils/Response";
import Util, { Diff } from "../utils/Util";

export default class RequestHumanAssistantPlugin {
  public static readonly threads: Collection<string, AssistanceThread> =
    new Collection();
  private static readonly defaultAssistantRoleName = "assistant";
  private static readonly defaultAssistanceRoleName = "assistance";
  private static readonly defaultAssistanceChannelName = "assistance";

  public static async request(
    issue: null,
    dcm: Method<Diff<AnyInteraction, AutocompleteInteraction>>,
    guild: Guild
  ): Promise<Response<MessageResponse | ModalResponse>>;
  public static async request(
    issue: string,
    dcm: Method<Diff<AnyInteraction, AutocompleteInteraction>>,
    guild: Guild
  ): Promise<Response<MessageResponse>>;
  public static async request(
    issue: string | null,
    dcm: Method<Diff<AnyInteraction, AutocompleteInteraction>>,
    guild: Guild
  ): Promise<Response<MessageResponse | ModalResponse>> {
    const guildAssistants = this.getGuildAssistants(guild);

    const locale = app.locales.get(dcm.user.locale);
    if (!dcm.user.locale || !app.locales.get(dcm.user.locale ?? "", false))
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
    const oldRequest = this.threads
      .map((t) => t)
      .find((t) => t.userId == dcm.user.id);
    if (oldRequest) {
      const thread = await oldRequest.thread.fetch(true);
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
      this.threads.delete(oldRequest.thread.id);
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
    this.threads.set(
      thread.id,
      new AssistanceThread(dcm.d.user.id, dcm.d, thread, locale.tag)
    );
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
  /*
  public static async removeSummoner(id: string): Promise<void> {
    if (guild) {
      const summoner = this.summoners.get(id);
      if (summoner) {
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
    this.summoners.delete(id);
  }*/

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

  //Events

  public static async onThreadMembersUpdate(
    addedMembers: Collection<Snowflake, ThreadMember>,
    removedMembers: Collection<Snowflake, ThreadMember | PartialThreadMember>,
    thread: ThreadChannel
  ) {
    /*
    // Added Member
    if (addedMembers.size > 0) {
    }

    if (removedMembers.size > 0) {
      removedMembers.forEach(async (threadMember) => {
        const requestMember = this.requests.get(threadMember.id);
        if (!requestMember) return; // User leave thread but not requested
        await thread.fetch();
        thread.setLocked(true, "The requester left the thread.");
      });
    }*/

    console.log("Thread Members Update (addedMembers)", addedMembers);
    console.log("Thread Members Update (removedMembers)", removedMembers);
  }

  public static async onThreadUpdate(
    oldThread: ThreadChannel,
    newThread: ThreadChannel
  ) {
    if (!oldThread.archived && newThread.archived) {
      const at = this.threads
        .map((t) => t)
        .find((t) => t.thread.id === newThread.id);
      if (!at) return;
      if (!newThread.locked) newThread.setLocked(true);
      if (
        at.status === SummonerStatus.ACTIVE &&
        at.interaction.createdTimestamp >
          Date.now() - Constants.DEFAULT_INTERACTION_EXPIRES
      )
        at.interaction.followUp({
          content: "Hello Are you there?",
          ephemeral: true,
        });
      //newThread.setArchived(true);
      //Thread was archived.
    }

    console.log("Thread Update (old)", oldThread);
    console.log("Thread Update (new)", newThread);
  }

  public static isUserAllowedSendMessageInThread(
    user: User,
    thread: ThreadChannel
  ): boolean {
    if (
      (user.flags & (Constants.StaffBitwise & ~UserFlagsPolicy.SUPPORT)) !==
      0
    )
      return true;
    const at = this.threads.get(thread.id);
    if (at && at.userId === user.id) return true;
    return false;
  }

  public static async onMessageInThread(message: Message) {
    if (!(message.channel instanceof ThreadChannel)) return;
    const thread = message.channel;
    const at = this.threads.get(thread.id);
    if (!at) return;
    const user = await app.users.fetch(message.author, false);
    if (at.userId === user.id) return;
    if ((user.flags & Constants.StaffBitwise) !== 0) {
      //Staff
      if (!at.assistantId) {
        // Assistant not assgined.
        at.setAssistant(user.id); // Assgin Assistant
      } else {
        if (
          (user.flags & (Constants.StaffBitwise & ~UserFlagsPolicy.SUPPORT)) !==
          0
        )
          return;
        if (at.assistantId == user.id) return;
        message.delete();
      }
    } else {
      //User
      const guildAssistants = this.getGuildAssistants(message.guild as Guild);
      const atSpamer = this.threads
        .map((t) => t)
        .find((t) => t.userId == user.id);
      if (
        guildAssistants.role &&
        message.member?.roles.cache.get(guildAssistants.role.id) &&
        atSpamer?.status != SummonerStatus.ACTIVE
      )
        message.member?.roles.remove(guildAssistants.role);
      const spamer = at.spamerUsers.get(user);
      message.delete();
      if (spamer.isAllowed()) {
        console.log(spamer.remaining);
        if (spamer.remaining >= 4)
          atSpamer?.interaction.followUp({
            content: `Hey <@${user.id}>,\nYou seems are sending message in the wrong thread. Head to your thread <#${atSpamer.thread.id}> and start sending message there!`,
            ephemeral: true,
          });
      } else {
        message.member?.disableCommunicationUntil(
          spamer.blockedEndAt?.getTime() ?? Date.now() + 5 * 60 * 1000,
          `Spam sending messages in thread (#${thread.id}) that does not belong to him`
        );
        atSpamer?.interaction.followUp({
          content: `Hey <@${user.id}>,\nYou have sent a lot of messages on thread that is not yours! I had to ban you for a while. (Your thread has been closed due to your bad behavior)`,
          ephemeral: true,
        });
      }
    }
  }
}

type GuildAssistants = {
  role: Role | null;
  channel: TextChannel | null;
  assistants: Collection<LocaleTag, { role: Role }>;
};
