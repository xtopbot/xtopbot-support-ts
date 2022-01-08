import { ReplyMessageOptions } from "discord.js";

export default class FinalResponse {
  public code: ResponseCodes;
  public response: ReplyMessageOptions;
  public constructor(code: ResponseCodes, response: ReplyMessageOptions) {
    this.code = code;
    this.response = response;
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

// export class ResponseCodes {
//   public static readonly UNKNOWN: number = 0;
//   public static readonly SUCCESS: number = 200;
//   public static readonly UNAUTHORIZED_USER_LEVEL_POLICY: number = 1001;
//   public static readonly BOT_CHANNEL_PERMISSIONS_MISSING: number = 1002;
//   public static readonly MEMBER_CHANNEL_PERMISSIONS_MISSING: number = 1003;
//   public static readonly BOT_GUILD_PERMISSIONS_MISSING: number = 1004;
//   public static readonly MEMBER_GUILD_PERMISSIONS_MISSING: number = 1005;
//   public static readonly COMMAND_ONLY_USABLE_ON_GUILD: number = 1006;
//   public static readonly EXCEPTION: number = 5000;
// }
