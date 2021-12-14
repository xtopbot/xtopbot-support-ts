import { ReplyMessageOptions } from "discord.js";

export default class FinalResponse {
  public code: FinalResponseCode;
  public replyMessage: ReplyMessageOptions;
  public constructor(
    code: FinalResponseCode,
    replyMessage: ReplyMessageOptions
  ) {
    this.code = code;
    this.replyMessage = replyMessage;
  }

  public get finalReplyMessage(): ReplyMessageOptions {
    return this.replyMessage;
  }
}

export enum FinalResponseCode {
  UNKNOWN = 0,
  SUCCESS = 200,
  UNAUTHORIZED_USER_LEVEL_POLICY = 1001,
  BOT_CHANNEL_PERMISSIONS_MISSING = 1002,
  MEMBER_CHANNEL_PERMISSIONS_MISSING = 1003,
  BOT_GUILD_PERMISSIONS_MISSING = 1004,
  MEMBER_GUILD_PERMISSIONS_MISSING = 1005,
  EXCEPTION = 5000,
}
