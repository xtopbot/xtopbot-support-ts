import Response, { Action, ResponseCodes } from "./Response";
import { Util } from "discord.js";
import Logger from "./Logger";
import { v4 as uuidv4 } from "uuid";
import { CommandMethodTypes } from "../commands/CommandMethod";
export default class Exception extends Response<CommandMethodTypes> {
  public readonly reason: string | null;
  public readonly severity: Severity;
  public readonly cause?: Error | unknown | null = null;
  constructor(message: string, severity: Severity, cause?: Error | unknown) {
    super(
      ResponseCodes.EXCEPTION,
      {
        content: `An error occurred while executing the request.\n\`\`\`${Util.escapeMarkdown(
          message
        )}\`\`\`\n \`Request Id:\`**\`${uuidv4()}\`**`,
        ephemeral: true,
      },
      Action.REPLY
    ); // this Reply message is temp while locale is finished
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
