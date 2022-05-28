import {
  Collection,
  PartialThreadMember,
  Snowflake,
  ThreadChannel,
  ThreadMember,
} from "Discord.js";
import Logger from "../utils/Logger";
import RequestHumanAssistantPlugin from "../plugins/RequestHumanAssistant";
export default class {
  public static async onThreadMembersUpdate(
    addedMembers: Collection<Snowflake, ThreadMember>,
    removedMembers: Collection<Snowflake, ThreadMember | PartialThreadMember>,
    thread: ThreadChannel
  ) {
    await RequestHumanAssistantPlugin.onThreadMembersUpdate(
      addedMembers,
      removedMembers,
      thread
    ).catch((err: unknown) =>
      Logger.error(
        err,
        `[App](Event: onThreadMembersUpdate (RequestHumanAssistantPlugin)) Error while execute: ${
          (err as Error)?.message
        }`
      )
    );
  }

  public static async onThreadUpdate(
    oldThread: ThreadChannel,
    newThread: ThreadChannel
  ) {
    await RequestHumanAssistantPlugin.onThreadUpdate(
      oldThread,
      newThread
    ).catch((err: unknown) =>
      Logger.error(
        err,
        `[App](Event: onThreadUpdate (RequestHumanAssistantPlugin)) Error while execute: ${
          (err as Error)?.message
        }`
      )
    );
  }
}
