import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ChatInputCommandInteraction,
  TextChannel,
} from "discord.js";
import { UserFlagsPolicy } from "../../structures/User";
import Constants from "../../utils/Constants";
import Response, {
  Action,
  MessageResponse,
  ResponseCodes,
} from "../../utils/Response";
import { BaseCommand } from "../BaseCommand";
import { Method } from "../CommandMethod";

export default class WebhookCreate extends BaseCommand {
  constructor() {
    super({
      flag: UserFlagsPolicy.DEVELOPER,
      memberPermissions: [],
      botPermissions: ["SendMessages", "EmbedLinks", "ManageWebhooks"],
      applicationCommandData: [
        {
          dmPermission: false,
          name: "webhook",
          description: "Creates a bot webhook through a specified text channel",
          type: ApplicationCommandType.ChatInput,
          options: [
            {
              name: "create",
              description:
                "Creates a bot webhook through a specified text channel",
              type: ApplicationCommandOptionType.Subcommand,
              options: [
                {
                  name: "channel",
                  description: "Choose the text channel",
                  channelTypes: Constants.WEBHOOKS_CHANNEL_TYPES,
                  type: ApplicationCommandOptionType.Channel,
                  required: false,
                },
              ],
            },
          ],
        },
      ],
    });
  }

  protected async chatInputCommandInteraction(
    dcm: Method<ChatInputCommandInteraction>
  ) {
    const _channel = dcm.d.options.getChannel("channel");
    const channel = _channel
      ? await dcm.d.guild?.channels.fetch(_channel.id)
      : null;
    if (!channel || !Constants.WEBHOOKS_CHANNEL_TYPES.includes(channel.type))
      return new Response(
        ResponseCodes.INVALID_CHANNEL_TYPE,
        {
          content:
            "The channel type is invalid or unable to find a channel on guild.",
          ephemeral: true, // related to locale system
        },
        Action.REPLY
      );
    return this.createWebhook(channel as TextChannel);
  }

  private async createWebhook(
    channel: TextChannel
  ): Promise<Response<MessageResponse>> {
    await channel.createWebhook({ name: "xToP Support" });
    return new Response(
      ResponseCodes.SUCCESS,
      {
        content: `Webhook created on <#${channel.id}>`, // related to locale system
        ephemeral: true,
      },
      Action.REPLY
    );
  }
}
