import {
  ApplicationCommandType,
  ButtonInteraction,
  ChatInputCommandInteraction,
  ComponentType,
  InteractionType,
  Role,
  SelectMenuComponentOptionData,
  SelectMenuInteraction,
} from "discord.js";
import { UserFlagsPolicy } from "../../structures/User";
import Response, {
  Action,
  MessageResponse,
  ResponseCodes,
} from "../../utils/Response";
import { AnyInteraction, AnyMethod, Method } from "../CommandMethod";
import { BaseCommand } from "../BaseCommand";
import app from "../../app";
import Constants from "../../utils/Constants";
import Exception, { Severity } from "../../utils/Exception";
import Util from "../../utils/Util";
import ComponentMethod from "../ComponentMethod";

export default class Notifications extends BaseCommand {
  constructor() {
    super({
      flag: UserFlagsPolicy.NONE,
      memberPermissions: [],
      botPermissions: ["SendMessages", "EmbedLinks", "ManageRoles"],
      applicationCommandData: [
        {
          dmPermission: true,
          name: "notifications",
          description:
            "Manage your notifications for type of our announcements you prefer.",
          type: ApplicationCommandType.ChatInput,
        },
      ],
      messageComponent: (d) => {
        return d.matches("notifications");
      },
    });
  }

  protected async chatInputCommandInteraction(
    dcm: Method<ChatInputCommandInteraction>
  ) {
    return this.getMessageNotificationRoles(dcm);
  }

  protected buttonInteraction(dcm: ComponentMethod<ButtonInteraction>) {
    return this.getMessageNotificationRoles(dcm);
  }

  protected async selectMenuInteraction(dcm: Method<SelectMenuInteraction>) {
    const selectedRoles = dcm.d.values as DefaultNotificationRoles[];
    //await dcm.d.deferReply({ ephemeral: true });
    return this.setMemberNotificationRole(dcm, selectedRoles);
  }

  private async getMessageNotificationRoles(
    dcm: Method<AnyInteraction>
  ): Promise<Response<MessageResponse>> {
    const notificationRoles: NotificationRoles =
      await this.getNotificationRoles(dcm);
    if (
      !notificationRoles.news &&
      //!notificationRoles.updates &&
      !notificationRoles.status
    )
      throw new Exception(
        "Unable to find notification roles in the support server",
        Severity.SUSPICIOUS
      );
    return new Response(
      ResponseCodes.SUCCESS,
      {
        ...Util.addFieldToEmbed(
          dcm.locale.origin.commands.notification,
          0,
          "color",
          Constants.defaultColors.BLUE
        ),
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
                  //Number(!!notificationRoles.updates) +
                  Number(!!notificationRoles.status),
                minValues: 0,
                placeholder:
                  dcm.locale.origin.commands.notification.selectMenu[0]
                    .placeholder,
                options: [
                  notificationRoles.news
                    ? {
                        label:
                          dcm.locale.origin.commands.notification.selectMenu[0]
                            .options[0].label,
                        description:
                          dcm.locale.origin.commands.notification.selectMenu[0]
                            .options[0].description,
                        value: DefaultNotificationRoles.NEWS,
                        default: dcm.member.roles.cache.has(
                          notificationRoles.news.id
                        ),
                      }
                    : null,
                  /* notificationRoles.updates
                    ? {
                        label: "UPDATES",
                        description:
                          "Be the first to know about new commands and new changes in the bot!",
                        value: DefaultNotificationRoles.UPDATES,
                        default: dcm.member.roles.cache.has(
                          notificationRoles.updates.id
                        ),
                      }
                    : null,*/
                  notificationRoles.status
                    ? {
                        label:
                          dcm.locale.origin.commands.notification.selectMenu[0]
                            .options[1].label,
                        description:
                          dcm.locale.origin.commands.notification.selectMenu[0]
                            .options[1].description,
                        value: DefaultNotificationRoles.STATUS,
                        default: dcm.member.roles.cache.has(
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
      Action.UPDATE_WHILE_EPHEMERAL
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
      //!notificationRoles.updates &&
      !notificationRoles.status
    )
      throw new Exception(
        "Unable to find notification roles in the support server",
        Severity.SUSPICIOUS
      );
    if (notificationRoles.news) {
      if (roles.includes(DefaultNotificationRoles.NEWS))
        await dcm.member.roles.add(notificationRoles.news);
      else await dcm.member.roles.remove(notificationRoles.news);
    }
    /*if (notificationRoles.updates) {
      if (roles.includes(DefaultNotificationRoles.UPDATES))
        await dcm.member.roles.add(notificationRoles.updates);
      else await dcm.member.roles.remove(notificationRoles.updates);
    }*/
    if (notificationRoles.status) {
      if (roles.includes(DefaultNotificationRoles.STATUS))
        await dcm.member.roles.add(notificationRoles.status);
      else await dcm.member.roles.remove(notificationRoles.status);
    }
    return this.getMessageNotificationRoles(dcm);
  }

  private async getNotificationRoles(
    dcm: AnyMethod
  ): Promise<NotificationRoles> {
    const roles = await (
      dcm.d.guild ?? app.client.guilds.cache.get(Constants.supportServerId)
    )?.roles.fetch();
    return {
      /* updates:
        roles?.find(
          (role) =>
            dcm.me.roles.highest.position > role.position &&
            role.name.toLowerCase() ===
              DefaultNotificationRoles.UPDATES.toLowerCase()
        ) ?? null,*/
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
  //updates: Role | null;
  news: Role | null;
  status: Role | null;
}

enum DefaultNotificationRoles {
  //UPDATES = "updates",
  NEWS = "news",
  STATUS = "status",
}
