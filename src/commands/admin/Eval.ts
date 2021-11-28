import { DefaultCommand, CommandLevels } from "../DefaultCommand";

export default class Eval extends DefaultCommand {
  constructor() {
    super({
      name: "eval",
      aliases: [],
      level: CommandLevels.DEVELOPER,
      userPermissions: [],
      botPermissions: ["SEND_MESSAGES", "EMBED_LINKS"],
      applicationCommandData: [],
    });
  }

  run() {}
}
