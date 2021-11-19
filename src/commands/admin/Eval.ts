import { DefaultCommand, CommandLevels } from "../DefaultCommand";

class Eval extends DefaultCommand {
  constructor() {
    super({
      name: "eval",
      aliases: [],
      level: CommandLevels.DEVELOPER,
    });
  }
}
