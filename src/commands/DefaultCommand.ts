import Constants from "../utils/Constants";

export class DefaultCommand implements DefaultCommandType {
  data: DefaultCommandType; // All data
  name: string; // Command Name
  aliases: Array<string>; // Command Aliases
  level: CommandLevels; // Command Level (who can used)

  protected constructor(data: DefaultCommandType) {
    this.data = data;
    this.name = data.name;
    this.aliases = data.aliases;
    this.level = data.level;
  }

  // If command can be disabled
  public get disableable(): boolean {
    return typeof this.data.disableable !== "boolean"
      ? this.data.disableable
      : Constants.DEFAULT_COMMAND_DISABLEABLE_VALUE;
  }

  public get disabled(): boolean {
    return typeof this.data.disabled !== "boolean"
      ? this.data.disabled
      : Constants.DEFAULT_COMMAND_DISABLED_VALUE;
  }
}

interface DefaultCommandType {
  readonly name: string;
  readonly aliases: Array<string>;
  readonly level: CommandLevels;
  disableable?: boolean | true;
  disabled?: boolean | false;
}

export enum CommandLevels {
  DEVELOPER = 5,
  ADMIN = 4,
  STAFF = 3,
  SUPPORT = 2,
  EVERYONE = 1,
}
