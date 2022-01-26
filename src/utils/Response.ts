import { ReplyMessageOptions } from "discord.js";

export default class Response {
  public code: ResponseCodes;
  public message: ReplyMessageOptions | null;
  public options?: OptionsResponse;
  public constructor(
    code: ResponseCodes,
    message: ReplyMessageOptions | null,
    options?: OptionsResponse
  ) {
    this.code = code;
    this.message = message;
    this.options = options;
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
  EXCEPTION = 5000,
}
interface OptionsResponse {
  update: boolean; // for Message Components
}
