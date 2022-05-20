import {
  AutocompleteInteraction,
  ButtonStyle,
  ChannelType,
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
import AssistanceThreadManager from "../managers/AssistanceThreadManager";
import { LocaleTag } from "../managers/LocaleManager";
import AssistanceThread, {
  AThreadStatus,
} from "../structures/AssistanceThread";
import { UserFlagsPolicy } from "../structures/User";
import Constants from "../utils/Constants";
import ContextFormats from "../utils/ContextFormats";
import Response, {
  Action,
  MessageResponse,
  ModalResponse,
  ResponseCodes,
} from "../utils/Response";
import Util, { Diff } from "../utils/Util";
import db from "../providers/Mysql";

export default class RequestHumanAssistantPlugin {
  public static readonly threads = new AssistanceThreadManager();
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
    const oldAT = this.threads.cache
      .map((t) => t)
      .find(
        (t) => t.userId == dcm.user.id && t.status === AThreadStatus.ACTIVE
      );
    if (oldAT) {
      const thread = ((await oldAT.thread?.fetch(true)) ??
        null) as ThreadChannel | null;
      if (thread) {
        if (thread.archived === false) {
          dcm.cf.formats.set("thread.id", thread.id);
          if (!dcm.member.roles.cache.get(guildAssistants.role.id))
            await dcm.member.roles.add(guildAssistants.role);
          return new Response(
            ResponseCodes.LOCALE_ASSISTANT_NOT_FOUND,
            {
              ...locale.origin.plugins.requestHumanAssistant.activeThread,
              ephemeral: true,
            },
            Action.REPLY
          );
        } else
          await oldAT.close(
            oldAT.assistantId ? AThreadStatus.SOLVED : AThreadStatus.CLOSED
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
    await db.query(
      "INSTER INTO `Assistance.Threads` SET threadId = ?, userId = ?, guildId = ?, interactionToken = ?, locale = ?",
      [thread.id, dcm.d.user.id, thread.guild.id, dcm.d.token, locale.tag]
    );
    this.threads.cache.set(
      thread.id,
      new AssistanceThread(
        thread.id,
        dcm.d.user.id,
        dcm.d.webhook,
        thread,
        locale.tag
      )
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
    _addedMembers: Collection<Snowflake, ThreadMember>,
    removedMembers: Collection<Snowflake, ThreadMember | PartialThreadMember>,
    thread: ThreadChannel
  ) {
    const at = await this.threads.fetch(thread.id, false, true);
    if (!at) return;
    //Remove member
    if (removedMembers.get(at.userId)) {
      const user = await app.users.fetch(at.userId);
      const locale = app.locales.get(user.locale);
      if (at.assistantId) {
        // Assistant responsed. Means Status will be SOLVED
        await at.close(AThreadStatus.SOLVED, {
          ...locale.origin.plugins.requestHumanAssistant.solvedIssue
            .interaction,
          components: [
            {
              type: ComponentType.ActionRow,
              components: [
                {
                  type: ComponentType.Button,
                  label:
                    locale.origin.plugins.requestHumanAssistant.solvedIssue
                      .interaction.buttons[0],
                  customId: "helpdesk:survey",
                  style: ButtonStyle.Primary,
                },
              ],
            },
          ],
        });
        /*await at.close(
          AThreadStatus.SOLVED,
          {
            ...locale.origin.plugins.requestHumanAssistant.solvedIssue,
            components: [
              {
                type: ComponentType.ActionRow,
                components: Array(5)
                  .fill(null)
                  .map((_, index) => ({
                    type: ComponentType.Button,
                    label: "🌚",
                    customId: "helpdesk:survey:AssistantRating:" + (index + 1),
                    style: ButtonStyle.Secondary,
                  })),
              },
            ],
          } // related to locale system
        );*/
      } else {
        // Left the thread and Assisntant not response yet
        await at.close(AThreadStatus.CLOSED, {
          ...locale.origin.plugins.requestHumanAssistant.summonerLeftTheThread
            .interaction,
          components: [
            {
              type: ComponentType.ActionRow,
              components: [
                {
                  type: ComponentType.SelectMenu,
                  customId: "helpdesk:survey:summonerleftthread",
                  maxValues: 1,
                  minValues: 1,
                  placeholder:
                    locale.origin.plugins.requestHumanAssistant
                      .summonerLeftTheThread.interaction.selectMenu[0]
                      .placeholder,
                  options: [
                    {
                      label:
                        locale.origin.plugins.requestHumanAssistant
                          .summonerLeftTheThread.interaction.selectMenu[0]
                          .options[0].label,
                      value: "heSolvedItHimself",
                    },
                    {
                      label:
                        locale.origin.plugins.requestHumanAssistant
                          .summonerLeftTheThread.interaction.selectMenu[0]
                          .options[1].label,
                      value: "assistantDelayed",
                    },
                    {
                      label:
                        locale.origin.plugins.requestHumanAssistant
                          .summonerLeftTheThread.interaction.selectMenu[0]
                          .options[2].label,
                      value: "other",
                    },
                  ],
                },
              ],
            },
          ],
        });
      }
    }
  }

  public static async onThreadUpdate(
    oldThread: ThreadChannel,
    newThread: ThreadChannel
  ) {
    if (!oldThread.archived && newThread.archived) {
      // Thread was Archived
      const at = await this.threads.fetch(newThread.id);
      if (!at) return;
      if (!newThread.locked) newThread.setLocked(true);
      if (at.status !== AThreadStatus.ACTIVE) return;

      const user = await app.users.fetch(at.userId);
      const locale = app.locales.get(user.locale);
      if (at.assistantId) {
        await at.close(AThreadStatus.SOLVED, {
          ...locale.origin.plugins.requestHumanAssistant.solvedIssue
            .interaction,
          components: [
            {
              type: ComponentType.ActionRow,
              components: [
                {
                  type: ComponentType.Button,
                  label:
                    locale.origin.plugins.requestHumanAssistant.solvedIssue
                      .interaction.buttons[0],
                  customId: "helpdesk:survey",
                  style: ButtonStyle.Primary,
                },
              ],
            },
          ],
        });
      } else {
        await at.close(AThreadStatus.CLOSED);
      }
    } /* else if (oldThread.archived && !newThread.archived) {
      // Thread was Unarchived
      const at = await this.threads.fetch(newThread.id);
      if (!at) return;
    }*/
  }

  public static async onMessageInThread(message: Message) {
    if (!(message.channel instanceof ThreadChannel) || message.author.bot)
      return;

    const thread = message.channel;
    const at = await this.threads.fetch(thread.id);
    if (!at) return;

    const user = await app.users.fetch(message.author, false);
    const locale = app.locales.get(user.locale);

    if (at.userId === user.id) return;
    if ((user.flags & Constants.StaffBitwise) !== 0) {
      //Staff

      if (!at.assistantId) {
        // Assistant not assigned.
        at.setAssistant(user.id); // Assign Assistant
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

      message.delete();
      thread.members.remove(user.id);
      const guildAssistants = this.getGuildAssistants(message.guild as Guild);
      const atSpamer = this.threads.cache
        .map((t) => t)
        .find((t) => t.userId == user.id && t.status === AThreadStatus.ACTIVE);
      if (
        guildAssistants.role &&
        message.member?.roles.cache.get(guildAssistants.role.id) &&
        !atSpamer
      )
        return message.member?.roles.remove(guildAssistants.role);

      const cfx = new ContextFormats();
      const spamer = at.spamerUsers.get(user);
      cfx.setObject("user", message.author);
      cfx.formats.set("user.tag", message.author.tag);
      if (atSpamer) cfx.formats.set("active.thread.id", atSpamer.id);

      if (spamer.isAllowed()) {
        if (spamer.remaining >= 4)
          if (atSpamer?.isInteractionExpired() === false)
            atSpamer.webhook.send({
              ...locale.origin.plugins.requestHumanAssistant.publicThread
                .notBelongToHim.warning,
              ephemeral: true,
            });
      } else {
        atSpamer?.close(AThreadStatus.CLOSED, {
          ...locale.origin.plugins.requestHumanAssistant.publicThread
            .notBelongToHim.timeout,
        });
        message.member?.disableCommunicationUntil(
          spamer.blockedEndAt?.getTime() ?? Date.now() + 5 * 60 * 1000,
          `Spam sending messages in thread (#${thread.id}) that does not belong to him`
        );
      }
    }
  }
}

type GuildAssistants = {
  role: Role | null;
  channel: TextChannel | null;
  assistants: Collection<LocaleTag, { role: Role }>;
};
