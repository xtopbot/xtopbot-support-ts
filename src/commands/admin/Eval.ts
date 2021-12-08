import { UserLevelPolicy } from "../../structures/User";
import { DefaultCommand } from "../DefaultCommand";

export default class Eval extends DefaultCommand {
  constructor() {
    super({
      name: "eval",
      aliases: [],
      level: UserLevelPolicy.DEVELOPER,
      userPermissions: [],
      botPermissions: ["SEND_MESSAGES", "EMBED_LINKS"],
      applicationCommandData: [],
    });
  }

  execute() {}
}
