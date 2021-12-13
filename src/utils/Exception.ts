import FinalResponse from "./FinalResponse";
import { FinalResponseCode } from "./FinalResponse";
import { Util } from "discord.js";
import Logger from "./Logger";
export default class Exception extends FinalResponse {
  public message: string | null;
  public severity: Severity;
  public cause?: Error | null = null;
  constructor(message: string, severity: Severity, cause?: Error) {
    super(FinalResponseCode.EXCEPTION, {
      content: `Error: \`${Util.escapeMarkdown(message)}\``,
    }); // this Reply message is temp while locale is finished
    this.message = message;
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
