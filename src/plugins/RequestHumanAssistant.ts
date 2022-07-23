import {
  ButtonStyle,
  ChannelType,
  Collection,
  ComponentType,
  Guild,
  Message,
  PartialThreadMember,
  Role,
  Snowflake,
  TextChannel,
  ThreadChannel,
  ThreadMember,
} from "discord.js";
import app from "../app";
import { LocaleTag } from "../managers/LocaleManager";
import RequestAssistant, {
  RequestAssistantStatus,
} from "../structures/RequestAssistant";
import { UserFlagsPolicy } from "../structures/User";
import Constants from "../utils/Constants";
import ContextFormats from "../utils/ContextFormats";

export default class RequestHumanAssistantPlugin {
  private static readonly defaultAssistantRoleName = "assistant";
  private static readonly defaultAssistanceRoleName = "assistance";
  private static readonly defaultAssistanceChannelName = "assistance";

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
    const requestAssistant = await app.requests.fetch(thread.id, false);
    if (!requestAssistant) return;
    //Remove member
    if (removedMembers.get(requestAssistant.userId)) {
    }
  }

  public static async onThreadUpdate(
    oldThread: ThreadChannel,
    newThread: ThreadChannel
  ) {
    const requestAssistant = await app.requests.fetch(newThread.id);
    if (!requestAssistant) return;
    if (!oldThread.archived && newThread.archived) {
      // Thread was Archived
      if (requestAssistant.closedAt) {
        if (!newThread.locked) {
          await newThread.setArchived(false);
          await newThread.edit({ archived: true, locked: true });
        }
        return;
      } else {
        requestAssistant.closeThread(RequestAssistantStatus.CLOSED);
      }
    } /* else if (oldThread.archived && !newThread.archived) {
      // Thread was Unarchived
      return this.requestAssistantValidation(at, true);
    }*/
  }

  private static async requestAssistantValidation(
    requestAssistant: RequestAssistant,
    action = true
  ): Promise<boolean> {
    if (requestAssistant.closedAt) {
      if (requestAssistant.threadId && action) {
        const thread = await requestAssistant.getThread().catch(() => null);
        await thread
          ?.send({
            content: "This thread is no longer valid.",
          })
          .catch(() => null);
        await thread?.edit({ archived: true, locked: true }).catch(() => null);
      }
      return false;
    } else if (
      requestAssistant.requestedAt.getTime() <=
      Date.now() - 21600 * 1000 /* 6 Hours */
    ) {
      if (action) {
        const thread = await requestAssistant.getThread();
        await thread
          ?.send({
            content: "This thread is no longer valid.",
          })
          .catch(() => null);
        await requestAssistant.closeThread(RequestAssistantStatus.CLOSED);
      }
      return false;
    }
    return true;
  }

  public static async onMessageInThread(message: Message) {
    if (!(message.channel instanceof ThreadChannel) || message.author.bot)
      return;

    const thread = message.channel;
    const requestAssistant = await app.requests.fetch(thread.id);
    if (!requestAssistant) return;
    if (!(await this.requestAssistantValidation(requestAssistant))) return;
    const user = await app.users.fetch(message.author, false);
    const locale = app.locales.get(user.locale);

    if (requestAssistant.userId === user.id) return;
    if ((user.flags & Constants.StaffBitwise) !== 0) {
      //Staff
      if (
        (user.flags & (Constants.StaffBitwise & ~UserFlagsPolicy.SUPPORT)) !==
          0 ||
        requestAssistant.assistantId == user.id
      )
        return;
      message.delete();
    } else {
      //User

      message.delete();
      thread.members.remove(user.id);
      const guildAssistants = this.getGuildAssistants(message.guild as Guild);
      const spamerUserActiveThread =
        app.requests.cache
          .map((request) => request)
          .find(
            async (request) =>
              request.userId == user.id &&
              (await request.getStatus(true)) === RequestAssistantStatus.ACTIVE
          ) ||
        (await app.requests.fetchUser(user))
          .map((request) => request)
          .find(
            async (request) =>
              request.userId == user.id &&
              (await request.getStatus(true)) === RequestAssistantStatus.ACTIVE
          );

      if (
        guildAssistants.role &&
        message.member?.roles.cache.get(guildAssistants.role.id) &&
        !spamerUserActiveThread?.threadId
      )
        return message.member?.roles.remove(guildAssistants.role);

      const cfx = new ContextFormats();
      const spamer = requestAssistant.spammerUsers.get(user);
      cfx.setObject("user", message.author);
      cfx.formats.set("user.tag", message.author.tag);
      if (spamerUserActiveThread && spamerUserActiveThread?.threadId)
        cfx.formats.set("active.thread.id", spamerUserActiveThread.threadId);

      if (spamer.isAllowed()) {
        if (spamer.remaining >= 4)
          if (spamerUserActiveThread?.isInteractionExpired() === false)
            spamerUserActiveThread.webhook.send({
              ...locale.origin.plugins.requestHumanAssistant.publicThread
                .notBelongToHim.warning,
              ephemeral: true,
            });
      } else {
        spamerUserActiveThread?.closeThread(RequestAssistantStatus.CLOSED, {
          messageToThread: {
            ...locale.origin.plugins.requestHumanAssistant.publicThread
              .notBelongToHim.timeout,
          },
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
