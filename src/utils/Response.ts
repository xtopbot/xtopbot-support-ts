import {
  ApplicationCommandOptionChoice,
  InteractionReplyOptions,
  InteractionUpdateOptions,
  MessageOptions,
} from "discord.js";

export default class Response {
  public code: ResponseCodes;
  public message:
    | MessageOptions
    | InteractionReplyOptions
    | InteractionUpdateOptions
    | ApplicationCommandOptionChoice[] // For Autocomplete Interaction
    | null;
  public options?: OptionsResponse | null = null;
  public constructor(
    code: ResponseCodes,
    message:
      | MessageOptions
      | InteractionReplyOptions
      | InteractionUpdateOptions
      | ApplicationCommandOptionChoice[]
      | null,
    options?: OptionsResponse
  ) {
    this.code = code;
    this.message = message;
    this.options ??= options ?? null;
  }
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
  EXCEPTION = 5000,
}
interface OptionsResponse {
  update?: boolean; // for Message Components
}
