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
import Util from "../../utils/Util";

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

  protected async message(dcm: CommandMethod<Message>) {
    return this.runEval(dcm, dcm.context);
  }

  private async runEval(
    dcm: Method<Message>,
    input: string
  ): Promise<Response<MessageResponse | null>> {
    if (dcm.author.id !== "247519134080958464")
      throw new Exception("This error should not occur!", Severity.FAULT); // to be safe :)
    const rd = this.checkFlags(input.replace(/token/gi, ""));
    if (!rd.input) throw new Exception("Empty input", Severity.COMMON);
    try {
      const vm = new VM({
        timeout: 3000,
        sandbox: {
          app: app,
          dcm: dcm,
        },
      });
      let res: string = Util.jsonToString(
        await vm.run(`(async () =>${rd.input.replace(/;$/, "")})()`)
      );
      if (rd.flags.includes(EvalFlags.WITHOUT_OUTPUT))
        return new Response(ResponseCodes.SUCCESS, null);
      let files = [];
      if (res.length >= 1900 || rd.flags.includes(EvalFlags.FILE))
        files.push(
          new AttachmentBuilder(Buffer.from(res), {
            name: "output.json",
          })
        );
      return new Response(
        ResponseCodes.SUCCESS,
        {
          content:
            files.length === 0
              ? `\`\`\`${res}\`\`\``
              : res.length >= 1900
              ? `File Output (Large content) `
              : `File Output (Flag)`,
          files,
        },
        Action.REPLY
      );
    } catch (error) {
      return new Response(
        ResponseCodes.SUCCESS,
        {
          content: `Failed to compile script: \`\`\`${
            (error as Error)?.message
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
    const REGEX_WITHOUT_OUTPUT_FLAG = /(--without-output)/i;
    if (REGEX_WITHOUT_OUTPUT_FLAG.test(input)) {
      data.input = data.input.replace(REGEX_WITHOUT_OUTPUT_FLAG, "").trim();
      data.flags.push(EvalFlags.WITHOUT_OUTPUT);
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
  WITHOUT_OUTPUT,
  FILE,
}
