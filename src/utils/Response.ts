import {
  ApplicationCommandOptionChoiceData,
  InteractionReplyOptions,
  InteractionUpdateOptions,
  MessageOptions,
  ModalComponentData,
} from "discord.js";

export default class Response<T extends AnyResponse = AnyResponse> {
  public code: ResponseCodes;
  public message: T;
  public action: ActionResponse<T> | Action;

  public constructor(
    code: ResponseCodes,
    message: T,
    action?: ActionResponse<T>
  ) {
    this.code = code;
    this.message = message;
    this.action = action ?? Action.REPLY;
  }
}
export type ModalResponse = ModalComponentData;
export type AutocompleteResponse = ApplicationCommandOptionChoiceData[];
export type MessageResponse =
  | InteractionReplyOptions
  | InteractionUpdateOptions
  | MessageOptions;
export type AnyResponse =
  | ModalResponse
  | AutocompleteResponse
  | MessageResponse
  | null;
type ActionResponse<T extends AnyResponse> = T extends MessageResponse
  ? Action.REPLY | Action.UPDATE
  : T extends ModalResponse
  ? Action.MODAL
  : T extends AutocompleteResponse
  ? Action.REPLY
  : never;

/*
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
  : null;*

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
  : null;*/
export enum Action {
  REPLY,
  DEFER,
  UPDATE,
  MODAL,
}

export enum ResponseCodes {
  UNKNOWN = 0,
  UNKNOWN_ARGUMENTS = 1,
  EXCEPTION = 2,
  SUCCESS = 200,
  AUTOCOMPLETE_EMPTY_RESPONSE = 201,
  PLUGIN_SUCCESS = 202,
  INSUFFICIENT_PERMISSION = 1001,
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
  LOCALE_ROLE_NOT_FOUND = 2008,
  INVALID_JSON_DATA = 3001,
  DISCORD_API_ERROR = 3002,
  //Plugins
  SERVER_NOT_MEET_PLUGIN_CRITERIA = 4001,
  LOCALE_ASSISTANT_NOT_FOUND,
  ALREADY_REQUESTED_ASSISTANT,
  REQUIRED_USER_LOCALE,
  THERE_ACTIVE_THREAD,
  ACTIVE_ASSISTANT_REQUEST,
  REQUEST_ASSISTANT_CREATED,
  FAILED_TO_CANCEL_ASSISTANT_REQUEST,
  ASSISTANT_REQUEST_EXPIRED_CANNOT_BE_ACCEPT,
  REQUESTER_NOT_ON_SERVER_REQUEST_CANCELED,
  ASSISTANT_REQUEST_NOT_FOUND,
  FAILED_TO_ACCEPT_ASSISTANT_REQUEST,
  ASSISTANT_REQUEST_CANNOT_BE_ACCEPTED_BY_SAME_USER,
  ASSISTANT_REQUEST_NOT_ON_SEARCHING_STATUS,
  ASSISTANT_REQUEST_ALREADY_CLOSED_WITH_REASON,
  ONLY_ASSISTANT_WHO_ACCEPT_ASSISTANT_REQUEST_CAN_CLOSED,
  EXCEEDED_LIMIT_FOR_REQUEST_ASSISTANT,
  ARTICLE_NOT_FOUND,
  ARTICLE_NEED_TO_FILL_NOTE_FIELD,
  ARTICLE_LOCALIZATION_NOT_FOUND,
}
