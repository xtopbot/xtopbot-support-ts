import Response, { ResponseCodes } from "./Response";
import { Util } from "discord.js";
import Logger from "./Logger";
export default class Exception extends Response {
  public reason: string | null;
  public severity: Severity;
  public cause?: Error | null = null;
  constructor(message: string, severity: Severity, cause?: Error) {
    super(ResponseCodes.EXCEPTION, {
      content: `Error: \`${Util.escapeMarkdown(message)}\``,
    }); // this Reply message is temp while locale is finished
    this.reason = message;
    this.severity = severity;
    this.cause ??= cause;
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
  COMMAND_NOT_DETECT_INTERACTION_TYPE = "This type of interaction could not be detected.",
}
