import {
  ActionRow,
  ActionRowComponent,
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ChatInputCommandInteraction,
  ComponentType,
  NewsChannel,
  TextChannel,
  Webhook,
} from "discord.js";
import { UserFlagsPolicy } from "../../structures/User";
import Exception, { Reason, Severity } from "../../utils/Exception";
import Response, { ResponseCodes } from "../../utils/Response";
import CommandMethod, {
  ChatInputCommandInteractionMethod,
} from "../CommandMethod";
import { BaseCommand } from "../BaseCommand";
import Constants from "../../utils/Constants";
import app from "../../app";
export default class Webhooks extends BaseCommand {
  constructor() {
    super({
      flag: UserFlagsPolicy.DEVELOPER,
      memberPermissions: [],
      botPermissions: ["SendMessages", "EmbedLinks", "ManageWebhooks"],
      applicationCommandData: [
        {
          name: "webhooks",
          description: "Manages bot webhooks on this server",
          type: ApplicationCommandType.ChatInput,
          options: [
            {
              name: "channel",
              description:
                "Manages bot webhooks through a specific text channel",
              channelTypes: Constants.WEBHOOKS_CHANNEL_TYPES,
              type: ApplicationCommandOptionType.String,
              required: false,
            },
          ],
        },
      ],
    });
  }

  public execute(dcm: CommandMethod): Promise<Response> {
    if (dcm.d instanceof ChatInputCommandInteraction)
      return this.chatInputCommandInteraction(
        dcm as ChatInputCommandInteractionMethod
      );
    throw new Exception(
      `[${this.constructor.name}] ${Reason.INTERACTION_TYPE_NOT_DETECT}`,
      Severity.FAULT
    );
  }

  private async chatInputCommandInteraction(
    dcm: ChatInputCommandInteractionMethod
  ): Promise<Response> {
    const _channel = dcm.d.options.getChannel("channel");
    const channel = _channel
      ? await dcm.d.guild?.channels.fetch(_channel.id)
      : null;
    if (_channel || channel) {
      if (!channel || !Constants.WEBHOOKS_CHANNEL_TYPES.includes(channel.type))
        return new Response(ResponseCodes.INVALID_CHANNEL_TYPE, {
          content: "Invalid Channel Type or Unable to find channel on guild.",
          ephemeral: true, // related to locale system
        });
      return this.manageWebhooks(dcm, channel as NewsChannel | TextChannel);
    }
    return this.manageWebhooks(dcm);
  }

  //private async manageWebhook(webhook: Webhook): Promise<Response> {}

  private async manageWebhooks(
    dcm: CommandMethod,
    channel?: TextChannel | NewsChannel
  ): Promise<Response> {
    if (channel && !channel.permissionsFor(dcm.me).has("ManageWebhooks"))
      return new Response(ResponseCodes.BOT_CHANNEL_PERMISSIONS_MISSING, {
        content: "Bot Permission Channel Missing", // related to locale system
      });
    const webhooks = (
      channel
        ? await channel.fetchWebhooks()
        : await dcm.d.guild?.fetchWebhooks()
    )?.filter((webhook) => webhook.owner?.id === app.client.user?.id);

    if (!webhooks || webhooks.size === 0)
      return new Response(ResponseCodes.UNABLE_TO_FIND_WEBHOOKS, {
        content: `Unable to find Webhooks on ${
          channel?.id ? `<#${channel.id}>` : "this guild"
        }`, // related to locale system
        ephemeral: true,
      });

    return new Response(ResponseCodes.SUCCESS, {
      content: `${webhooks.size} Webhooks found on ${
        channel?.id ? `<#${channel.id}>` : "this guild"
      }`, // related to locale system
      ephemeral: true,
      components: [
        {
          type: ComponentType.ActionRow,
          components: [
            {
              type: ComponentType.SelectMenu,
              customId: "webhooks",
              placeholder: "Select Webhook you want to manage it",
              options: webhooks
                .map((webhook) => ({
                  label: webhook.name,
                  description: `Channel: #${
                    dcm.d.guild?.channels.cache.get(webhook.channelId)?.name ??
                    "Unknown"
                  }`,
                  value: webhook.id,
                }))
                .slice(0, 25),
            },
          ],
        },
      ] as unknown as ActionRow<ActionRowComponent>[],
    });
  }
}
