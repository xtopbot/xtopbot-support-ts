import {
  Role,
  ApplicationCommandType,
  ComponentType,
  SelectMenuComponentOptionData,
  SelectMenuInteraction,
  ChatInputCommandInteraction,
  ButtonInteraction,
} from "discord.js";
import { UserFlagsPolicy } from "../../structures/User";
import Response, {
  Action,
  MessageResponse,
  ResponseCodes,
} from "../../utils/Response";
import CommandMethod, {
  AnyInteraction,
  AnyMethod,
  CommandMethodTypes,
  Method,
} from "../CommandMethod";
import { BaseCommand } from "../BaseCommand";

export default class Notifications extends BaseCommand {
  constructor() {
    super({
      flag: UserFlagsPolicy.NONE,
      memberPermissions: [],
      botPermissions: ["SendMessages", "EmbedLinks", "ManageRoles"],
      applicationCommandData: [
        {
          name: "notifications",
          description: "...",
          type: ApplicationCommandType.ChatInput,
        },
      ],
      messageComponent: (d) => {
        if (d.matches("notifications")) {
          d.setPath("getMessage");
          return true;
        }
        return false;
      },
    });
  }

  public async chatInputCommandInteraction(
    dcm: Method<ChatInputCommandInteraction>
  ) {
    return this.getMessageNotificationRoles(dcm);
  }

  public async selectMenuInteraction(dcm: Method<SelectMenuInteraction>) {
    const selectedRoles = dcm.d.values as DefaultNotificationRoles[];
    await dcm.d.deferReply({ ephemeral: true });
    return this.setMemberNotificationRole(dcm, selectedRoles);
  }

  private async getMessageNotificationRoles(
    dcm: Method<ChatInputCommandInteraction | ButtonInteraction>
  ): Promise<Response<MessageResponse>> {
    const notificationRoles: NotificationRoles =
      await this.getNotificationRoles(dcm);
    if (
      !notificationRoles.news &&
      !notificationRoles.updates &&
      !notificationRoles.status
    )
      return new Response(
        ResponseCodes.UNABLE_TO_FIND_NOTIFICATION_ROLES,
        {
          content: "Uanble to find notification roles in this server.", // related to locale system
          ephemeral: true,
        },
        Action.REPLY
      );
    return new Response(
      ResponseCodes.SUCCESS,
      {
        content: `select notifications`, // related to locale system
        ephemeral: true,
        components: [
          {
            type: ComponentType.ActionRow,
            components: [
              {
                type: ComponentType.SelectMenu,
                customId: "notifications",
                maxValues:
                  Number(!!notificationRoles.news) +
                  Number(!!notificationRoles.updates) +
                  Number(!!notificationRoles.status),
                minValues: 0,
                placeholder: "Select your own notifications",
                options: [
                  notificationRoles.news
                    ? {
                        label: "NEWS",
                        description:
                          "All the important news regarding the bot!",
                        value: DefaultNotificationRoles.NEWS,
                        default: !!dcm.member.roles.cache.has(
                          notificationRoles.news.id
                        ),
                      }
                    : null,
                  notificationRoles.updates
                    ? {
                        label: "UPDATES",
                        description:
                          "Be the first to know about new commands and new changes in the bot!",
                        value: DefaultNotificationRoles.UPDATES,
                        default: !!dcm.member.roles.cache.has(
                          notificationRoles.updates.id
                        ),
                      }
                    : null,
                  notificationRoles.status
                    ? {
                        label: "STATUS",
                        description:
                          "Status updates about xToP. Issues, downtime and maintenances.",
                        value: DefaultNotificationRoles.STATUS,
                        default: !!dcm.member.roles.cache.has(
                          notificationRoles.status.id
                        ),
                      }
                    : null,
                ].filter(
                  (option) => option !== null
                ) as SelectMenuComponentOptionData[],
              },
            ],
          },
        ],
      },
      Action.REPLY
    );
  }

  private async setMemberNotificationRole(
    dcm: Method<AnyInteraction>,
    roles: DefaultNotificationRoles[]
  ): Promise<Response<MessageResponse>> {
    const notificationRoles: NotificationRoles =
      await this.getNotificationRoles(dcm);
    if (
      !notificationRoles.news &&
      !notificationRoles.updates &&
      !notificationRoles.status
    )
      return new Response(
        ResponseCodes.UNABLE_TO_FIND_NOTIFICATION_ROLES,
        {
          content: "Uanble to find notification roles in this server.", // related to locale system
          ephemeral: true,
        },
        Action.REPLY
      );
    if (notificationRoles.news) {
      if (roles.includes(DefaultNotificationRoles.NEWS))
        await dcm.member.roles.add(notificationRoles.news);
      else await dcm.member.roles.remove(notificationRoles.news);
    }
    if (notificationRoles.updates) {
      if (roles.includes(DefaultNotificationRoles.UPDATES))
        await dcm.member.roles.add(notificationRoles.updates);
      else await dcm.member.roles.remove(notificationRoles.updates);
    }
    if (notificationRoles.status) {
      if (roles.includes(DefaultNotificationRoles.STATUS))
        await dcm.member.roles.add(notificationRoles.status);
      else await dcm.member.roles.remove(notificationRoles.status);
    }
    return new Response(
      ResponseCodes.SUCCESS,
      {
        content: "Roles: " + roles.join(", "),
        ephemeral: true,
      },
      Action.REPLY
    );
  }

  private async getNotificationRoles(
    dcm: AnyMethod
  ): Promise<NotificationRoles> {
    const roles = await dcm.d.guild?.roles.fetch();
    return {
      updates:
        roles?.find(
          (role) =>
            dcm.me.roles.highest.position > role.position &&
            role.name.toLowerCase() ===
              DefaultNotificationRoles.UPDATES.toLowerCase()
        ) ?? null,
      news:
        roles?.find(
          (role) =>
            dcm.me.roles.highest.position > role.position &&
            role.name.toLowerCase() ===
              DefaultNotificationRoles.NEWS.toLowerCase()
        ) ?? null,
      status:
        roles?.find(
          (role) =>
            dcm.me.roles.highest.position > role.position &&
            role.name.toLowerCase() ===
              DefaultNotificationRoles.STATUS.toLowerCase()
        ) ?? null,
    };
  }
}

interface NotificationRoles {
  updates: Role | null;
  news: Role | null;
  status: Role | null;
}

enum DefaultNotificationRoles {
  UPDATES = "updates",
  NEWS = "news",
  STATUS = "status",
}
