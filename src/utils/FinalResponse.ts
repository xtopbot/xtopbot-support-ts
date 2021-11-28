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

enum FinalResponseCode {
  SUCCESS = 200,
}
