import {
  ActionRow,
  ActionRowComponent,
  createComponent,
} from "@discordjs/builders";
import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  MessageComponentInteraction,
  SelectMenuInteraction,
  Role,
  ApplicationCommandType,
  SelectMenuOption,
  ComponentType,
} from "discord.js";
import { UserLevelPolicy } from "../../structures/User";
import Exception, { Reason, Severity } from "../../utils/Exception";
import Response, { ResponseCodes } from "../../utils/Response";
import CommandMethod, { SelectMenuInteractionMethod } from "../CommandMethod";
import { DefaultCommand } from "../DefaultCommand";

export default class Notifications extends DefaultCommand {
  constructor() {
    super({
      level: UserLevelPolicy.USER,
      memberPermissions: [],
      botPermissions: ["SendMessages", "EmbedLinks"],
      applicationCommandData: [
        {
          name: "notifications",
          description: "...",
          type: ApplicationCommandType.ChatInput,
        },
      ],
      messageComponent: (d: MessageComponentInteraction) => {
        if (d.customId === "notifications") return true;
        return false;
      },
    });
  }

  public execute(dcm: CommandMethod): Promise<Response> {
    if (dcm.d instanceof ChatInputCommandInteraction)
      return this.displayNotificationRoles(dcm);
    if (dcm.d instanceof ButtonInteraction)
      return this.displayNotificationRoles(dcm);
    if (dcm.d instanceof SelectMenuInteraction)
      return this.selectMentInteraction(dcm as SelectMenuInteractionMethod);
    throw new Exception(
      `[${this.constructor.name}] ${Reason.INTERACTION_TYPE_NOT_DETECT}`,
      Severity.FAULT
    );
  }

  private async displayNotificationRoles(
    dcm: CommandMethod
  ): Promise<Response> {
    const notificationRoles: NotificationRoles =
      await this.getNotificationRoles(dcm);
    if (
      !notificationRoles.news &&
      !notificationRoles.updates &&
      !notificationRoles.status
    )
      return new Response(ResponseCodes.UNABLE_TO_FIND_NOTIFICATION_ROLES, {
        content: "Uanble to find notification roles in this server.", // related to locale system
        ephemeral: true,
      });
    return new Response(ResponseCodes.SUCCESS, {
      content: `select notifications`, // related to locale system
      ephemeral: true,
      components: [
        {
          type: ComponentType.ActionRow,
          components: [
            {
              type: ComponentType.SelectMenu,
              custom_id: "notifications",
              max_values:
                Number(!!notificationRoles.news) +
                Number(!!notificationRoles.updates) +
                Number(!!notificationRoles.status),
              min_values: 0,
              placeholder: "Select your own notifications", // related to locale system
              options: [
                notificationRoles.news
                  ? {
                      label: "NEWS", // related to locale system
                      description: "All the important news regarding the bot!", // related to locale system
                      value: DefaultNotificationRoles.NEWS,
                      default: !!dcm.member.roles.cache.has(
                        notificationRoles.news.id
                      ),
                    }
                  : null,
                notificationRoles.updates
                  ? {
                      label: "UPDATES", // related to locale system
                      description:
                        "Be the first to know about new commands and new changes in the bot!", // related to locale system
                      value: DefaultNotificationRoles.UPDATES,
                      default: !!dcm.member.roles.cache.has(
                        notificationRoles.updates.id
                      ),
                    }
                  : null,
                notificationRoles.status
                  ? {
                      label: "STATUS", // related to locale system
                      description:
                        "Status updates about xToP. Issues, downtime and maintenances.", // related to locale system
                      value: DefaultNotificationRoles.STATUS,
                      default: !!dcm.member.roles.cache.has(
                        notificationRoles.status.id
                      ),
                    }
                  : null,
              ].filter((option) => option !== null) as SelectMenuOption[],
            },
          ],
        },
      ] as ActionRow<ActionRowComponent>[],
    });
  }

  private async selectMentInteraction(
    dcm: SelectMenuInteractionMethod
  ): Promise<Response> {
    const selectedRoles = dcm.d.values as DefaultNotificationRoles[];
    await dcm.d.deferReply({ ephemeral: true });
    return this.selectedNotificationRole(dcm, selectedRoles);
  }

  private async selectedNotificationRole(
    dcm: CommandMethod,
    roles: DefaultNotificationRoles[]
  ): Promise<Response> {
    const notificationRoles: NotificationRoles =
      await this.getNotificationRoles(dcm);
    if (
      !notificationRoles.news &&
      !notificationRoles.updates &&
      !notificationRoles.status
    )
      return new Response(ResponseCodes.UNABLE_TO_FIND_NOTIFICATION_ROLES, {
        content: "Uanble to find notification roles in this server.", // related to locale system
        ephemeral: true,
      });
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
    return new Response(ResponseCodes.SUCCESS, {
      content: "Roles: " + roles.join(", "),
      ephemeral: true,
    });
  }

  private async getNotificationRoles(
    dcm: CommandMethod
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
