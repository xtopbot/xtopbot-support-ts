import { UserLevelPolicy } from "../../structures/User";
import CommandMethod from "../CommandMethod";
import { DefaultCommand } from "../DefaultCommand";

export default class Eval extends DefaultCommand {
  constructor() {
    super({
      name: "eval",
      aliases: [],
      level: UserLevelPolicy.DEVELOPER,
      memberPermissions: [],
      botPermissions: ["SEND_MESSAGES", "EMBED_LINKS"],
      applicationCommandData: [],
    });
  }

  execute(dcm: CommandMethod) {
    return;
  }
}
