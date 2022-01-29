import {
  ApplicationCommandOptionChoice,
  InteractionReplyOptions,
  ReplyMessageOptions,
} from "discord.js";

export default class Response {
  public code: ResponseCodes;
  public message: ReplyMessageOptions | InteractionReplyOptions | null;
  public options?: OptionsResponse | null = null;
  public constructor(
    code: ResponseCodes,
    message: ReplyMessageOptions | InteractionReplyOptions | null,
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
  UNAUTHORIZED_USER_LEVEL_POLICY = 1001,
  BOT_CHANNEL_PERMISSIONS_MISSING = 1002,
  MEMBER_CHANNEL_PERMISSIONS_MISSING = 1003,
  BOT_GUILD_PERMISSIONS_MISSING = 1004,
  MEMBER_GUILD_PERMISSIONS_MISSING = 1005,
  COMMAND_ONLY_USABLE_ON_GUILD = 1006,
  INVALID_CHANNEL_TYPE = 2001,
  EXCEPTION = 5000,
}
interface OptionsResponse {
  update?: boolean; // for Message Components
  response?: ApplicationCommandOptionChoice[]; // For Autocomplete Interaction
}
