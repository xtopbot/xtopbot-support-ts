import { Message } from "discord.js";
import { UserLevelPolicy } from "../../structures/User";
import Exception, { Reason, Severity } from "../../utils/Exception";
import Response, { ResponseCodes } from "../../utils/Response";
import CommandMethod, { MessageCommandMethod } from "../CommandMethod";
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

  public execute(dcm: CommandMethod): Promise<Response> {
    if (dcm.d instanceof Message)
      return this.message(dcm as MessageCommandMethod, dcm.context);
    throw new Exception(
      `[${this.constructor.name}] ${Reason.INTERACTION_TYPE_NOT_DETECT}`,
      Severity.FAULT
    );
  }
  private async message(
    dcm: MessageCommandMethod,
    input: string
  ): Promise<Response> {
    if (dcm.author.id !== "247519134080958464")
      throw new Exception("This error should not occur!", Severity.FAULT); // to be safe :)
    const rd = this.checkFlags(input.replace(/token/gi, ""));
    try {
      const vm = new VM({
        timeout: 100,
        sandbox: {
          app: app,
          dcm: dcm,
        },
      });
      var res: string = JSON.stringify(await vm.run(rd.input), null, 2);
      return new Response(
        ResponseCodes.SUCCESS,
        !rd.flags.includes(EvalFlags.OUTPUT)
          ? {
              content: `output: \`\`\`${res}\`\`\``,
            }
          : null
      );
    } catch (error) {
      return new Response(ResponseCodes.SUCCESS, {
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
