import {
  ApplicationCommandOptionChoice,
  InteractionReplyOptions,
  InteractionUpdateOptions,
  MessageOptions,
  ModalData,
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
export type ModalResponse = ModalData;
export type AutocompleteResponse = ApplicationCommandOptionChoice[];
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
  LOCALE_ROLE_NOT_FOUND = 2008,
  INVALID_JSON_DATA = 3001,
  DISCORD_API_ERROR = 3002,
  //Plugins
  LOCALE_ASSISTANT_NOT_FOUND = 4001,
  ALREADY_REQUESTED_ASSISTANT = 4002,
  REQUIRED_USER_LOCALE = 4003,
  EXCEPTION = 5000,
}
