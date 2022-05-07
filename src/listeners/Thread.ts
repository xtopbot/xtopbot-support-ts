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
    try {
      await RequestHumanAssistantPlugin.onThreadMembersUpdate(
        addedMembers,
        removedMembers,
        thread
      );
    } catch (err) {
      Logger.error(
        `[App](Event: ThreadMembersUpdate) Error while execute: ${
          (err as Error).message
        }`
      );
      console.error(err);
    }
  }

  public static async onThreadUpdate(
    oldThread: ThreadChannel,
    newThread: ThreadChannel
  ) {
    try {
      await RequestHumanAssistantPlugin.onThreadUpdate(oldThread, newThread);
    } catch (err) {
      Logger.error(
        `[App](Event: onThreadUpdate) Error while execute: ${
          (err as Error).message
        }`
      );
      console.error(err);
    }
  }
}
