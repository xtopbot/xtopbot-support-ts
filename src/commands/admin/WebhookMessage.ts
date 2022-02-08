import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  DiscordAPIError,
  MessagePayload,
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ActionRow,
  ActionRowComponent,
  ComponentType,
  ButtonStyle,
} from "discord.js";
import { UserFlagPolicy } from "../../structures/User";
import Exception, { Reason, Severity } from "../../utils/Exception";
import Response, { ResponseCodes } from "../../utils/Response";
import CommandMethod, {
  AutocompleteInteractionMethod,
  ChatInputCommandInteractionMethod,
} from "../CommandMethod";
import { BaseCommand } from "../BaseCommand";
import app from "../../app";
import Util from "../../utils/Util";
export default class WebhookMessage extends BaseCommand {
  constructor() {
    super({
      flag: UserFlagPolicy.DEVELOPER,
      memberPermissions: [],
      botPermissions: ["SendMessages", "EmbedLinks", "ManageWebhooks"],
      applicationCommandData: [
        {
          name: "webhook",
          description:
            "Send/edit a message on a specific webhook (only bot webhook)",
          type: ApplicationCommandType.ChatInput,
          options: [
            {
              name: "message",
              description:
                "Send/edit a message on a specific webhook (only bot webhook)",
              type: ApplicationCommandOptionType.Subcommand,
              options: [
                {
                  name: "webhook",
                  description: "Choose a webhook",
                  type: ApplicationCommandOptionType.String,
                  autocomplete: true,
                  required: true,
                },
                {
                  name: "message",
                  description: "Put message data (json format)",
                  type: ApplicationCommandOptionType.String,
                  required: true,
                },
                {
                  name: "message_id",
                  description:
                    "Put a message ID to edit a Webhook message (keep it empty to send webhook message)",
                  type: ApplicationCommandOptionType.String,
                  required: false,
                },
              ],
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
    if (dcm.d instanceof AutocompleteInteraction)
      return this.autoCompleteInteractiom(dcm as AutocompleteInteractionMethod);
    throw new Exception(
      `[${this.constructor.name}] ${Reason.INTERACTION_TYPE_NOT_DETECT}`,
      Severity.FAULT
    );
  }

  private async chatInputCommandInteraction(
    dcm: ChatInputCommandInteractionMethod
  ): Promise<Response> {
    await dcm.d.deferReply({ ephemeral: true });
    const webhookOption = dcm.d.options.getString("webhook", false);
    const webhook = webhookOption
      ? (await dcm.d.guild?.fetchWebhooks())?.find(
          (webhook) => webhook.id === webhookOption
        )
      : null;
    if (!webhook)
      return new Response(ResponseCodes.UNABLE_TO_FIND_WEBHOOK, {
        content: `Unable to find webhook with \`${webhookOption}\` Id`,
        ephemeral: true,
      });
    if (webhook.owner?.id !== app.client.user?.id)
      return new Response(ResponseCodes.WEBHOOK_OWNER_NOT_ME, {
        content: `Unable to find webhook with \`${webhookOption}\` Id`,
        ephemeral: true,
      });
    const messageOption = dcm.d.options.getString("message", false);
    const messageData = Util.stringToJson(messageOption as string);
    if (!messageData)
      return new Response(ResponseCodes.INVALID_JSON_DATA, {
        content: "Invalid json data",
        ephemeral: true,
      });
    const messageId = dcm.d.options.getString("message_id", false);
    try {
      const post = !messageId
        ? await webhook.send(messageData as unknown as MessagePayload)
        : await webhook.editMessage(
            messageId,
            messageData as unknown as MessagePayload
          );
      return new Response(ResponseCodes.SUCCESS, {
        content: !messageId
          ? "Message successfully sent! "
          : "Message successfully edited!",
        components: [
          {
            type: ComponentType.ActionRow,
            components: [
              {
                type: ComponentType.Button,
                style: ButtonStyle.Link,
                label: "Go to message",
                url: `https://discord.com/channels/${webhook.guildId}/${webhook.channelId}/${post.id}`,
              },
            ],
          },
        ] as ActionRow<ActionRowComponent>[],
      });
    } catch (err) {
      if (err instanceof DiscordAPIError)
        return new Response(ResponseCodes.DISCORD_API_ERROR, {
          content: `\`\`\`Discord API Error: ${err.message} (Status code: ${err.status})\`\`\``,
          ephemeral: true,
        });
      throw new Exception(
        "Unkown error while proccesing webhook message",
        Severity.FAULT,
        err
      );
    }
  }

  private async autoCompleteInteractiom(
    dcm: AutocompleteInteractionMethod
  ): Promise<Response> {
    const webhookOption = dcm.d.options.getString("webhook");
    if (typeof webhookOption == "string" && webhookOption.length <= 32) {
      const webhooks = await dcm.d.guild?.fetchWebhooks(); // This not good for big bots :)
      return new Response(
        ResponseCodes.SUCCESS,
        webhooks
          ?.filter(
            (webhook) =>
              (webhookOption.length > 0
                ? webhook.id == webhookOption ||
                  webhook.name.includes(webhookOption)
                : true) && webhook.applicationId === app.client.user?.id
          )
          .map((webhook) => ({
            name: `${webhook.name} #${
              dcm.d.guild?.channels.cache.get(webhook.channelId)?.name ??
              webhook.channelId
            }`,
            value: webhook.id,
          })) ?? []
      );
    }
    return new Response(ResponseCodes.AUTOCOMPLETE_EMPTY_RESPONSE, null);
  }
}
