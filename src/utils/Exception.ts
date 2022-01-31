import Response, { ResponseCodes } from "./Response";
import { Util } from "discord.js";
import Logger from "./Logger";
export default class Exception extends Response {
  public reason: string | null;
  public severity: Severity;
  public cause?: Error | null = null;
  constructor(message: string, severity: Severity, cause?: Error) {
    super(ResponseCodes.EXCEPTION, {
      content: `Error: \`${Util.escapeMarkdown(message)}\``, // related to locale system
      ephemeral: true,
    }); // this Reply message is temp while locale is finished
    this.reason = message;
    this.severity = severity;
    this.cause ??= cause ?? null;
    if (this.severity === Severity.FAULT)
      Logger.error(`[${this.severity}] ${message}`);
    else Logger.debug(`[${this.severity}] ${message}`);
  }
}

export enum Severity {
  COMMON,
  SUSPICIOUS,
  FAULT,
}

export enum Reason {
  INTERACTION_TYPE_NOT_DETECT = "This type of interaction could not be detected.",
  UNABLE_TO_FIND_INTERACTION_COMMAND = "Unable to find interaction path.",
  SOMETHING_WAS_WRONG_WHILE_CHECKING_REQUIREMENTS_COMMAND = "Something was wrong while checking requirements command.",
}
