import { AttachmentBuilder, Message } from "discord.js";
import { UserFlagsPolicy } from "../../structures/User";
import Exception, { Severity } from "../../utils/Exception";
import Response, {
  Action,
  MessageResponse,
  ResponseCodes,
} from "../../utils/Response";
import CommandMethod, { Method } from "../CommandMethod";
import { BaseCommand } from "../BaseCommand";
import app from "../../app";
import { VM } from "vm2";

export default class Eval extends BaseCommand {
  constructor() {
    super({
      name: "eval",
      aliases: [],
      flag: UserFlagsPolicy.DEVELOPER,
      memberPermissions: ["Administrator"],
      botPermissions: ["SendMessages"],
      applicationCommandData: [],
    });
  }

  public async message(dcm: CommandMethod<Message>) {
    return this.runEval(dcm, dcm.context);
  }

  private async runEval(
    dcm: Method<Message>,
    input: string
  ): Promise<Response<MessageResponse | null>> {
    if (dcm.author.id !== "247519134080958464")
      throw new Exception("This error should not occur!", Severity.FAULT); // to be safe :)
    const rd = this.checkFlags(input.replace(/token/gi, ""));
    if (!rd.input)
      return new Response(
        ResponseCodes.EMPTY_INPUT,
        {
          content: "Empty Input",
        },
        Action.REPLY
      );
    try {
      const vm = new VM({
        timeout: 3000,
        sandbox: {
          app: app,
          dcm: dcm,
        },
      });
      var res: string = JSON.stringify(
        await vm.run(`(async () =>${rd.input})()`),
        null,
        2
      );
      if (rd.flags.includes(EvalFlags.OUTPUT))
        return new Response(ResponseCodes.SUCCESS, null);
      return new Response(
        ResponseCodes.SUCCESS,
        res.length >= 1900 || rd.flags.includes(EvalFlags.FILE)
          ? {
              content:
                res.length >= 1900
                  ? `File Output (Large content) `
                  : `File Output (Flag)`,
              files: [
                new AttachmentBuilder(Buffer.from(res), {
                  name: "output.json",
                }),
              ],
            }
          : {
              content: `\`\`\`${res}\`\`\``,
            },
        Action.REPLY
      );
    } catch (error) {
      return new Response(
        ResponseCodes.SUCCESS,
        {
          content: `Failed to compile script: \`\`\`${
            (error as Error).message
          }\`\`\``,
        },
        Action.REPLY
      );
    }
  }

  private checkFlags(input: string): DataEvalFlags {
    const data: DataEvalFlags = {
      input: input,
      flags: [],
    };
    const REGEX_OUTPUT_FLAG = /(--\!output|-\!o)/i;
    if (REGEX_OUTPUT_FLAG.test(input)) {
      data.input = data.input.replace(REGEX_OUTPUT_FLAG, "").trim();
      data.flags.push(EvalFlags.OUTPUT);
    }
    const REGEX_FILE_FLAG = /(--file|-f)/i;
    if (REGEX_FILE_FLAG.test(input)) {
      data.input = data.input.replace(REGEX_FILE_FLAG, "").trim();
      data.flags.push(EvalFlags.FILE);
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
  FILE,
}
