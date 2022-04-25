import {
  ApplicationCommandOptionChoice,
  AutocompleteInteraction,
  ButtonInteraction,
  ChatInputCommandInteraction,
  ContextMenuCommandInteraction,
  InteractionReplyOptions,
  InteractionUpdateOptions,
  Message,
  MessageOptions,
  ModalData,
  ModalSubmitInteraction,
  SelectMenuInteraction,
} from "discord.js";
import { CommandMethodTypes } from "../commands/CommandMethod";

export default class Response<T extends CommandMethodTypes> {
  public code: ResponseCodes;
  public message: MessageResponse<T>;
  public action: ActionResponse<T>;
  public constructor(
    code: ResponseCodes,
    message: MessageResponse<T>,
    action: ActionResponse<T>
  ) {
    this.code = code;
    this.message = message;
    this.action = action;
  }
}
type MessageResponse<T extends CommandMethodTypes> = T extends Message
  ? MessageOptions | null
  : T extends ChatInputCommandInteraction
  ? InteractionReplyOptions | InteractionUpdateOptions | ModalData
  : T extends ButtonInteraction
  ? InteractionReplyOptions | InteractionUpdateOptions | ModalData
  : T extends SelectMenuInteraction
  ? InteractionReplyOptions | InteractionUpdateOptions | ModalData
  : T extends ContextMenuCommandInteraction
  ? InteractionReplyOptions | InteractionUpdateOptions | ModalData
  : T extends AutocompleteInteraction
  ? ApplicationCommandOptionChoice[]
  : T extends ModalSubmitInteraction
  ? InteractionReplyOptions | InteractionUpdateOptions
  : null;

type ActionResponse<T extends CommandMethodTypes> = T extends Message
  ? Action.REPLY | Action.NONE
  : T extends ChatInputCommandInteraction
  ? Action.REPLY | Action.MODAL
  : T extends ButtonInteraction
  ? Action.REPLY | Action.MODAL | Action.DEFER | Action.UPDATE
  : T extends SelectMenuInteraction
  ? Action.REPLY | Action.MODAL | Action.DEFER | Action.UPDATE
  : T extends ContextMenuCommandInteraction
  ? Action.REPLY | Action.MODAL
  : T extends AutocompleteInteraction
  ? Action.REPLY
  : T extends ModalSubmitInteraction
  ? Action.REPLY | Action.DEFER | Action.UPDATE
  : null;
export enum Action {
  NONE,
  REPLY,
  DEFER,
  UPDATE,
  MODAL,
}
export enum ResponseCodes {
  UNKNOWN = 0,
  SUCCESS = 200,
  AUTOCOMPLETE_EMPTY_RESPONSE = 201,
  PLUGIN_SUCCESS = 202,
  UNAUTHORIZED_USER_LEVEL_POLICY = 1001,
  BOT_CHANNEL_PERMISSIONS_MISSING = 1002,
  MEMBER_CHANNEL_PERMISSIONS_MISSING = 1003,
  BOT_GUILD_PERMISSIONS_MISSING = 1004,
  MEMBER_GUILD_PERMISSIONS_MISSING = 1005,
  COMMAND_ONLY_USABLE_ON_GUILD = 1006,
  EMPTY_INPUT = 2001,
  UNABLE_TO_FIND_NOTIFICATION_ROLES = 2002,
  INVALID_CHANNEL_TYPE = 2003,
  UNABLE_TO_FIND_WEBHOOKS = 2004,
  UNABLE_TO_FIND_WEBHOOK = 2005,
  WEBHOOK_OWNER_NOT_ME = 2006,
  WEBHOOK_UNABLE_TO_FIND_MESSAGE = 2007,
  INVALID_JSON_DATA = 3001,
  DISCORD_API_ERROR = 3002,
  //Plugins
  LOCALE_ASSISTANT_NOT_FOUND = 4001,
  ALREADY_REQUESTED_ASSISTANT = 4002,
  REQUIRED_USER_LOCALE = 4003,
  EXCEPTION = 5000,
}
