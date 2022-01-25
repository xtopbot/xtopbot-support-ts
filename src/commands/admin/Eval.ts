import { Message } from "discord.js";
import { UserLevelPolicy } from "../../structures/User";
import Exception, { Severity } from "../../utils/Exception";
import FinalResponse, { ResponseCodes } from "../../utils/FinalResponse";
import CommandMethod from "../CommandMethod";
import { DefaultCommand } from "../DefaultCommand";
import app from "../../app";
import { VM } from "vm2";
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

  public execute(dcm: CommandMethod): Promise<FinalResponse> {
    if (dcm.d instanceof Message) return this._execute(dcm, dcm.context);
    throw new Exception(
      "This type of interaction could not be detected.",
      Severity.FAULT
    );
  }
  private async _execute(
    dcm: CommandMethod,
    input: string
  ): Promise<FinalResponse> {
    if (dcm.author.id !== "247519134080958464")
      throw new Exception("This error should not occur!", Severity.FAULT); // to be safe :)
    const d = this.checkFlags(input.replace(/token/gi, ""));
    console.log(d);
    try {
      const vm = new VM({
        timeout: 100,
        sandbox: {
          app: app,
          dcm: dcm,
        },
      });
      var res: string = JSON.stringify(vm.run(d.input), null, 2);
      return new FinalResponse(
        ResponseCodes.SUCCESS,
        !d.flags.includes(EvalFlags.OUTPUT)
          ? {
              content: `output: \`\`\`${res}\`\`\``,
            }
          : null
      );
    } catch (error) {
      return new FinalResponse(ResponseCodes.SUCCESS, {
        content: `Failed to compile script: \`\`\`${
          (error as Error).message
        }\`\`\``,
      });
    }
  }

  private checkFlags(input: string): DataEvalFlags {
    const data: DataEvalFlags = {
      input: input,
      flags: [],
    };
    const REGEX_OUTPUT_FLAG = /(--output|-o)\s*$/i;
    if (REGEX_OUTPUT_FLAG.test(input)) {
      data.input = data.input.replace(REGEX_OUTPUT_FLAG, "").trim();
      data.flags.push(EvalFlags.OUTPUT);
    }
    return data;
  }
}

interface DataEvalFlags {
  input: string;
  flags: Array<EvalFlags>;
}
enum EvalFlags {
  OUTPUT,
}
