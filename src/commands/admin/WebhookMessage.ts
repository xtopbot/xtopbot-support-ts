import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  DiscordAPIError,
  MessagePayload,
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ComponentType,
  ButtonStyle,
  ModalSubmitInteraction,
  Webhook,
  TextInputStyle,
} from "discord.js";
import { UserFlagsPolicy } from "../../structures/User";
import Exception, { Severity } from "../../utils/Exception";
import Response, {
  Action,
  ModalResponse,
  ResponseCodes,
} from "../../utils/Response";
import { Method } from "../CommandMethod";
import { BaseCommand } from "../BaseCommand";
import app from "../../app";
import Util from "../../utils/Util";
export default class WebhookMessage extends BaseCommand {
  constructor() {
    super({
      flag: UserFlagsPolicy.DEVELOPER,
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
                  required: false,
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
      messageComponent: (d) => {
        if (d.matches("webhook")) {
          return true;
        }
        return false;
      },
    });
  }

  public async autoCompleteInteraction(dcm: Method<AutocompleteInteraction>) {
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
          })) ?? [],
        Action.REPLY
      );
    }
    return new Response(ResponseCodes.AUTOCOMPLETE_EMPTY_RESPONSE, []);
  }

  public async chatInputCommandInteraction(
    dcm: Method<ChatInputCommandInteraction>
  ) {
    //await dcm.d.deferReply({ ephemeral: true });
    const webhookOption = dcm.d.options.getString("webhook", false);
    const webhook = webhookOption
      ? (await dcm.d.guild?.fetchWebhooks())?.find(
          (webhook: Webhook) => webhook.id === webhookOption
        )
      : null;
    if (!webhook)
      return new Response(
        ResponseCodes.UNABLE_TO_FIND_WEBHOOK,
        {
          content: `Unable to find webhook with \`${webhookOption}\` Id`,
          ephemeral: true,
        },
        Action.REPLY
      );
    if (webhook.owner?.id !== app.client.user?.id)
      return new Response(
        ResponseCodes.WEBHOOK_OWNER_NOT_ME,
        {
          content: `Unable to find webhook with \`${webhookOption}\` Id`,
          ephemeral: true,
        },
        Action.REPLY
      );
    const message = dcm.d.options.getString("message", false);
    const messageId = dcm.d.options.getString("message_id", false);
    if (message) return this.sendMessageToWebhook(webhook, message, messageId);
    return new Response<ModalResponse>(
      ResponseCodes.SUCCESS,
      {
        customId: `webhook:${webhook.id}${
          messageId ? `:messageId:${messageId}` : ""
        }`,
        title: `Send Message To Webhook`,
        components: [
          {
            type: ComponentType.ActionRow,
            components: [
              {
                type: ComponentType.TextInput,
                minLength: 1,
                customId: "messageData",
                required: true,
                style: TextInputStyle.Paragraph,
                label: "Message",
              },
            ],
          },
        ],
      },
      Action.MODAL
    );
  }

  public async modalSubmitInteraction(dcm: Method<ModalSubmitInteraction>) {
    const webhookId = dcm.getValue("webhook");
    const webhook = webhookId
      ? (await dcm.d.guild?.fetchWebhooks())?.find(
          (webhook: Webhook) => webhook.id === webhookId
        )
      : null;
    if (!webhook)
      return new Response(
        ResponseCodes.UNABLE_TO_FIND_WEBHOOK,
        {
          content: `Unable to find webhook with \`${webhookId}\` Id`,
          ephemeral: true,
        },
        Action.REPLY
      );
    return this.sendMessageToWebhook(
      webhook,
      dcm.d.fields.getTextInputValue("messageData"),
      dcm.getValue("messageId", false)
    );
  }

  private async sendMessageToWebhook(
    webhook: Webhook,
    message: string,
    message_id?: string | null
  ) {
    const messageData = Util.stringToJson(message);
    if (!messageData)
      return new Response(
        ResponseCodes.INVALID_JSON_DATA,
        {
          content: "Invalid json data",
          ephemeral: true,
        },
        Action.REPLY
      );
    try {
      const post = !message_id
        ? await webhook.send(messageData as unknown as MessagePayload)
        : await webhook.editMessage(
            message_id,
            messageData as unknown as MessagePayload
          );
      return new Response(
        ResponseCodes.SUCCESS,
        {
          content: !message_id
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
          ],
          ephemeral: true,
        },
        Action.REPLY
      );
    } catch (err) {
      if (err instanceof DiscordAPIError)
        return new Response(
          ResponseCodes.DISCORD_API_ERROR,
          {
            content: `\`\`\`Discord API Error: ${err.message} (Status code: ${err.status})\`\`\``,
            ephemeral: true,
          },
          Action.REPLY
        );
      throw new Exception(
        "Unkown error while proccesing webhook message",
        Severity.FAULT,
        err
      );
    }
  }
}
